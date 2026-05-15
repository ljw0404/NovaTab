// Internal defaults used by the AI service when the user hasn't enabled
// "custom AI config".
//
// Auth strategy (Option A — Origin allowlist):
//   The proxy at DEFAULT_BASE_URL authenticates the request by checking
//   `Origin: chrome-extension://<our-id>` and injects the real upstream API
//   key server-side. The client sends NO Authorization header for the
//   built-in endpoint, so DevTools never reveals a real API key.
//
//   See lib/ai/client.ts — when apiKey is empty, the Authorization header
//   is omitted entirely.
export const DEFAULT_BASE_URL = 'https://sa.lijiwang.top';
export const DEFAULT_API_KEY = '';
export const DEFAULT_MODEL = 'gpt-5.4';
