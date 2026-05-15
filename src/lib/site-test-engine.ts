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

let active = false;
let unsubscribe: (() => void) | null = null;

async function probeOne(url: string): Promise<SiteResult> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const attempt = async (method: 'HEAD' | 'GET'): Promise<SiteResult> => {
    try {
      await fetch(url, {
        method,
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'follow',
        credentials: 'omit',
      });
      return 'alive';
    } catch {
      return 'dead';
    }
  };

  try {
    const head = await attempt('HEAD');
    if (head === 'alive') return 'alive';
    return await attempt('GET');
  } finally {
    clearTimeout(tid);
  }
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
