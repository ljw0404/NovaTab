/**
 * Lifecycle and reactivity for the HubTabPinData bookmark folder.
 *
 *  - On boot, find or create the hub. If missing AND we have a non-empty
 *    local mirror, surface a restore prompt to the user instead.
 *  - Listen to chrome.bookmarks events so the SpeedDial cache stays in sync
 *    whether the change came from us OR from Chrome's bookmark manager.
 *  - Update the local mirror after every successful read so we can recover
 *    if the user deletes HubTabPinData from Chrome.
 */
import { useSpeedDial } from '@/stores/speedDial';
import {
  createFolderIn,
  createHubFolder,
  createPin,
  findHubFolder,
  hasBookmarksApi,
  readEntries,
  type SpeedDialEntry,
} from './hub-folder';
import { clearMirror, readMirror, saveMirror } from './hub-mirror';

let listenersRegistered = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inFlightWritesUntil = 0;

const REFRESH_DEBOUNCE_MS = 180;
// After our own write, ignore the bookmark-event echo for a small window
// so we don't double-refresh while events haven't propagated.
const WRITE_QUIET_MS = 250;

export function noteHubWrite() {
  inFlightWritesUntil = Date.now() + WRITE_QUIET_MS;
}

function scheduleRefresh() {
  if (refreshTimer != null) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refreshNow, REFRESH_DEBOUNCE_MS);
}

async function refreshNow() {
  refreshTimer = null;
  const { hubFolderId } = useSpeedDial.getState();
  if (!hubFolderId) return;
  try {
    const entries = await readEntries(hubFolderId);
    useSpeedDial.setState({ entries });
    saveMirror(entries);
  } catch {
    // Hub may have been deleted — onRemoved listener handles that path.
  }
}

function isInsideHub(
  parentId: string | undefined,
  hubId: string | null,
  entries: SpeedDialEntry[]
): boolean {
  if (!parentId || !hubId) return false;
  if (parentId === hubId) return true;
  // Parent might be a folder one level deep inside hub.
  return entries.some(e => e.kind === 'folder' && e.id === parentId);
}

async function handleHubDeleted() {
  // Snapshot current entries to mirror (they're still in store for one frame
  // after the onRemoved fired — save before clearing).
  const { entries } = useSpeedDial.getState();
  if (entries.length > 0) saveMirror(entries);
  const mirror = readMirror();
  useSpeedDial.setState({
    hubFolderId: null,
    entries: [],
    missingMirror: mirror && mirror.length > 0 ? mirror : null,
  });
  // If there's nothing to restore, silently recreate an empty hub so the user
  // doesn't get a confusing prompt for empty data.
  if (!mirror || mirror.length === 0) {
    const created = await createHubFolder().catch(() => null);
    if (created) {
      useSpeedDial.setState({
        hubFolderId: created.id,
        entries: [],
        missingMirror: null,
      });
      saveMirror([]);
    }
  }
}

function registerListeners() {
  if (listenersRegistered || !hasBookmarksApi()) return;
  if (!chrome.bookmarks.onCreated) return;
  listenersRegistered = true;

  chrome.bookmarks.onCreated.addListener((_id, node) => {
    if (Date.now() < inFlightWritesUntil) {
      // Our own write — refreshNow scheduled by our setState path will pick it up.
      scheduleRefresh();
      return;
    }
    const { hubFolderId, entries } = useSpeedDial.getState();
    if (isInsideHub(node.parentId, hubFolderId, entries)) scheduleRefresh();
  });

  chrome.bookmarks.onChanged.addListener(id => {
    const { hubFolderId, entries } = useSpeedDial.getState();
    if (id === hubFolderId) {
      // Hub was renamed in Chrome — still valid, just refresh.
      scheduleRefresh();
      return;
    }
    // Check if id is one of our tracked entries (top-level or folder child).
    const isTracked = entries.some(
      e =>
        e.id === id ||
        (e.kind === 'folder' && e.children.some(c => c.id === id))
    );
    if (isTracked) scheduleRefresh();
  });

  chrome.bookmarks.onRemoved.addListener((id, info) => {
    const { hubFolderId, entries } = useSpeedDial.getState();
    if (id === hubFolderId) {
      void handleHubDeleted();
      return;
    }
    if (isInsideHub(info.parentId, hubFolderId, entries)) scheduleRefresh();
  });

  chrome.bookmarks.onMoved.addListener((_id, info) => {
    const { hubFolderId, entries } = useSpeedDial.getState();
    if (
      isInsideHub(info.parentId, hubFolderId, entries) ||
      isInsideHub(info.oldParentId, hubFolderId, entries)
    ) {
      scheduleRefresh();
    }
  });
}

/**
 * Boot the engine. Idempotent — calling twice does no harm.
 *
 * Flow:
 *  1. If Chrome bookmarks API unavailable (preview mode), mark ready empty.
 *  2. Find hub folder.
 *     - exists → load contents, save mirror, ready.
 *     - missing + mirror has data → surface restore prompt (do NOT create).
 *     - missing + no mirror → create empty hub, ready.
 *  3. Register bookmark listeners.
 *  4. Migrate any legacy pins from the old `glass-start:speed-dial`
 *     localStorage slot into the hub (one-shot).
 */
export async function initHubEngine() {
  if (!hasBookmarksApi()) {
    useSpeedDial.setState({ ready: true });
    return;
  }

  registerListeners();

  const existing = await findHubFolder();
  if (existing) {
    const entries = await readEntries(existing.id);
    useSpeedDial.setState({
      hubFolderId: existing.id,
      entries,
      ready: true,
      missingMirror: null,
    });
    saveMirror(entries);
  } else {
    const mirror = readMirror();
    if (mirror && mirror.length > 0) {
      useSpeedDial.setState({
        hubFolderId: null,
        entries: [],
        ready: true,
        missingMirror: mirror,
      });
    } else {
      try {
        const created = await createHubFolder();
        useSpeedDial.setState({
          hubFolderId: created.id,
          entries: [],
          ready: true,
          missingMirror: null,
        });
        saveMirror([]);
      } catch {
        useSpeedDial.setState({ ready: true });
      }
    }
  }

  await migrateLegacyPins();
}

/**
 * Old format from before HubTabPinData: localStorage key
 * `glass-start:speed-dial` containing `{ state: { pins: [...] }, version: 1 }`.
 * Migrate each pin into the hub once, then clear the key.
 */
async function migrateLegacyPins() {
  const raw = localStorage.getItem('glass-start:speed-dial');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as {
      state?: { pins?: { title: string; url: string }[] };
    };
    const pins = parsed?.state?.pins ?? [];
    const { hubFolderId, entries } = useSpeedDial.getState();
    if (!hubFolderId) return;

    const existingUrls = new Set<string>();
    for (const e of entries) {
      if (e.kind === 'pin') existingUrls.add(e.url);
      else for (const c of e.children) existingUrls.add(c.url);
    }

    let created = 0;
    for (const pin of pins) {
      if (!pin?.url) continue;
      if (existingUrls.has(pin.url)) continue;
      try {
        noteHubWrite();
        await createPin(hubFolderId, pin.title || pin.url, pin.url);
        created++;
      } catch {
        // Skip bad entries.
      }
    }

    localStorage.removeItem('glass-start:speed-dial');

    if (created > 0) {
      const fresh = await readEntries(hubFolderId);
      useSpeedDial.setState({ entries: fresh });
      saveMirror(fresh);
    }
  } catch {
    // Bad legacy data — wipe so we don't retry every boot.
    localStorage.removeItem('glass-start:speed-dial');
  }
}

/**
 * Recreate HubTabPinData from the mirror, restoring the user's pins/folders
 * after they (or another tool) deleted the folder from Chrome.
 */
export async function restoreFromMirror() {
  const mirror = readMirror();
  if (!mirror) return;
  const hub = await createHubFolder();
  for (const entry of mirror) {
    try {
      noteHubWrite();
      if (entry.kind === 'pin') {
        await createPin(hub.id, entry.title, entry.url);
      } else {
        const folder = await createFolderIn(hub.id, entry.title);
        for (const child of entry.children) {
          noteHubWrite();
          await createPin(folder.id, child.title, child.url);
        }
      }
    } catch {
      // Skip entries we can't recreate.
    }
  }
  const entries = await readEntries(hub.id);
  useSpeedDial.setState({
    hubFolderId: hub.id,
    entries,
    missingMirror: null,
  });
  saveMirror(entries);
}

/**
 * User declined to restore — create an empty hub and clear the mirror so we
 * don't prompt again next launch.
 */
export async function declineRestore() {
  clearMirror();
  try {
    const created = await createHubFolder();
    useSpeedDial.setState({
      hubFolderId: created.id,
      entries: [],
      missingMirror: null,
    });
    saveMirror([]);
  } catch {
    useSpeedDial.setState({ missingMirror: null });
  }
}
