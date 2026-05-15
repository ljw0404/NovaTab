/**
 * Operations on the user's HubTabPinData Chrome bookmark folder.
 *
 * Every "Pin" the user sees on the homepage is a real Chrome bookmark inside
 * this folder. Add / edit / delete / move all go through the Chrome bookmarks
 * API — chrome.bookmarks.create / update / remove / move — and Chrome's own
 * cross-device sync transparently propagates changes.
 */

export const HUB_FOLDER_NAME = 'HubTabPinData';
// Standard Chrome bookmark root IDs:
//   '1' = Bookmarks Bar    '2' = Other Bookmarks    '3' = Mobile Bookmarks
// We host the hub under "Other Bookmarks" to avoid cluttering the bookmarks
// bar — see UX decision in conversation history.
export const HUB_PARENT_ID = '2';

export type SpeedDialPin = {
  id: string;
  kind: 'pin';
  title: string;
  url: string;
};

export type SpeedDialFolder = {
  id: string;
  kind: 'folder';
  title: string;
  children: SpeedDialPin[];
};

export type SpeedDialEntry = SpeedDialPin | SpeedDialFolder;

export function hasBookmarksApi(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    !!chrome.bookmarks &&
    !!chrome.bookmarks.search
  );
}

function clearLastError(): void {
  // Touching lastError "clears" the warning even if we don't read it elsewhere.
  void chrome.runtime?.lastError;
}

export async function findHubFolder(): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  if (!hasBookmarksApi()) return null;
  return new Promise(resolve => {
    chrome.bookmarks.search({ title: HUB_FOLDER_NAME }, results => {
      clearLastError();
      const folder = results.find(
        r => !r.url && r.parentId === HUB_PARENT_ID && r.title === HUB_FOLDER_NAME
      );
      resolve(folder ?? null);
    });
  });
}

export function createHubFolder(): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create(
      { parentId: HUB_PARENT_ID, title: HUB_FOLDER_NAME },
      node => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve(node);
      }
    );
  });
}

export async function getOrCreateHubFolder(): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const existing = await findHubFolder();
  if (existing) return existing;
  return createHubFolder();
}

/**
 * Read the hub's children (one level) and each sub-folder's children
 * (one more level). We don't support deeper nesting in the UI.
 */
export function readEntries(hubId: string): Promise<SpeedDialEntry[]> {
  return new Promise(resolve => {
    chrome.bookmarks.getChildren(hubId, children => {
      clearLastError();
      if (!children || children.length === 0) {
        resolve([]);
        return;
      }
      const entries: SpeedDialEntry[] = [];
      const folderIds: string[] = [];
      for (const c of children) {
        if (c.url) {
          entries.push({
            id: c.id,
            kind: 'pin',
            title: c.title || c.url,
            url: c.url,
          });
        } else {
          entries.push({ id: c.id, kind: 'folder', title: c.title, children: [] });
          folderIds.push(c.id);
        }
      }
      if (folderIds.length === 0) {
        resolve(entries);
        return;
      }
      let pending = folderIds.length;
      for (const fid of folderIds) {
        chrome.bookmarks.getChildren(fid, sub => {
          clearLastError();
          const folder = entries.find(
            e => e.id === fid && e.kind === 'folder'
          ) as SpeedDialFolder | undefined;
          if (folder) {
            folder.children = (sub ?? [])
              .filter(s => s.url)
              .map(s => ({
                id: s.id,
                kind: 'pin' as const,
                title: s.title || s.url!,
                url: s.url!,
              }));
          }
          pending--;
          if (pending === 0) resolve(entries);
        });
      }
    });
  });
}

export function createPin(
  parentId: string,
  title: string,
  url: string
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create({ parentId, title, url }, node => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(node);
    });
  });
}

export function createFolderIn(
  parentId: string,
  title: string
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create({ parentId, title }, node => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(node);
    });
  });
}

export function updateNode(
  id: string,
  changes: { title?: string; url?: string }
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.update(id, changes, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

export function removeNode(id: string, isFolder: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const fn = isFolder ? chrome.bookmarks.removeTree : chrome.bookmarks.remove;
    fn(id, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

export function moveNode(
  id: string,
  destination: { parentId?: string; index?: number }
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.move(id, destination, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

function normalize(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function findPinByUrl(
  entries: SpeedDialEntry[],
  url: string
): SpeedDialPin | null {
  const norm = normalize(url);
  for (const e of entries) {
    if (e.kind === 'pin' && normalize(e.url) === norm) return e;
    if (e.kind === 'folder') {
      const c = e.children.find(c => normalize(c.url) === norm);
      if (c) return c;
    }
  }
  return null;
}

export function findEntryById(
  entries: SpeedDialEntry[],
  id: string
): SpeedDialEntry | null {
  for (const e of entries) {
    if (e.id === id) return e;
    if (e.kind === 'folder') {
      const child = e.children.find(c => c.id === id);
      if (child) return child;
    }
  }
  return null;
}
