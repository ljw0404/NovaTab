/**
 * Local backup of the user's HubTabPinData contents. If the user (or anything
 * else) deletes the HubTabPinData folder from Chrome's bookmark manager, we
 * use this mirror to offer a one-click restore.
 *
 * The mirror is updated on every successful read of the hub — so it always
 * tracks the latest known good state.
 */
import type { SpeedDialEntry } from './hub-folder';

const MIRROR_KEY = 'glass-start:hub-mirror';

type MirrorFile = {
  version: 1;
  savedAt: number;
  entries: SpeedDialEntry[];
};

export function saveMirror(entries: SpeedDialEntry[]): void {
  try {
    const file: MirrorFile = { version: 1, savedAt: Date.now(), entries };
    localStorage.setItem(MIRROR_KEY, JSON.stringify(file));
  } catch {
    // Quota / private mode — best effort.
  }
}

export function readMirror(): SpeedDialEntry[] | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MirrorFile;
    if (!parsed?.entries || !Array.isArray(parsed.entries)) return null;
    return parsed.entries;
  } catch {
    return null;
  }
}

export function clearMirror(): void {
  try {
    localStorage.removeItem(MIRROR_KEY);
  } catch {
    /* noop */
  }
}

export function mirrorTimestamp(): number | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MirrorFile;
    return typeof parsed?.savedAt === 'number' ? parsed.savedAt : null;
  } catch {
    return null;
  }
}
