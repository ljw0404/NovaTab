/**
 * Build a URL for the favicon of `url` at roughly `size` px.
 *
 * Source preference:
 *
 *  1. Inside the extension we use Chrome's built-in `/_favicon/` endpoint
 *     (declared via the `favicon` permission in manifest). It serves from
 *     Chrome's local favicon cache:
 *       - no outbound network request → works behind firewalls / no-VPN
 *         China, where the previous Google `s2/favicons` host was blocked,
 *       - instant on cache hit (covers any site the user has visited:
 *         topSites, bookmarks they've opened, Speed Dial pins),
 *       - serves a generic placeholder icon if Chrome has never seen the
 *         site (no error, so `onError` handlers don't fire — accept the
 *         generic icon rather than chaining another fetch).
 *
 *  2. Outside the extension (Vite preview, unit test, etc.) we have no
 *     access to chrome.runtime — fall back to DuckDuckGo's icon service.
 *     It's reachable from mainland China without a VPN, unlike Google's
 *     `s2/favicons`, which was the cause of the original "blank icons in
 *     China" bug.
 */

function isExtensionContext(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    !!chrome.runtime &&
    typeof chrome.runtime.getURL === 'function'
  );
}

export function faviconUrl(url: string, size = 64): string {
  let pageUrl: string;
  let host: string;
  try {
    const u = new URL(url);
    pageUrl = u.toString();
    host = u.hostname;
  } catch {
    // Caller passed a bare host like "github.com" — DuckDuckGo accepts it,
    // and Chrome's _favicon needs a real pageUrl so we synthesize one.
    pageUrl = `https://${url}`;
    host = url;
  }

  if (isExtensionContext()) {
    return chrome.runtime.getURL(
      `/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`
    );
  }

  return `https://icons.duckduckgo.com/ip3/${host}.ico`;
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
