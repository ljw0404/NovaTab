// The built-in AI service was retired — operating a public proxy that
// injects a server-side key isn't free, and embedding a real key in the
// client leaks it to anyone with DevTools. Users must now configure their
// own endpoint + key (see AiSettingsPanel).
//
// These constants are kept (empty) only because lib/ai/client.ts uses them
// as a fallback shape — getEffective() returns null when nothing is
// configured, and callers gate on that. Nothing in the UI ever displays
// them, and nothing is sent on the wire.
export const DEFAULT_BASE_URL = '';
export const DEFAULT_API_KEY = '';
export const DEFAULT_MODEL = '';
