/**
 * SpeedDial is now a reactive cache of the HubTabPinData Chrome bookmark
 * folder. All mutating actions delegate to chrome.bookmarks.* via hub-folder;
 * the hub-engine's listeners refresh `entries` after each write.
 *
 * Why not persist with Zustand persist? Because Chrome bookmarks ARE the
 * source of truth (with built-in cross-device sync), and a local mirror is
 * maintained separately by hub-mirror.ts for recovery.
 */
import { create } from 'zustand';
import {
  createFolderIn,
  createPin,
  findEntryById,
  findPinByUrl,
  moveNode,
  removeNode,
  updateNode,
  type SpeedDialEntry,
} from '@/lib/hub-folder';
import { noteHubWrite } from '@/lib/hub-engine';

type State = {
  entries: SpeedDialEntry[];
  hubFolderId: string | null;
  ready: boolean;
  /** Set when the hub folder was deleted but a non-empty mirror exists. */
  missingMirror: SpeedDialEntry[] | null;

  addPin: (input: {
    title: string;
    url: string;
    folderId?: string | null;
  }) => Promise<string | null>;
  addFolder: (title: string) => Promise<string | null>;
  removeEntry: (id: string) => Promise<void>;
  updateEntry: (
    id: string,
    changes: { title?: string; url?: string }
  ) => Promise<void>;
  movePin: (pinId: string, toFolderId: string | null) => Promise<void>;
  reorderEntry: (id: string, newIndex: number) => Promise<void>;
  togglePinByUrl: (
    url: string,
    title: string
  ) => Promise<'pinned' | 'unpinned'>;
  isPinned: (url: string) => boolean;
};

function normalizeUrlInput(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const useSpeedDial = create<State>((_set, get) => ({
  entries: [],
  hubFolderId: null,
  ready: false,
  missingMirror: null,

  addPin: async ({ title, url, folderId }) => {
    const hubId = get().hubFolderId;
    if (!hubId) return null;
    const parentId = folderId ?? hubId;
    const finalUrl = normalizeUrlInput(url);
    if (!finalUrl) return null;
    noteHubWrite();
    const node = await createPin(parentId, title || finalUrl, finalUrl);
    return node.id;
  },

  addFolder: async title => {
    const hubId = get().hubFolderId;
    if (!hubId) return null;
    noteHubWrite();
    const node = await createFolderIn(hubId, title);
    return node.id;
  },

  removeEntry: async id => {
    const entry = findEntryById(get().entries, id);
    if (!entry) return;
    noteHubWrite();
    await removeNode(id, entry.kind === 'folder');
  },

  updateEntry: async (id, changes) => {
    const next: { title?: string; url?: string } = {};
    if (changes.title !== undefined) next.title = changes.title;
    if (changes.url !== undefined) next.url = normalizeUrlInput(changes.url);
    if (next.title === undefined && next.url === undefined) return;
    noteHubWrite();
    await updateNode(id, next);
  },

  movePin: async (pinId, toFolderId) => {
    const hubId = get().hubFolderId;
    if (!hubId) return;
    noteHubWrite();
    await moveNode(pinId, { parentId: toFolderId ?? hubId });
  },

  reorderEntry: async (id, newIndex) => {
    noteHubWrite();
    await moveNode(id, { index: newIndex });
  },

  togglePinByUrl: async (url, title) => {
    const hubId = get().hubFolderId;
    if (!hubId) return 'unpinned';
    const existing = findPinByUrl(get().entries, url);
    if (existing) {
      noteHubWrite();
      await removeNode(existing.id, false);
      return 'unpinned';
    }
    noteHubWrite();
    await createPin(hubId, title || url, url);
    return 'pinned';
  },

  isPinned: url => !!findPinByUrl(get().entries, url),
}));

// Re-export the entry types for convenience so existing imports of
// `import type { Pin } from '@/stores/speedDial'` still resolve. Pin is now
// the SpeedDialPin shape; older callers used { id, title, url } which is a
// subset, so they remain assignment-compatible.
export type { SpeedDialEntry, SpeedDialFolder, SpeedDialPin } from '@/lib/hub-folder';
export type Pin = import('@/lib/hub-folder').SpeedDialPin;
