/**
 * Best-effort bookmark liveness probing.
 *
 * We use `fetch(url, { mode: 'no-cors', method: 'HEAD' })`:
 *   - Resolves opaquely → server returned SOMETHING (treat as alive)
 *   - Rejects (network error / abort) → treat as dead
 *
 * Caveats:
 *   - We can't read response status (no-cors → opaque). So a 404 page on a
 *     live host is reported as alive — we only catch dead domains, refused
 *     connections, and DNS failures.
 *   - Some sites block HEAD; on failure we fall back to a minimal GET.
 *
 * We rate-limit with a bounded concurrent worker pool — never fire all
 * requests at once or the browser tab grinds to a halt with hundreds of
 * bookmarks in flight.
 */

export type SiteTestResult = 'alive' | 'dead';

export type SiteTestProgress = {
  done: number;
  total: number;
  /** URL just finished (for displaying "正在检测 xxx" in the UI). */
  current?: string;
};

async function probeOne(url: string, timeoutMs: number): Promise<SiteTestResult> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  const attempt = async (method: 'HEAD' | 'GET'): Promise<SiteTestResult> => {
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
    // Some hosts (CDNs, anti-bot WAFs) refuse HEAD — try GET as a fallback.
    return await attempt('GET');
  } finally {
    clearTimeout(tid);
  }
}

export async function testSites(
  urls: string[],
  options: {
    /** Concurrent in-flight requests. Default 5 — safe on most networks. */
    concurrency?: number;
    /** Per-URL timeout in ms. Default 8000. */
    timeoutMs?: number;
    signal?: AbortSignal;
    onProgress?: (p: SiteTestProgress) => void;
  } = {}
): Promise<Map<string, SiteTestResult>> {
  const { concurrency = 5, timeoutMs = 8000, signal, onProgress } = options;
  const results = new Map<string, SiteTestResult>();
  if (urls.length === 0) return results;

  let index = 0;
  let done = 0;
  const total = urls.length;

  const worker = async () => {
    while (index < urls.length) {
      if (signal?.aborted) return;
      const i = index++;
      const url = urls[i];
      const result = await probeOne(url, timeoutMs);
      results.set(url, result);
      done++;
      onProgress?.({ done, total, current: url });
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}
