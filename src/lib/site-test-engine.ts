/**
 * Long-lived background runner for the site-availability test.
 *
 * The actual state (urls, results, status) lives in the persisted
 * `useSiteTest` store. This module owns the worker loop:
 *
 *   - subscribes to the store
 *   - whenever `status` becomes `'running'`, spins up a small pool of
 *     concurrent fetch probes
 *   - each probe writes its result back to the store
 *   - when all URLs have results, the store flips itself to `'done'`
 *   - on app boot, if `status === 'running'` was persisted (e.g. user
 *     refreshed mid-test), the engine resumes from where it left off:
 *     it skips URLs already in `results` and only probes the rest.
 *
 * This lets the dialog be a pure viewer — opening/closing it has no effect
 * on the running test.
 */
import { useSiteTest } from '@/stores/siteTest';
import type { SiteResult } from '@/stores/siteTest';

const CONCURRENCY = 5;
const TIMEOUT_MS = 8000;
/**
 * Per-attempt timeout for the thorough probe. Shorter than batch because a
 * single retest runs up to 5 sequential attempts and the user is staring at
 * a spinner — we'd rather report dead in ~12s total than keep them waiting.
 */
const THOROUGH_ATTEMPT_TIMEOUT_MS = 4000;

let active = false;
let unsubscribe: (() => void) | null = null;

/**
 * Single fetch attempt, no-cors so cross-origin doesn't preflight. We only
 * care whether the request resolved or threw a network-level error; with
 * no-cors we can't read status, so "responded at all" → alive. Matches the
 * lenient definition used by the batch worker.
 */
async function attemptFetch(
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number
): Promise<boolean> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, {
      method,
      mode: 'no-cors',
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
      credentials: 'omit',
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(tid);
  }
}

/** Batch probe — kept cheap (HEAD then GET) because we run it across every URL. */
async function probeOne(url: string): Promise<SiteResult> {
  if (await attemptFetch(url, 'HEAD', TIMEOUT_MS)) return 'alive';
  if (await attemptFetch(url, 'GET', TIMEOUT_MS)) return 'alive';
  return 'dead';
}

/**
 * Thorough probe used by the per-row "重新检测" button. The user is asking
 * us to spend extra effort on one URL, so try multiple angles before
 * declaring the site dead:
 *
 *   1. HEAD on the original URL.
 *   2. GET on the original URL.
 *   3. Image probe at `<origin>/favicon.ico` — bypasses CORS entirely and
 *      catches sites whose root path 404s but whose static assets are fine
 *      (CDNs, single-page apps).
 *   4. Swap www. ↔ no-www and retry HEAD + GET — many bookmarks point at
 *      the wrong subdomain after the site migrated.
 *
 * Any single success short-circuits the chain. Returns 'alive' on the first
 * hit, 'dead' only after every angle fails.
 */
async function probeThorough(url: string): Promise<SiteResult> {
  if (await attemptFetch(url, 'HEAD', THOROUGH_ATTEMPT_TIMEOUT_MS)) return 'alive';
  if (await attemptFetch(url, 'GET', THOROUGH_ATTEMPT_TIMEOUT_MS)) return 'alive';

  // Favicon image probe — works even when fetch is blocked by mixed-content
  // or strict CSP because <img> bypasses fetch entirely.
  try {
    const origin = new URL(url).origin;
    const ok = await new Promise<boolean>(resolve => {
      const img = new Image();
      const timer = setTimeout(() => {
        img.src = '';
        resolve(false);
      }, THOROUGH_ATTEMPT_TIMEOUT_MS);
      img.onload = () => {
        clearTimeout(timer);
        resolve(true);
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
      // Cache-bust so a stale 404 doesn't make a live site look dead.
      img.src = `${origin}/favicon.ico?_t=${Date.now()}`;
    });
    if (ok) return 'alive';
  } catch {
    /* malformed URL — fall through */
  }

  // www ↔ no-www swap.
  try {
    const u = new URL(url);
    const swapped = u.hostname.startsWith('www.')
      ? new URL(url.replace(/^(https?:\/\/)www\./, '$1'))
      : new URL(`${u.protocol}//www.${u.host}${u.pathname}${u.search}${u.hash}`);
    if (swapped.href !== url) {
      if (await attemptFetch(swapped.href, 'HEAD', THOROUGH_ATTEMPT_TIMEOUT_MS)) return 'alive';
      if (await attemptFetch(swapped.href, 'GET', THOROUGH_ATTEMPT_TIMEOUT_MS)) return 'alive';
    }
  } catch {
    /* malformed URL — fall through */
  }

  return 'dead';
}

/**
 * Re-test a single URL with the thorough probe and write the new result back
 * into the store. Caller (the dialog) renders the loading state locally;
 * this function just returns the result so the caller can decide to e.g.
 * keep the row visible or animate it out.
 */
export async function retestOne(url: string): Promise<SiteResult> {
  const result = await probeThorough(url);
  useSiteTest.getState().recordResult(url, result);
  return result;
}

async function runWorkers() {
  if (active) return;
  active = true;
  const inFlight = new Set<string>();

  const claimNext = (): string | null => {
    const s = useSiteTest.getState();
    if (s.status !== 'running') return null;
    for (const url of s.urls) {
      if (url in s.results) continue;
      if (inFlight.has(url)) continue;
      inFlight.add(url);
      return url;
    }
    return null;
  };

  const worker = async () => {
    while (true) {
      const url = claimNext();
      if (!url) return;
      try {
        const result = await probeOne(url);
        useSiteTest.getState().recordResult(url, result);
      } finally {
        inFlight.delete(url);
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    // Defensive: if status is still 'running' but every URL has a result,
    // the store's recordResult should already have flipped to 'done'. This
    // catches the rare edge where workers exit because `claimNext` returned
    // null due to abort.
    const s = useSiteTest.getState();
    if (s.status === 'running' && s.urls.every(u => u in s.results)) {
      useSiteTest.getState().markDone();
    }
  } finally {
    active = false;
  }
}

/** Kick the worker pool if there's work and we're not already running. */
function maybeStart() {
  const s = useSiteTest.getState();
  if (s.status !== 'running') return;
  if (active) return;
  if (s.urls.every(u => u in s.results)) {
    // Nothing left to probe — just mark done.
    useSiteTest.getState().markDone();
    return;
  }
  runWorkers();
}

export function bootSiteTestEngine() {
  if (unsubscribe) return; // already booted

  // Resume any test left in 'running' from a previous session.
  maybeStart();

  // Whenever the status field changes, recheck.
  unsubscribe = useSiteTest.subscribe(state => {
    if (state.status === 'running') maybeStart();
  });
}

export function stopSiteTestEngine() {
  unsubscribe?.();
  unsubscribe = null;
}
