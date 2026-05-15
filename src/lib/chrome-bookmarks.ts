/**
 * Helpers for working with the user's full Chrome bookmark library by URL
 * (not just our HubTabPinData folder — these touch the user's whole tree).
 *
 * The "AI organized bookmarks" view shows items as { url, title } without
 * a Chrome bookmark id, so edit / delete operations have to look up the id
 * from the URL via chrome.bookmarks.search. A given URL can appear in
 * multiple folders — these helpers operate on ALL matching nodes by default,
 * which is what users intend ("delete this bookmark" means everywhere).
 */

function lastError(): chrome.runtime.LastError | undefined {
  return chrome.runtime?.lastError;
}

export function isExtensionWithBookmarks(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.bookmarks?.search;
}

/** Find every Chrome bookmark node with the given URL. */
export function findNodesByUrl(
  url: string
): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  if (!isExtensionWithBookmarks()) return Promise.resolve([]);
  return new Promise(resolve => {
    chrome.bookmarks.search({ url }, results => {
      // chrome.bookmarks.search with {url} matches that field exactly.
      const matched = (results ?? []).filter(r => r.url === url);
      resolve(matched);
    });
  });
}

/**
 * Update the title (and optionally URL) of every bookmark matching `oldUrl`.
 * If the URL changes, all matching nodes get the new URL.
 */
export async function updateBookmarkByUrl(
  oldUrl: string,
  patch: { title?: string; url?: string }
): Promise<void> {
  const nodes = await findNodesByUrl(oldUrl);
  if (nodes.length === 0) return;
  await Promise.all(
    nodes.map(
      n =>
        new Promise<void>((resolve, reject) => {
          chrome.bookmarks.update(n.id, patch, () => {
            const err = lastError();
            if (err) reject(new Error(err.message));
            else resolve();
          });
        })
    )
  );
}

/** Remove every bookmark matching `url`. */
export async function removeBookmarkByUrl(url: string): Promise<void> {
  const nodes = await findNodesByUrl(url);
  await Promise.all(
    nodes.map(
      n =>
        new Promise<void>((resolve, reject) => {
          chrome.bookmarks.remove(n.id, () => {
            const err = lastError();
            if (err) reject(new Error(err.message));
            else resolve();
          });
        })
    )
  );
}

/** Bulk remove — used by the site-test "delete all dead" batch action. */
export async function removeBookmarksByUrls(urls: string[]): Promise<void> {
  for (const url of urls) {
    try {
      await removeBookmarkByUrl(url);
    } catch {
      // Skip and continue — one failing bookmark shouldn't abort the batch.
    }
  }
}
