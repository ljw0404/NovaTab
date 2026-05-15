/**
 * Backup & restore for everything the extension owns in localStorage.
 *
 * What's included: all `glass-start:*` keys (settings, pins, AI config, etc.)
 * What's NOT included: the user's actual Chrome bookmarks / browsing history
 *   (those belong to Chrome and we never copy them); and the cloud-sync user
 *   identity (runtime state, not user data).
 */

const PREFIX = 'glass-start:';
// Excluded from backup — runtime state, not user-authored data.
const EXCLUDED_KEYS = new Set<string>(['glass-start:cloud-sync']);

export type BackupFile = {
  app: 'glass-start';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
};

function isBackupKey(key: string): boolean {
  return key.startsWith(PREFIX) && !EXCLUDED_KEYS.has(key);
}

export function buildBackup(): BackupFile {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isBackupKey(key)) continue;
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw;
    }
  }
  return {
    app: 'glass-start',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackup(file: BackupFile = buildBackup()): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0, 10);
  a.download = `glass-start-backup-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Not valid JSON');
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { app?: unknown }).app !== 'glass-start'
  ) {
    throw new Error('Not a NovaTab backup file');
  }
  const obj = parsed as Partial<BackupFile>;
  if (typeof obj.version !== 'number') {
    throw new Error('Backup is missing version');
  }
  if (!obj.data || typeof obj.data !== 'object') {
    throw new Error('Backup is missing data');
  }
  return parsed as BackupFile;
}

/**
 * Overwrite localStorage entries from a backup file. Stores must be
 * re-hydrated (or page reloaded) for the change to take effect.
 */
export function applyBackup(file: BackupFile): void {
  for (const [key, value] of Object.entries(file.data)) {
    if (!isBackupKey(key)) continue;
    localStorage.setItem(key, JSON.stringify(value));
  }
}

/** Remove all extension-owned localStorage entries (except excluded). */
export function resetAllLocal(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isBackupKey(key)) toRemove.push(key);
  }
  for (const k of toRemove) localStorage.removeItem(k);
}

export type BackupSummary = {
  pins: number;
  customColors: number;
  hasWallpaper: boolean;
  keys: number;
};

/** Best-effort summary of what's inside a backup, for the import preview. */
export function summarizeBackup(file: BackupFile): BackupSummary {
  // Pin count comes from the hub-mirror snapshot (the localStorage backup of
  // HubTabPinData). Older backups used `glass-start:speed-dial` — fall back to
  // that for compatibility.
  const mirror = file.data['glass-start:hub-mirror'] as
    | { entries?: Array<{ kind?: string; children?: unknown[] }> }
    | undefined;
  let pinCount = 0;
  if (mirror?.entries && Array.isArray(mirror.entries)) {
    for (const e of mirror.entries) {
      if (e.kind === 'pin') pinCount++;
      else if (Array.isArray(e.children)) pinCount += e.children.length;
    }
  } else {
    const legacy = file.data['glass-start:speed-dial'] as
      | { state?: { pins?: unknown[] } }
      | undefined;
    pinCount = legacy?.state?.pins?.length ?? 0;
  }

  const settings = file.data['glass-start:settings'] as
    | {
        state?: {
          customColors?: unknown[];
          wallpaperUrl?: string;
        };
      }
    | undefined;
  return {
    pins: pinCount,
    customColors: settings?.state?.customColors?.length ?? 0,
    hasWallpaper: !!settings?.state?.wallpaperUrl,
    keys: Object.keys(file.data).length,
  };
}
