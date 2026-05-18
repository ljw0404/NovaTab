/**
 * Background driver for the AI bookmark-classification request.
 *
 * Why a separate "engine" for what is fundamentally one fetch call?
 *  - The dialog is just a viewer — opening/closing it must NOT cancel the
 *    in-flight request.
 *  - Progress (reasoning + bytes) is persisted to the store, so the toolbar
 *    button can show a compact summary even when the dialog is closed.
 *  - On page refresh the original streaming fetch dies. We can't resume it,
 *    but we can mark the leftover `inProgress` state as `interrupted` so the
 *    UI offers a clean "retry / discard" choice instead of a blank screen.
 *
 * State lives in `bookmarkClassification`; this module owns the AbortController
 * and persistence throttling.
 */
import {
  useBookmarkClassification,
  type Category,
} from '@/stores/bookmarkClassification';
import { classifyBookmarks } from './ai/classify';
import { ensureCurrentEndpointAccess } from './ai/host-access';

let abortController: AbortController | null = null;

export function isAiClassifyActive(): boolean {
  return abortController !== null;
}

export function cancelAiClassify(): void {
  abortController?.abort();
  abortController = null;
  // Caller decides what to do with inProgress (clear it, or leave for the
  // user to see "stopped" state). We don't touch the store here so the UI
  // controls the post-cancel transition.
}

/**
 * Boot-time reconciliation. If the persisted `inProgress` is non-null but no
 * controller is alive (we just loaded the page), that means a refresh killed
 * the previous fetch. Mark it `interrupted: true` so the UI distinguishes
 * "currently running" from "was running, now orphaned".
 */
export function bootAiClassifyEngine(): void {
  if (isAiClassifyActive()) return;
  const state = useBookmarkClassification.getState();
  if (state.inProgress && !state.inProgress.interrupted) {
    useBookmarkClassification.getState().markInProgressInterrupted();
  }
}

export type StartOutcome =
  | { ok: true; preview: Category[] }
  | { ok: false; error: string; reason?: 'permission_denied' | 'invalid_host' };

export async function startAiClassify(
  bookmarks: Array<{ url: string; title: string }>
): Promise<StartOutcome> {
  if (abortController) {
    return { ok: false, error: 'already_running' };
  }
  if (bookmarks.length === 0) {
    return { ok: false, error: 'no_bookmarks' };
  }

  // Pre-flight: confirm we have cross-origin access to the AI endpoint before
  // we burn UI time on "running" state.
  const access = await ensureCurrentEndpointAccess();
  if (!access.ok) {
    return {
      ok: false,
      error: access.reason === 'denied' ? 'permission_denied' : 'invalid_host',
      reason: access.reason === 'denied' ? 'permission_denied' : 'invalid_host',
    };
  }

  abortController = new AbortController();
  const store = useBookmarkClassification.getState();
  store.beginClassify(bookmarks.length);

  // Persisting every streamed token would hammer localStorage. Throttle to
  // ≤ once per 500ms so a mid-stream refresh recovers a recent snapshot.
  let curReasoning = '';
  let curBytes = 0;
  let lastPersist = 0;
  const persistThrottled = () => {
    const now = Date.now();
    if (now - lastPersist < 500) return;
    lastPersist = now;
    useBookmarkClassification.getState().updateProgress({
      reasoning: curReasoning,
      bytesReceived: curBytes,
    });
  };

  try {
    const result = await classifyBookmarks(
      bookmarks,
      {
        onReasoning: total => {
          curReasoning = total;
          persistThrottled();
        },
        onContent: total => {
          curBytes = total.length;
          persistThrottled();
        },
      },
      abortController.signal
    );
    // Flush the latest progress one last time before clearing inProgress so
    // the persisted snapshot lines up with what the user just saw.
    useBookmarkClassification.getState().updateProgress({
      reasoning: curReasoning,
      bytesReceived: curBytes,
    });
    useBookmarkClassification.getState().setPendingPreview(result);
    return { ok: true, preview: result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Abort is user-initiated; don't surface as an error.
    if (msg.toLowerCase().includes('abort')) {
      return { ok: false, error: 'aborted' };
    }
    useBookmarkClassification.getState().setLastError(msg);
    return { ok: false, error: msg };
  } finally {
    abortController = null;
    useBookmarkClassification.getState().endClassify();
  }
}
