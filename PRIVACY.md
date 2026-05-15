# Privacy Policy — NovaTab / 星启页

_Last updated: 2026-05-15_

NovaTab ("the extension") is a Chrome extension that replaces the new tab page. This document describes what data the extension touches, where it goes, and what is **never** transmitted off your device.

Plain summary: **everything stays on your device or rides on Chrome's own sync, except the bookmark titles + domains that you explicitly send to an AI server when you click "Organize bookmarks with AI".** No analytics, no accounts, no tracking.

---

## 1. Data the extension reads from Chrome

| Source (Chrome API) | What is read | Why |
|---|---|---|
| `chrome.topSites` | Your most-visited site URLs and titles | To render the "Most visited" row. Read on demand; not stored. |
| `chrome.bookmarks` (opt-in) | Your bookmark tree | To power the in-page Library drawer search and the optional AI organizer. To create/read/edit the dedicated "HubTabPinData" folder where pins are stored. |
| `chrome.history` (opt-in) | Recent visits | To surface recent history in the Library drawer's command palette. Read on demand; not stored. |
| `chrome.identity.getProfileUserInfo` (opt-in) | The email address of your signed-in Chrome profile | Displayed in the cloud-sync UI as "Synced as: …". Read once per session; never transmitted. |
| `chrome.favicon` | Site favicons | Rendering favicon tiles. |

The optional APIs (`bookmarks`, `history`, `identity`, `identity.email`) are declared as **optional permissions** and only granted after you explicitly accept Chrome's permission prompt. You can revoke them at any time from `chrome://extensions`.

---

## 2. Data the extension stores locally

| Storage | What is stored |
|---|---|
| `localStorage` | UI preferences (theme, language, default search engine, wallpaper URL, overlay / blur sliders, custom color picks, AI config flags + your own key if you supplied one), the AI-organized-bookmarks cache, and a recovery mirror of the HubTabPinData pin list. |
| `chrome.storage.sync` | The same UI preferences (so they follow you across Chrome installs), and the AI-classification result (chunked because of the 8KB per-item limit). Pins are **not** in this envelope — they live in Chrome bookmarks. |
| `chrome.bookmarks` (HubTabPinData folder) | The actual pins / folders you create on the new tab page. Stored as standard Chrome bookmarks so Chrome's native bookmark sync carries them across devices for free. |

`chrome.storage.sync` data is moved between your Chrome installs by Google's sync infrastructure, the same way Chrome syncs your other bookmarks and settings. The extension never operates its own server for this.

---

## 3. Data sent to external servers

There is exactly **one** outbound network destination the extension contacts on its own, and only when you trigger it:

### AI bookmark classification (only when you click "Organize with AI")

- **Default endpoint:** `https://sa.lijiwang.top/v1/chat/completions`
- **What is sent:** a numbered list of your bookmarks in the form `N. <title> | <domain>`, plus a fixed system prompt that asks the model to group them.
- **What is _not_ sent:** full URLs (only the domain portion), bookmark folder structure, browsing history, identity info, settings, IPs beyond standard HTTPS metadata.
- **Provider:** the endpoint is operated by the extension author for community use. It proxies requests to an underlying OpenAI-compatible LLM provider, which receives the same payload. Logging/retention policy of the underlying provider may apply.
- **Opt-out:** the AI feature is opt-in. Don't click "Organize with AI" and nothing is ever sent.
- **Bring your own:** in settings you can switch to any OpenAI-compatible endpoint with your own API key. In that case requests go to **your** endpoint instead of `sa.lijiwang.top`. The extension asks Chrome for runtime host permission for the specific origin you enter.

### Favicons via Google's S2 service

When a bookmark or history result has no cached favicon, Chrome may load it via Google's standard favicon service. This is the same behavior as Chrome's built-in bookmarks bar; the extension does not introduce additional tracking.

That is the complete list of external network calls originating from the extension.

---

## 4. What we never collect or transmit

- ❌ Browsing history (read locally for the command palette; never uploaded)
- ❌ Full bookmark URLs (titles + domains only, and only when you trigger AI organize)
- ❌ Email address (read locally for display; never transmitted)
- ❌ Form data, page content, cookies, passwords
- ❌ Telemetry, usage analytics, crash reports
- ❌ Advertising identifiers

The extension has no account system, no remote login, and no analytics SDK.

---

## 5. Third-party sharing

We do not sell, rent, share, or transfer user data to third parties, beyond:

1. The AI inference provider behind the bundled `sa.lijiwang.top` endpoint, which receives the bookmark titles + domains you explicitly submit when using the AI organize feature.
2. Google, in its role as the operator of Chrome and Chrome Sync, for `chrome.storage.sync` data — under your own Google account.

If you switch the AI endpoint in settings, requests go to whatever endpoint you configure; that party becomes the recipient of the bookmark titles + domains. You are responsible for trusting that endpoint.

---

## 6. Your controls

- **Disable AI features**: simply don't trigger them. No data is sent until you click.
- **Revoke optional permissions**: go to `chrome://extensions` → NovaTab → "Details" → toggle off bookmarks / history / identity. The corresponding UI gracefully degrades.
- **Disable cross-device sync**: sign out of the cloud-sync section in the settings drawer, or disable Chrome Sync system-wide in your Google account.
- **Wipe all extension data**: uninstall the extension. `localStorage` and `chrome.storage.sync` for the extension are cleared by Chrome. The HubTabPinData bookmark folder (your pins) remains in Chrome bookmarks for safety — delete it manually if you want to remove them too.
- **Export your data**: settings drawer → "Backup" exports a JSON of everything in `localStorage`.

---

## 7. Children

NovaTab is a general productivity tool and is not directed at children under 13. We do not knowingly collect data from children.

---

## 8. Changes to this policy

We may update this policy as the extension evolves. Material changes will be reflected by updating the "Last updated" date at the top and noted in the release notes for that version.

---

## 9. Contact

Questions or concerns: **lijiwang44@gmail.com**

Source code: _(add your public repo URL here once published)_
