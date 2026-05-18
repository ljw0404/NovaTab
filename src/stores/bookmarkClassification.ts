import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ClassifiedItem = { url: string; title: string };
export type Category = { id: string; name: string; items: ClassifiedItem[] };

/**
 * In-progress classification state. Persisted so that a refresh during a
 * running classification doesn't lose the streaming context (reasoning text
 * and how many bytes the model had produced). We can't *resume* the network
 * stream, but we can show the user "上次分类进行到一半被打断" instead of a
 * blank state.
 */
export type ClassifyProgress = {
  startedAt: number;
  bookmarkCount: number;
  reasoning: string;
  bytesReceived: number;
  /** Set to true when the engine boots and finds an orphaned `inProgress`
   *  (i.e. the page was refreshed mid-stream — the original fetch is dead). */
  interrupted?: boolean;
};

type State = {
  /** The cached AI classification result. null = never been classified. */
  categories: Category[] | null;
  classifiedAt: number | null;
  /** When true, the UI shows the original Chrome bookmarks even if `categories`
   *  is populated. This lets the user toggle back to AI view without losing
   *  the cached result. */
  showOriginal: boolean;
  /** Non-null while a classification is running OR was interrupted. */
  inProgress: ClassifyProgress | null;
  /** Result of a finished classify run, awaiting the user's "apply". When
   *  non-null, the AI classify dialog shows the preview UI. */
  pendingPreview: Category[] | null;
  /** Last error message from a failed classify run. */
  lastError: string | null;
  setCategories: (cats: Category[] | null) => void;
  setPendingPreview: (cats: Category[] | null) => void;
  setLastError: (err: string | null) => void;
  markInProgressInterrupted: () => void;
  /** Soft reset — keep AI cache, just show original. */
  showOriginalView: () => void;
  /** Bring back the AI-organized view if a cache exists. */
  restoreAiView: () => void;
  /** Hard reset — discard the AI cache entirely (used by "re-classify"). */
  clearCache: () => void;
  /** Mark a new classification run as started. */
  beginClassify: (bookmarkCount: number) => void;
  /** Update the streaming progress (reasoning + bytes). Cheap to call. */
  updateProgress: (patch: Partial<Omit<ClassifyProgress, 'startedAt' | 'bookmarkCount'>>) => void;
  /** Clear the in-progress marker (on success / abort / error). */
  endClassify: () => void;
};

export const useBookmarkClassification = create<State>()(
  persist(
    (set, get) => ({
      categories: null,
      classifiedAt: null,
      showOriginal: false,
      inProgress: null,
      pendingPreview: null,
      lastError: null,
      setCategories: cats =>
        set({
          categories: cats,
          classifiedAt: cats ? Date.now() : null,
          showOriginal: false,
          inProgress: null,
          pendingPreview: null,
          lastError: null,
        }),
      showOriginalView: () => set({ showOriginal: true }),
      restoreAiView: () => set({ showOriginal: false }),
      clearCache: () =>
        set({
          categories: null,
          classifiedAt: null,
          showOriginal: false,
          inProgress: null,
          pendingPreview: null,
          lastError: null,
        }),
      beginClassify: bookmarkCount =>
        set({
          inProgress: {
            startedAt: Date.now(),
            bookmarkCount,
            reasoning: '',
            bytesReceived: 0,
            interrupted: false,
          },
          // Starting fresh clears any stale result/error from a previous run.
          pendingPreview: null,
          lastError: null,
        }),
      updateProgress: patch => {
        const cur = get().inProgress;
        if (!cur) return;
        set({ inProgress: { ...cur, ...patch } });
      },
      endClassify: () => set({ inProgress: null }),
      setPendingPreview: cats => set({ pendingPreview: cats }),
      setLastError: err => set({ lastError: err }),
      markInProgressInterrupted: () => {
        const cur = get().inProgress;
        if (!cur || cur.interrupted) return;
        set({ inProgress: { ...cur, interrupted: true } });
      },
    }),
    {
      name: 'glass-start:bookmark-classification',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        categories: state.categories,
        classifiedAt: state.classifiedAt,
        showOriginal: state.showOriginal,
        inProgress: state.inProgress,
      }),
    }
  )
);
