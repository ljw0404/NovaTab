import { useSettings } from '@/stores/settings';
import { useCloudSync } from '@/stores/cloudSync';
import { useBookmarkClassification } from '@/stores/bookmarkClassification';
import {
  applyEnvelopeToLocal,
  hasChromeSync,
  mergeEnvelopes,
  readLocal,
  readRemote,
  readRemoteClassification,
  writeRemoteClassification,
  SYNC_KEY,
  CLS_META_KEY,
  writeRemote,
  type SyncEnvelope,
} from './cloud-sync';

// Engine state — module-level since there's only ever one sync engine per page.
let active = false;
let unsubSettings: (() => void) | null = null;
let unsubClassification: (() => void) | null = null;
let storageListener:
  | ((
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName
    ) => void)
  | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushClsTimer: ReturnType<typeof setTimeout> | null = null;
let lastClsClassifiedAt: number | null = null;
let applyingClassification = false;

// `lastHash` is what we last either pushed or pulled — used to detect echoes
// of our own writes and to skip no-op pushes.
let lastHash = '';
// While `applyingRemote` is true, local subscribers do NOT schedule pushes —
// prevents the loop: remote change → apply → local change → push → echo back.
let applyingRemote = false;

const DEBOUNCE_MS = 1000;

function envHash(env: { settings: SyncEnvelope['settings'] }): string {
  return JSON.stringify({ s: env.settings });
}

function setStatus(s: 'idle' | 'syncing' | 'error', error: string | null = null) {
  useCloudSync.setState({ status: s, error });
}

function markSyncedNow() {
  useCloudSync.setState({ lastSyncedAt: Date.now() });
}

async function pushNow() {
  if (!active) return;
  if (applyingRemote) return;
  const env = readLocal();
  const hash = envHash(env);
  if (hash === lastHash) return;
  setStatus('syncing');
  try {
    await writeRemote(env);
    lastHash = hash;
    markSyncedNow();
    setStatus('idle');
  } catch (e) {
    setStatus('error', e instanceof Error ? e.message : String(e));
  }
}

function scheduleDebouncedPush() {
  if (!active || applyingRemote) return;
  if (pushTimer != null) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushNow();
  }, DEBOUNCE_MS);
}

/**
 * Apply a remote envelope to local stores AND update lastHash, with
 * push suppressed so we don't echo it back.
 */
export function applyRemoteEnvelopeAndMark(env: SyncEnvelope) {
  applyingRemote = true;
  try {
    applyEnvelopeToLocal(env);
  } finally {
    applyingRemote = false;
  }
  lastHash = envHash(env);
  markSyncedNow();
}

/**
 * Tell the engine we just wrote `env` to remote (or otherwise know it's
 * authoritative). Use this after a manual writeRemote so the engine's
 * subsequent change-detection doesn't fire a redundant re-push.
 */
export function markEnvelopeWritten(env: SyncEnvelope) {
  lastHash = envHash(env);
  markSyncedNow();
}

// ─── Bookmark classification sync ────────────────────────────────────────────
//
// Strategy: last-write-wins by `classifiedAt`. A merge isn't meaningful for
// AI classifications (different runs produce different category structures),
// so we just take whichever side is newer.

async function pushClassificationNow() {
  if (!active || applyingClassification) return;
  const st = useBookmarkClassification.getState();
  const ts = st.classifiedAt;

  // No local classification at all — nothing to do unless we previously
  // synced one (in which case write a "cleared" marker so other devices
  // know to drop theirs too).
  if (ts == null && lastClsClassifiedAt == null) return;

  setStatus('syncing');
  try {
    if (st.categories === null) {
      // User cleared the classification locally. Write a tombstone so other
      // devices pull `cleared` and drop their cache too.
      await writeRemoteClassification({
        cleared: true,
        classifiedAt: ts ?? Date.now(),
      });
    } else if (ts != null) {
      await writeRemoteClassification({
        version: 1,
        classifiedAt: ts,
        categories: st.categories,
      });
    }
    lastClsClassifiedAt = ts;
    markSyncedNow();
    setStatus('idle');
  } catch (e) {
    setStatus('error', e instanceof Error ? e.message : String(e));
  }
}

function scheduleClassificationPush() {
  if (!active || applyingClassification) return;
  const st = useBookmarkClassification.getState();
  // Push only on classifiedAt change (real classification mutation), not on
  // local-only flags like `showOriginal`. Catches setCategories + clearCache.
  if (st.classifiedAt === lastClsClassifiedAt) return;
  if (pushClsTimer != null) clearTimeout(pushClsTimer);
  pushClsTimer = setTimeout(() => {
    pushClsTimer = null;
    pushClassificationNow();
  }, DEBOUNCE_MS);
}

async function reconcileClassificationOnStart() {
  try {
    const remote = await readRemoteClassification();
    const local = useBookmarkClassification.getState();
    const localTs = local.classifiedAt ?? 0;
    const remoteTs = remote ? remote.classifiedAt : 0;

    if (!remote) {
      // Remote has nothing — push local if present.
      if (local.categories !== null) {
        lastClsClassifiedAt = null;
        await pushClassificationNow();
      } else {
        lastClsClassifiedAt = null;
      }
      return;
    }

    if (remoteTs > localTs) {
      // Remote is newer (or local empty + remote present) — apply it.
      applyRemoteClassification(remote);
    } else if (localTs > remoteTs) {
      // Local is newer — push.
      lastClsClassifiedAt = remoteTs;
      await pushClassificationNow();
    } else {
      // Same timestamp — assume we're in sync; just record the marker.
      lastClsClassifiedAt = remoteTs;
    }
  } catch (e) {
    console.warn('[cloud-sync] classification reconcile failed', e);
  }
}

function applyRemoteClassification(
  remote: Awaited<ReturnType<typeof readRemoteClassification>>
) {
  if (!remote) return;
  applyingClassification = true;
  try {
    if ('cleared' in remote) {
      useBookmarkClassification.getState().clearCache();
      useBookmarkClassification.setState({ classifiedAt: remote.classifiedAt });
    } else {
      useBookmarkClassification.setState({
        categories: remote.categories,
        classifiedAt: remote.classifiedAt,
      });
    }
  } finally {
    applyingClassification = false;
  }
  lastClsClassifiedAt = remote.classifiedAt;
  markSyncedNow();
}

/**
 * Reconcile on engine startup: auto-merge local + remote so that pins/colors
 * from either side are preserved. Other settings prefer local.
 */
async function reconcileOnStart() {
  setStatus('syncing');
  try {
    const local = readLocal();
    const remote = await readRemote();
    if (!remote) {
      await writeRemote(local);
      lastHash = envHash(local);
      markSyncedNow();
      setStatus('idle');
      return;
    }
    const merged = mergeEnvelopes(local, remote);
    const mergedHash = envHash(merged);
    const remoteHash = envHash(remote);
    if (mergedHash !== remoteHash) {
      await writeRemote(merged);
    }
    applyRemoteEnvelopeAndMark(merged);
    setStatus('idle');
  } catch (e) {
    setStatus('error', e instanceof Error ? e.message : String(e));
  }
}

export function startCloudSync() {
  if (active) return;
  if (!hasChromeSync()) return;
  active = true;

  // Initial reconciliation — pull anything new from remote, push any local
  // changes that happened while offline.
  reconcileOnStart();
  reconcileClassificationOnStart();

  // Push on any local settings change (debounced). Pins are NOT in this
  // envelope — they live in Chrome bookmarks under HubTabPinData and sync
  // via Chrome's own bookmark sync.
  unsubSettings = useSettings.subscribe(scheduleDebouncedPush);

  // Push when AI bookmark classification changes (debounced).
  unsubClassification = useBookmarkClassification.subscribe(
    scheduleClassificationPush
  );

  // Pull on any remote change from another device.
  storageListener = (changes, area) => {
    if (area !== 'sync') return;

    // Settings envelope
    const settingsChange = changes[SYNC_KEY];
    if (settingsChange && settingsChange.newValue) {
      const newEnv = settingsChange.newValue as SyncEnvelope;
      const hash = envHash(newEnv);
      if (hash !== lastHash) applyRemoteEnvelopeAndMark(newEnv);
    }

    // Classification meta — when it changes, re-read the whole classification
    // (chunks + meta arrive in the same event but we just refetch for safety).
    const clsMetaChange = changes[CLS_META_KEY];
    if (clsMetaChange) {
      void (async () => {
        const remote = await readRemoteClassification();
        if (!remote) return;
        // Echo-suppression: ignore if it matches what we just pushed.
        if (remote.classifiedAt === lastClsClassifiedAt) return;
        applyRemoteClassification(remote);
      })();
    }
  };
  chrome.storage.onChanged.addListener(storageListener);
}

export function stopCloudSync() {
  if (!active) return;
  active = false;
  if (pushTimer != null) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (pushClsTimer != null) {
    clearTimeout(pushClsTimer);
    pushClsTimer = null;
  }
  unsubSettings?.();
  unsubClassification?.();
  if (storageListener) {
    chrome.storage.onChanged.removeListener(storageListener);
  }
  unsubSettings = unsubClassification = storageListener = null;
  lastHash = '';
  lastClsClassifiedAt = null;
}

export function isCloudSyncActive(): boolean {
  return active;
}
