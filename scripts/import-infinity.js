/**
 * One-shot importer: Infinity New Tab JSON → HubTabPinData.
 *
 *   1. Open the extension's new tab page (Cmd/Ctrl+T).
 *   2. Right-click → Inspect → Console tab.
 *   3. Paste the user JSON into INFINITY_DATA below, then paste the whole
 *      file into the console and press Enter.
 *   4. The script prints progress and a final count.
 *
 * Notes:
 *   - Items with `type: 'app'` (Infinity's built-in bookmarks/history shortcuts)
 *     are skipped.
 *   - Items whose `target` is empty, "http://", or doesn't start with http(s)://
 *     are skipped.
 *   - Folders are created at the top level of HubTabPinData; their children
 *     (only `type: 'web'`) become bookmarks inside.
 *   - Existing HubTabPinData is reused — duplicates by URL are skipped so
 *     re-running the script doesn't double-add.
 */

const INFINITY_DATA = [
  /* PASTE YOUR INFINITY EXPORT HERE — top-level array, may be array of pages. */
];

(async function runInfinityImport() {
  const HUB_NAME = 'HubTabPinData';
  const OTHER_BOOKMARKS_ID = '2';

  function flatten(data) {
    if (!Array.isArray(data)) return [];
    if (data.length === 0) return [];
    // Detect array-of-pages vs single page.
    if (Array.isArray(data[0])) {
      return data.flat();
    }
    return data;
  }

  function isValidWebItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (item.type === 'app') return false;
    if (item.children) return false; // a folder, not a leaf
    const target = (item.target || '').trim();
    if (!target) return false;
    if (target === 'http://' || target === 'https://') return false;
    if (!/^https?:\/\//i.test(target)) return false;
    const name = (item.name || '').trim();
    if (!name) return false;
    return true;
  }

  function isFolder(item) {
    return item && typeof item === 'object' && Array.isArray(item.children);
  }

  function bk(method, ...args) {
    return new Promise((resolve, reject) => {
      method(...args, result => {
        const err = chrome.runtime?.lastError;
        if (err) reject(new Error(err.message));
        else resolve(result);
      });
    });
  }

  if (typeof chrome === 'undefined' || !chrome.bookmarks) {
    console.error(
      '[import] chrome.bookmarks API not available. Open this on the extension new tab page.'
    );
    return;
  }

  // Find or create the hub folder.
  const matches = await bk(
    chrome.bookmarks.search.bind(chrome.bookmarks),
    { title: HUB_NAME }
  );
  let hub = matches.find(
    r => !r.url && r.parentId === OTHER_BOOKMARKS_ID && r.title === HUB_NAME
  );
  if (!hub) {
    hub = await bk(chrome.bookmarks.create.bind(chrome.bookmarks), {
      parentId: OTHER_BOOKMARKS_ID,
      title: HUB_NAME,
    });
    console.log(`[import] created ${HUB_NAME} (id=${hub.id})`);
  } else {
    console.log(`[import] reusing existing ${HUB_NAME} (id=${hub.id})`);
  }

  // Collect existing URLs (top level + one level deep) so we can dedupe.
  const existingUrls = new Set();
  const topChildren = await bk(
    chrome.bookmarks.getChildren.bind(chrome.bookmarks),
    hub.id
  );
  const folderIdByName = new Map(); // name → existing folder id, to merge same-named folders
  for (const c of topChildren) {
    if (c.url) existingUrls.add(c.url);
    else folderIdByName.set(c.title, c.id);
  }
  for (const fid of folderIdByName.values()) {
    const sub = await bk(
      chrome.bookmarks.getChildren.bind(chrome.bookmarks),
      fid
    );
    for (const s of sub) {
      if (s.url) existingUrls.add(s.url);
    }
  }

  const items = flatten(INFINITY_DATA);
  let pinsCreated = 0;
  let foldersCreated = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of items) {
    if (isFolder(item)) {
      const folderName = (item.name || '未命名文件夹').trim();
      // Re-use a folder of the same name if it already exists in the hub,
      // otherwise create a new one.
      let folderId = folderIdByName.get(folderName);
      if (!folderId) {
        try {
          const f = await bk(chrome.bookmarks.create.bind(chrome.bookmarks), {
            parentId: hub.id,
            title: folderName,
          });
          folderId = f.id;
          folderIdByName.set(folderName, folderId);
          foldersCreated++;
          console.log(`[import] + folder "${folderName}"`);
        } catch (e) {
          console.warn(`[import] failed to create folder "${folderName}":`, e);
          errors++;
          continue;
        }
      }
      for (const child of item.children) {
        if (!isValidWebItem(child)) {
          skipped++;
          continue;
        }
        const url = child.target.trim();
        const name = child.name.trim();
        if (existingUrls.has(url)) {
          skipped++;
          continue;
        }
        try {
          await bk(chrome.bookmarks.create.bind(chrome.bookmarks), {
            parentId: folderId,
            title: name,
            url,
          });
          existingUrls.add(url);
          pinsCreated++;
        } catch (e) {
          console.warn(`[import] failed to add "${name}":`, e);
          errors++;
        }
      }
    } else if (isValidWebItem(item)) {
      const url = item.target.trim();
      const name = item.name.trim();
      if (existingUrls.has(url)) {
        skipped++;
        continue;
      }
      try {
        await bk(chrome.bookmarks.create.bind(chrome.bookmarks), {
          parentId: hub.id,
          title: name,
          url,
        });
        existingUrls.add(url);
        pinsCreated++;
      } catch (e) {
        console.warn(`[import] failed to add "${name}":`, e);
        errors++;
      }
    } else {
      skipped++;
    }
  }

  console.log(
    `[import] done · ${foldersCreated} folders, ${pinsCreated} pins created · ` +
      `${skipped} skipped · ${errors} errors`
  );
  console.log(
    '[import] refresh the new tab page (Cmd/Ctrl+R) to see them in your SpeedDial.'
  );
})();
