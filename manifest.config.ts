import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

// Stable extension ID across unpacked-reloads in development. Without
// this, every fresh "Load unpacked" gets a new randomly-generated ID,
// which means chrome.storage.sync data (settings + AI classification +
// remembered cloud-sync user) is orphaned with each reinstall.
//
// This is the RSA-2048 public key (base64-DER) of a private key generated
// locally; only the public part lives here. On Web Store publish Google
// replaces it with their own signing key, so we strip this field for
// release builds — run `pnpm build:release` (which sets
// GLASS_START_RELEASE=1) to produce a Web-Store-ready bundle without it.
const DEV_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvCmKWCvqJ+l0+Cr4nkk5WdBPss3UQZMNp1TuniJ7iobUYZJfahgR0ybDQkqkfsAt1Azj8L0qOhjFPDGPXhUKIkZFaGMnt1qTzQOcpVsA5T7PRdGX5txAhrS6ejHKIBG+NYVa6zgJ+BPGDmbY4f2Tm4KuTqIkXlYyRdkQqeMIj6Wbu6UkW72QuyXF/zz7iiCUjRD4jb8l4ZN2xiHjxY+78S3bf3hFNNFzMUZl0g5RBPwny4rUuXfFznpwYvg7p62ge/M2GpIHkITlr21X/i7GhoZOeptDMv7NA/Ck++WpKzgh22rZWAsmd2blf/uYy5WISEVkbALSsZa40dSevh9rqQIDAQAB';

const isRelease = process.env.GLASS_START_RELEASE === '1';

// Loud one-time announcement in the build log so it's obvious which mode
// you're producing. Use stderr so it doesn't get swallowed by Vite's
// stdout massaging.
process.stderr.write(
  `\n  [glass-start] manifest mode: ${isRelease ? 'RELEASE (key stripped)' : 'DEV (stable key included)'}\n\n`
);

export default defineManifest({
  manifest_version: 3,
  // `key` only present in dev — release builds omit it so the Web Store
  // can assign Google's own signing key without conflict.
  ...(isRelease ? {} : { key: DEV_KEY }),
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
