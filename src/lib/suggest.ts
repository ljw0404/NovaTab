import { hostname } from './favicon';
import { isExtensionContext } from './permissions';

export type Suggestion = {
  kind: 'bookmark' | 'history';
  title: string;
  url: string;
  /** For bookmarks: the ancestor folder titles, top-down. */
  folderPath?: string[];
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize a URL for dedup purposes. Two suggestions that point to the
 * same logical page (same scheme + host + path + query, ignoring anchor
 * and trailing slash) collapse to a single key.
 *
 *   https://example.com/foo  === https://example.com/foo/
 *   https://example.com/foo  === https://example.com/foo#section
 *   HTTPS://Example.com/foo  === https://example.com/foo
 *
 * Query strings are kept (?a=1 vs ?a=2 are usually different pages). Path
 * case is preserved (some servers are case-sensitive). On parse failure we
 * fall back to lowercasing the raw string so we still get some dedup.
 */
function normalizeUrlForDedup(url: string): string {
  try {
    const u = new URL(url);
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Score an item against query words.
 *
 * Returns -1 if any word doesn't match anywhere in title / hostname / url,
 * so we can filter "folder-only" hits from chrome.bookmarks.search (which
 * matches against folder names too).
 *
 * Higher score = better match. Used to rank within a kind — overall ordering
 * is bookmarks-first, history-second (see fetchSuggestions sort).
 *   1000+   title starts with the word
 *   600+    word boundary in title
 *   400+    title contains substring
 *   200+    hostname contains substring
 *   100+    url contains substring
 */
function score(
  item: { kind: Suggestion['kind']; title: string; url: string },
  words: string[]
): number {
  const title = item.title.toLowerCase();
  const url = item.url.toLowerCase();
  const host = hostname(item.url).toLowerCase();

  let total = 0;
  for (const w of words) {
    if (title.startsWith(w)) {
      total += 1000;
    } else if (new RegExp(`\\b${escapeRegex(w)}`).test(title)) {
      total += 600;
    } else if (title.includes(w)) {
      total += 400;
    } else if (host.includes(w)) {
      total += 200;
    } else if (url.includes(w)) {
      total += 100;
    } else {
      return -1;
    }
  }
  return total;
}

// Build a map of bookmark node id → ancestor folder titles (top-down).
// Cached for a short window since getTree() can be expensive on large trees.
let pathMapCache: Map<string, string[]> | null = null;
let pathMapAt = 0;
const PATH_CACHE_TTL_MS = 60_000;

async function getBookmarkPathMap(): Promise<Map<string, string[]>> {
  if (pathMapCache && Date.now() - pathMapAt < PATH_CACHE_TTL_MS) {
    return pathMapCache;
  }
  if (typeof chrome === 'undefined' || !chrome.bookmarks?.getTree) {
    return new Map();
  }
  return new Promise(resolve => {
    chrome.bookmarks.getTree(roots => {
      const map = new Map<string, string[]>();
      const walk = (
        node: chrome.bookmarks.BookmarkTreeNode,
        parentPath: string[]
      ) => {
        map.set(node.id, parentPath);
        if (node.children) {
          // For children, this node's title is appended to the parent path.
          // Skip empty titles (the synthetic root has title "").
          const childPath = node.title ? [...parentPath, node.title] : parentPath;
          for (const c of node.children) walk(c, childPath);
        }
      };
      for (const r of roots) walk(r, []);
      pathMapCache = map;
      pathMapAt = Date.now();
      resolve(map);
    });
  });
}

export async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  const q = query.trim();
  if (!q || !isExtensionContext()) return [];

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const [bookmarkNodes, history, pathMap] = await Promise.all([
    new Promise<chrome.bookmarks.BookmarkTreeNode[]>(resolve => {
      if (!chrome.bookmarks?.search) return resolve([]);
      chrome.bookmarks.search(q, resolve);
    }),
    new Promise<Suggestion[]>(resolve => {
      if (!chrome.history?.search) return resolve([]);
      chrome.history.search(
        { text: q, maxResults: 1000, startTime: 0 },
        items => {
          resolve(
            items
              .filter(i => i.url)
              .map(i => ({
                kind: 'history' as const,
                title: i.title || hostname(i.url!),
                url: i.url!,
              }))
          );
        }
      );
    }),
    getBookmarkPathMap(),
  ]);

  const bookmarks: Suggestion[] = bookmarkNodes
    .filter(n => n.url)
    .map(n => ({
      kind: 'bookmark' as const,
      title: n.title || hostname(n.url!),
      url: n.url!,
      folderPath: pathMap.get(n.id),
    }));

  // Score every candidate; drop ones that don't really match.
  const scored: Array<Suggestion & { score: number }> = [];
  for (const item of bookmarks) {
    const s = score(item, words);
    if (s >= 0) scored.push({ ...item, score: s });
  }
  for (const item of history) {
    const s = score(item, words);
    if (s >= 0) scored.push({ ...item, score: s });
  }

  // Order: bookmarks before history, then by score within each group. The
  // dedupe pass below picks the first occurrence of each normalized-URL
  // key, so by sorting kind first we guarantee that when a page appears
  // as both a bookmark and a history entry, the bookmark version is kept.
  scored.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'bookmark' ? -1 : 1;
    return b.score - a.score;
  });

  // Dedupe by normalized URL — covers the common "I bookmarked the page
  // and also have it in history" case, plus same-page-with-anchor and
  // trailing-slash variants. Keeps query strings since ?a=1 vs ?a=2 are
  // typically distinct pages.
  const seen = new Set<string>();
  const result: Suggestion[] = [];
  for (const item of scored) {
    const key = normalizeUrlForDedup(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      kind: item.kind,
      title: item.title,
      url: item.url,
      folderPath: item.folderPath,
    });
  }

  return result;
}
