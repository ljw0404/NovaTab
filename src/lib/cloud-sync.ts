import { useSettings } from '@/stores/settings';
import type { Locale } from '@/i18n/messages';
import type { Category } from '@/stores/bookmarkClassification';

export const SYNC_KEY = 'glass-start:sync-envelope';

// Bookmark classification is too big for a single 8KB chrome.storage.sync
// item, so we shard its JSON across these keys.
export const CLS_META_KEY = 'glass-start:cls-meta';
export const CLS_CHUNK_PREFIX = 'glass-start:cls:';
const CLS_CHUNK_MAX_BYTES = 7000;

// Identifies the previously-signed-in user so that after a reinstall (which
// wipes localStorage and therefore useCloudSync.user) the engine can come
// back up automatically and pull AI classification + settings down from
// chrome.storage.sync without the user having to click "Sign in" again.
export const USER_KEY = 'glass-start:user';

/**
 * Sync envelope no longer carries pins/folders: those live in the HubTabPinData
 * Chrome bookmark folder which Chrome syncs natively across devices. This
 * envelope is just for our settings.
 */
export type SyncEnvelope = {
  version: 1;
  updatedAt: number;
  settings: {
    theme?: 'light' | 'dark' | 'system';
    searchEngineId?: string;
    locale?: Locale;
    showSeconds?: boolean;
    customColors?: string[];
    wallpaperUrl?: string;
    wallpaperOverlay?: number;
    wallpaperBlur?: number;
    skipDeleteConfirm?: boolean;
  };
};

export type ChromeUser = { id: string; email: string };

export function hasChromeSync(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.sync;
}

export function hasIdentityApi(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.identity?.getProfileUserInfo;
}

export async function requestIdentityPermission(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false;
  return new Promise(resolve => {
    chrome.permissions.request(
      { permissions: ['identity', 'identity.email'] },
      ok => resolve(!!ok)
    );
  });
}

export async function getCurrentUser(): Promise<ChromeUser | null> {
  if (!hasIdentityApi()) return null;
  return new Promise(resolve => {
    try {
      chrome.identity.getProfileUserInfo(
        { accountStatus: 'ANY' as chrome.identity.AccountStatus },
        info => {
          if (info && info.email) resolve({ id: info.id, email: info.email });
          else resolve(null);
        }
      );
    } catch {
      resolve(null);
    }
  });
}

export async function readRemote(): Promise<SyncEnvelope | null> {
  if (!hasChromeSync()) return null;
  return new Promise(resolve => {
    chrome.storage.sync.get(SYNC_KEY, result => {
      const env = result[SYNC_KEY] as SyncEnvelope | undefined;
      resolve(env ?? null);
    });
  });
}

export async function writeRemote(env: SyncEnvelope): Promise<void> {
  if (!hasChromeSync()) return;
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [SYNC_KEY]: env }, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

/**
 * Remember which user opted into cloud sync, in a place that survives a
 * full reinstall — chrome.storage.sync is bound to the user's Google
 * account, so the email follows them across browsers/installs as long as
 * Chrome sync is enabled.
 */
export async function rememberUser(user: ChromeUser): Promise<void> {
  if (!hasChromeSync()) return;
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [USER_KEY]: user }, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

export async function forgetUser(): Promise<void> {
  if (!hasChromeSync()) return;
  return new Promise(resolve => {
    chrome.storage.sync.remove(USER_KEY, () => resolve());
  });
}

export async function readRememberedUser(): Promise<ChromeUser | null> {
  if (!hasChromeSync()) return null;
  return new Promise(resolve => {
    chrome.storage.sync.get(USER_KEY, res => {
      const u = res[USER_KEY] as ChromeUser | undefined;
      resolve(u && u.email ? u : null);
    });
  });
}

export function readLocal(): SyncEnvelope {
  const s = useSettings.getState();
  return {
    version: 1,
    updatedAt: Date.now(),
    settings: {
      theme: s.theme,
      searchEngineId: s.searchEngineId,
      locale: s.locale,
      showSeconds: s.showSeconds,
      customColors: s.customColors,
      wallpaperUrl: s.wallpaperUrl,
      wallpaperOverlay: s.wallpaperOverlay,
      wallpaperBlur: s.wallpaperBlur,
      skipDeleteConfirm: s.skipDeleteConfirm,
    },
  };
}

export function applyEnvelopeToLocal(env: SyncEnvelope): void {
  const s = useSettings.getState();
  if (env.settings.theme !== undefined) s.setTheme(env.settings.theme);
  if (env.settings.searchEngineId !== undefined) s.setSearchEngineId(env.settings.searchEngineId);
  if (env.settings.locale !== undefined) s.setLocale(env.settings.locale);
  if (env.settings.showSeconds !== undefined) s.setShowSeconds(env.settings.showSeconds);
  if (env.settings.customColors !== undefined) s.setCustomColors(env.settings.customColors);
  if (env.settings.wallpaperUrl !== undefined) s.setWallpaperUrl(env.settings.wallpaperUrl);
  if (env.settings.wallpaperOverlay !== undefined) s.setWallpaperOverlay(env.settings.wallpaperOverlay);
  if (env.settings.wallpaperBlur !== undefined) s.setWallpaperBlur(env.settings.wallpaperBlur);
  if (env.settings.skipDeleteConfirm !== undefined) s.setSkipDeleteConfirm(env.settings.skipDeleteConfirm);
}

export function mergeEnvelopes(local: SyncEnvelope, remote: SyncEnvelope): SyncEnvelope {
  // Colors: union deduplicated, capped at 3.
  const colorSet = new Set<string>([
    ...(local.settings.customColors ?? []),
    ...(remote.settings.customColors ?? []),
  ]);
  const mergedColors = Array.from(colorSet).slice(0, 3);

  // Scalars: local wins (the user is on this device — their current choice).
  return {
    version: 1,
    updatedAt: Date.now(),
    settings: {
      ...remote.settings,
      ...local.settings,
      customColors: mergedColors,
    },
  };
}

export function hasMeaningfulData(env: SyncEnvelope | null | undefined): boolean {
  if (!env) return false;
  const s = env.settings;
  return (
    (s.customColors?.length ?? 0) > 0 ||
    !!s.wallpaperUrl ||
    s.theme !== undefined ||
    s.locale !== undefined ||
    s.searchEngineId !== undefined
  );
}

/**
 * Detect whether the local settings store has ever been user-modified on
 * this device. zustand `persist` only writes to localStorage when state
 * actually changes — on a fresh install (or after a "wipe local data") the
 * `glass-start:settings` key simply doesn't exist yet.
 *
 * Why we need this: `readLocal()` always returns a populated envelope (the
 * defaults: theme='dark', searchEngineId='google', etc.), so without a
 * separate signal there's no way to tell "user actually picked dark theme"
 * apart from "we just installed and dark is the default". Conflating the
 * two lets fresh-install defaults overwrite real remote data during merge.
 *
 * Callers (firstSync, reconcileOnStart) short-circuit to "pull remote
 * wholesale" when this returns true.
 */
export function isLocalPristine(): boolean {
  try {
    return localStorage.getItem('glass-start:settings') == null;
  } catch {
    return false;
  }
}

export function envelopesEqual(a: SyncEnvelope, b: SyncEnvelope): boolean {
  // Compare content (ignore updatedAt — it always differs).
  return JSON.stringify(a.settings) === JSON.stringify(b.settings);
}

// ─── AI bookmark classification sync (chunked) ───────────────────────────────

export type ClassificationPayload = {
  version: 1;
  classifiedAt: number;
  categories: Category[];
};

/** Marker written when the user clears the AI classification. */
export type ClassificationCleared = { cleared: true; classifiedAt: number };

type ClsMeta = {
  version: 1;
  classifiedAt: number;
  chunks: number;
  cleared: boolean;
};

function syncGet<T = unknown>(keys: string | string[]): Promise<Record<string, T>> {
  return new Promise(resolve => {
    chrome.storage.sync.get(keys, res => resolve(res as Record<string, T>));
  });
}

function syncSet(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(values, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

function syncRemove(keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.remove(keys, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

async function clearExistingClsChunks(): Promise<void> {
  const res = await syncGet<ClsMeta | undefined>(CLS_META_KEY);
  const meta = res[CLS_META_KEY];
  if (!meta || !meta.chunks) return;
  const keys: string[] = [];
  for (let i = 0; i < meta.chunks; i++) keys.push(`${CLS_CHUNK_PREFIX}${i}`);
  await syncRemove(keys);
}

export async function readRemoteClassification(): Promise<
  ClassificationPayload | ClassificationCleared | null
> {
  if (!hasChromeSync()) return null;
  const metaRes = await syncGet<ClsMeta | undefined>(CLS_META_KEY);
  const meta = metaRes[CLS_META_KEY];
  if (!meta) return null;
  if (meta.cleared) {
    return { cleared: true, classifiedAt: meta.classifiedAt };
  }
  if (!meta.chunks) return null;

  const chunkKeys: string[] = [];
  for (let i = 0; i < meta.chunks; i++) chunkKeys.push(`${CLS_CHUNK_PREFIX}${i}`);
  const chunks = await syncGet<string | undefined>(chunkKeys);

  let json = '';
  for (let i = 0; i < meta.chunks; i++) {
    const c = chunks[`${CLS_CHUNK_PREFIX}${i}`];
    if (typeof c !== 'string') return null; // missing chunk → treat as absent
    json += c;
  }
  try {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.categories)) return null;
    return parsed as ClassificationPayload;
  } catch {
    return null;
  }
}

export async function writeRemoteClassification(
  env: ClassificationPayload | ClassificationCleared
): Promise<void> {
  if (!hasChromeSync()) return;

  // Drop any old chunks first so a smaller payload doesn't leave stragglers.
  await clearExistingClsChunks();

  if ('cleared' in env) {
    await syncSet({
      [CLS_META_KEY]: {
        version: 1,
        classifiedAt: env.classifiedAt,
        chunks: 0,
        cleared: true,
      } satisfies ClsMeta,
    });
    return;
  }

  const json = JSON.stringify({
    version: env.version,
    classifiedAt: env.classifiedAt,
    categories: env.categories,
  });

  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += CLS_CHUNK_MAX_BYTES) {
    chunks.push(json.slice(i, i + CLS_CHUNK_MAX_BYTES));
  }

  // Total size sanity check — sync quota is 102_400 bytes. Leave headroom
  // for the settings envelope (~2KB) and the meta key.
  const totalBytes = chunks.reduce((n, c) => n + c.length, 0);
  if (totalBytes > 95_000) {
    throw new Error(
      `Classification too large to sync (${totalBytes} bytes, limit ~95KB)`
    );
  }

  const writes: Record<string, unknown> = {
    [CLS_META_KEY]: {
      version: 1,
      classifiedAt: env.classifiedAt,
      chunks: chunks.length,
      cleared: false,
    } satisfies ClsMeta,
  };
  for (let i = 0; i < chunks.length; i++) {
    writes[`${CLS_CHUNK_PREFIX}${i}`] = chunks[i];
  }
  await syncSet(writes);
}
