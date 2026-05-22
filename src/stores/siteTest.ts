import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Three-state probe result.
 *   - 'alive'     — probe positively confirmed the URL is reachable.
 *   - 'dead'      — all probes failed AND the root domain itself also failed.
 *                   This is a HIGH-confidence signal that the link is bad.
 *   - 'uncertain' — direct probes failed but the root domain is reachable,
 *                   OR the user is currently offline. Either way we couldn't
 *                   conclusively prove the link is dead. Surfaced to the user
 *                   so they can verify manually, but NOT auto-selected for
 *                   deletion.
 */
export type SiteResult = 'alive' | 'dead' | 'uncertain';
export type SiteTestStatus = 'idle' | 'running' | 'done';

type State = {
  status: SiteTestStatus;
  startedAt: number | null;
  /** All URLs that this test is checking. Frozen once `start` is called. */
  urls: string[];
  /** URL → display title, preserved separately so the dialog renders even
   *  if the original bookmark gets deleted mid-test. */
  titles: Record<string, string>;
  /** Per-URL result. Keys NOT in this map are still pending. */
  results: Record<string, SiteResult>;
  start: (items: Array<{ url: string; title: string }>) => void;
  recordResult: (url: string, result: SiteResult) => void;
  markDone: () => void;
  reset: () => void;
};

export const useSiteTest = create<State>()(
  persist(
    (set, get) => ({
      status: 'idle',
      startedAt: null,
      urls: [],
      titles: {},
      results: {},

      start: items => {
        const titles: Record<string, string> = {};
        const urls: string[] = [];
        const seen = new Set<string>();
        for (const i of items) {
          if (!i.url || seen.has(i.url)) continue;
          seen.add(i.url);
          urls.push(i.url);
          titles[i.url] = i.title || i.url;
        }
        set({
          status: 'running',
          startedAt: Date.now(),
          urls,
          titles,
          results: {},
        });
      },

      recordResult: (url, result) => {
        const cur = get();
        // Ignore stragglers from a previous run that resolved after reset.
        if (!(url in cur.titles)) return;
        const next = { ...cur.results, [url]: result };
        set({ results: next });
        // Auto-flip to "done" when every URL has a result.
        if (
          cur.status === 'running' &&
          cur.urls.every(u => u in next)
        ) {
          set({ status: 'done' });
        }
      },

      markDone: () => set({ status: 'done' }),

      reset: () =>
        set({
          status: 'idle',
          startedAt: null,
          urls: [],
          titles: {},
          results: {},
        }),
    }),
    {
      name: 'glass-start:site-test',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Lightweight derived helpers (computed in component selectors).
export function getProgress(state: State): {
  done: number;
  total: number;
  dead: number;
  uncertain: number;
} {
  const total = state.urls.length;
  const done = Object.keys(state.results).length;
  let dead = 0;
  let uncertain = 0;
  for (const r of Object.values(state.results)) {
    if (r === 'dead') dead++;
    else if (r === 'uncertain') uncertain++;
  }
  return { done, total, dead, uncertain };
}
