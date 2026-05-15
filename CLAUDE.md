# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (lockfile present). There is no test runner, linter, or formatter configured.

- `pnpm dev` — Vite dev server on port 5173 (strict). `@crxjs/vite-plugin` emits a loadable unpacked extension into `dist/` with HMR.
- `pnpm build` — `tsc -b` (type-check only, `noEmit`) then `vite build`. Produces the production MV3 extension in `dist/`.
- `pnpm preview` — static preview of the built bundle.

To load in Chrome: `chrome://extensions` → Developer mode → Load unpacked → pick `dist/`.

## Architecture

This is a **Chrome Manifest V3 extension** that overrides the new tab page (`chrome_url_overrides.newtab`). Three entry points compile through Vite + `@crxjs/vite-plugin`:

- `src/newtab/` — React app rendered at `chrome://newtab/` (the main UI).
- `src/options/` — Options page (still mostly a placeholder).
- `src/background/service-worker.ts` — MV3 service worker (currently a stub).

Path alias `@/*` → `src/*`. Manifest is built from `manifest.config.ts` via `defineManifest`.

### State + persistence model — read this before changing storage

There are **three distinct persistence surfaces**, each with different semantics. Mixing them up causes sync loops, data loss, or silent UI desync.

1. **`chrome.bookmarks` (HubTabPinData folder)** — source of truth for Speed Dial pins/folders. The hub lives under "Other Bookmarks" (`parentId: '2'`) and is named `HubTabPinData` (see `src/lib/hub-folder.ts`). Every pin shown on the homepage is a real Chrome bookmark, so Chrome's native bookmark sync handles cross-device propagation for pins for free. `useSpeedDial` (`src/stores/speedDial.ts`) is a reactive **cache** of this folder — it is *not* persisted with Zustand persist.
2. **`localStorage` (`glass-start:*` keys)** — Zustand-persisted user settings (`useSettings`, `useAiConfig`, `useBookmarkClassification`), plus the `glass-start:hub-mirror` recovery snapshot. The `buildBackup()` / restore in `src/lib/backup.ts` reads/writes everything matching this prefix.
3. **`chrome.storage.sync`** — cross-device sync of settings (`SYNC_KEY = 'glass-start:sync-envelope'`) and AI bookmark classification (chunked under `glass-start:cls-meta` + `glass-start:cls:N` because a single sync item is capped at ~8KB). Pins are *not* in this envelope — they sync via Chrome bookmarks.

### Hub engine (`src/lib/hub-engine.ts`)

Booted from `App.tsx` via `initHubEngine()`. Responsibilities:

- Find or create the `HubTabPinData` folder. If it's missing but the local mirror has data, surface a restore prompt (`HubMissingDialog`) instead of silently recreating.
- Listen to `chrome.bookmarks.onCreated/Changed/Removed/Moved` so the cache refreshes when the user edits via Chrome's bookmark manager or via Chrome sync.
- **Echo suppression:** every internal write calls `noteHubWrite()` first, which sets a 250 ms quiet window so the bookmark-event echo of our own write doesn't trigger a duplicate refresh. If you add a new code path that writes to the hub, call `noteHubWrite()` before the chrome.bookmarks call.
- After every successful read, write `saveMirror(entries)` to localStorage so we can recover from accidental hub deletion.
- One-shot migration from the legacy `glass-start:speed-dial` localStorage key.

### Cloud sync engine (`src/lib/cloud-sync-engine.ts`)

Started/stopped by `App.tsx` based on `useCloudSync.user`. Key invariants:

- **`applyingRemote` flag** — while applying a remote envelope, local Zustand subscribers must not schedule a push. Without this, every remote pull echoes back as a push and you get a loop.
- **`lastHash`** — content hash of the last envelope we pushed or pulled. Used both to skip no-op pushes and to ignore the `chrome.storage.onChanged` echo of our own write.
- Settings push is debounced 1000 ms. On startup, `reconcileOnStart()` merges local + remote with `mergeEnvelopes`: scalar settings prefer **local** (the user is on this device); `customColors` is a union capped at 3.
- Classification sync is **last-write-wins on `classifiedAt`** — a partial merge would be meaningless because different classification runs produce different category structures. Clearing the classification writes a `{ cleared: true }` tombstone so other devices drop their cache too.

### AI client (`src/lib/ai/`)

OpenAI-compatible chat completions. Defaults (`defaults.ts`) point at a bundled endpoint that is listed in `manifest.config.ts` under `host_permissions` — this is what lets `fetch()` skip the CORS preflight that the server doesn't honor. User-configured custom endpoints request access at runtime via `ensureCurrentEndpointAccess()` in `host-access.ts`, which must be called from a user gesture.

`chatCompletion()` always streams (`stream: true`) to avoid gateway 504s on long responses. It surfaces `reasoning_content` / `reasoning` / `thinking` deltas via a separate `onReasoning` callback so the UI can show the model's thinking.

Bookmark classification (`classify.ts`) sends a numbered list `N. <title> | <domain>` and asks the model to return only `{"groups":[{"name":"...","ids":[N,...]}]}` — the model never echoes URLs back. Reconstruction by index typically saves 60-70% on response tokens vs. the naïve approach.

### Permissions

`bookmarks`, `history`, `identity`, `identity.email` are declared as `optional_permissions` and requested at runtime through `src/lib/permissions.ts` / `cloud-sync.ts` (`PermissionBanner` surfaces the prompt). `topSites`, `storage`, `favicon` are always-on. When testing flows that touch bookmarks/history, you must accept the prompt at least once per fresh install.

### i18n

Two parallel systems, both needed:

- **In-app strings:** hand-written tables in `src/i18n/messages.ts` (`zh-CN`, `en`), accessed via `useT()`. Default locale is `zh-CN`. The user can switch from the UI.
- **Extension metadata:** Chrome reads `public/_locales/<lang>/messages.json` for the name/description in the chrome://extensions UI. These are separate files — updating one does not update the other.

## One-off importer scripts

`scripts/import-infinity.js` and `scripts/import-infinity-inlined.js` are paste-into-DevTools scripts for migrating from the Infinity New Tab extension into HubTabPinData. They are not part of the build — open the new tab's DevTools console, paste, and run. They deduplicate by URL so re-running is safe.
