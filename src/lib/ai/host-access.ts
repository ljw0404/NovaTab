import { useAiConfig } from '@/stores/aiConfig';

/**
 * Get the origin pattern (e.g. "https://example.com/*") for a base URL,
 * used as the input to chrome.permissions.request / contains.
 */
function originPattern(baseUrl: string): string | null {
  try {
    const u = new URL(baseUrl);
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

/**
 * Check if the extension currently has cross-origin fetch access to the
 * given URL. The bundled default endpoint is in `host_permissions` so it's
 * always granted; user-supplied endpoints need a runtime grant.
 */
export async function hasHostAccess(baseUrl: string): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.contains) return false;
  const pattern = originPattern(baseUrl);
  if (!pattern) return false;
  return new Promise(resolve => {
    chrome.permissions.contains({ origins: [pattern] }, ok => resolve(!!ok));
  });
}

/**
 * Ask the user (interactive Chrome prompt) for cross-origin fetch access to
 * this URL's host. Must be called from a user gesture (button click).
 * Returns true if granted, false otherwise.
 */
export async function requestHostAccess(baseUrl: string): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false;
  const pattern = originPattern(baseUrl);
  if (!pattern) return false;
  return new Promise(resolve => {
    chrome.permissions.request({ origins: [pattern] }, ok => resolve(!!ok));
  });
}

/**
 * Ensure access to whatever base URL the user has configured.
 * Returns `not-configured` when AI isn't set up yet (no built-in fallback
 * anymore). Must be called from a user gesture if a permission prompt
 * might be needed.
 */
export async function ensureCurrentEndpointAccess(): Promise<
  { ok: true } | { ok: false; reason: 'denied' | 'invalid' | 'not-configured' }
> {
  const cfg = useAiConfig.getState().getEffective();
  if (!cfg) return { ok: false, reason: 'not-configured' };

  const pattern = originPattern(cfg.baseUrl);
  if (!pattern) return { ok: false, reason: 'invalid' };

  if (await hasHostAccess(cfg.baseUrl)) return { ok: true };
  const granted = await requestHostAccess(cfg.baseUrl);
  return granted ? { ok: true } : { ok: false, reason: 'denied' };
}
