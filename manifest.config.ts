import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  // Localized via public/_locales — Chrome picks the right messages.json
  // based on the user's browser language (falls back to default_locale).
  name: '__MSG_extName__',
  description: '__MSG_extDescription__',
  version: pkg.version,
  default_locale: 'en',
  icons: {
    16: 'icons/16.png',
    32: 'icons/32.png',
    48: 'icons/48.png',
    128: 'icons/128.png',
  },
  permissions: ['topSites', 'storage', 'favicon'],
  optional_permissions: ['bookmarks', 'history', 'identity', 'identity.email'],
  // Bundled default AI endpoint — listed here so Chrome treats fetch() to it
  // as same-origin and skips CORS preflight (which the server doesn't honor).
  host_permissions: ['https://sa.lijiwang.top/*'],
  // For user-configured custom AI endpoints we request access at runtime via
  // chrome.permissions.request({ origins: [...] }) — see lib/ai/host-access.ts.
  optional_host_permissions: ['*://*/*'],
  chrome_url_overrides: {
    newtab: 'src/newtab/index.html',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
});
