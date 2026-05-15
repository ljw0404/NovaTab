# Release Checklist — Chrome Web Store

Step-by-step for taking NovaTab from "works on my machine" to a published listing. Run through this top-to-bottom every time you ship a new version.

## 0. One-time setup (first release only)

- [ ] Register a Chrome Web Store developer account at https://chrome.google.com/webstore/devconsole/ and pay the one-time **US $5** registration fee.
- [x] Privacy policy hosted publicly at https://github.com/ljw0404/NovaTab/blob/main/PRIVACY.md — keep this file in sync with the local `PRIVACY.md` every release.
- [ ] Confirm the developer-account email — Web Store reviewers will reply there if they need clarification.

## 1. Pre-build sanity check

- [ ] Bump `version` in [package.json](package.json) following SemVer. The Web Store requires a **strictly higher** version than the previous upload — you cannot re-upload the same version after a rejection without bumping.
- [ ] `pnpm install` to make sure the lockfile is current.
- [ ] Smoke test in dev: `pnpm dev`, load `dist/` unpacked, exercise the golden path — pin a site, open the drawer, switch language, run AI organize (or skip if you're not changing AI code), toggle theme, sync round-trip.
- [ ] Check that no debug `console.log` was left in changed files (search the diff before committing).
- [ ] Verify [src/lib/ai/defaults.ts](src/lib/ai/defaults.ts) still has the intended bundled key (or has been intentionally rotated).

## 2. Production build

```sh
pnpm build
```

This runs `tsc -b` (type-check, `noEmit`) and then `vite build`. Output lands in `dist/`.

- [ ] Build completes with no errors.
- [ ] Inspect [dist/manifest.json](dist/manifest.json):
  - `name` is `__MSG_extName__`
  - `description` is `__MSG_extDescription__`
  - `default_locale` is `en`
  - `version` matches `package.json`
  - `permissions` is exactly `topSites`, `storage`, `favicon`
  - `optional_permissions` is exactly `bookmarks`, `history`, `identity`, `identity.email`
  - `host_permissions` is exactly `https://sa.lijiwang.top/*`
  - `optional_host_permissions` is `*://*/*`
- [ ] `dist/_locales/en/messages.json` and `dist/_locales/zh_CN/messages.json` are present (CRX plugin copies them from `public/`).
- [ ] Load `dist/` unpacked in a clean Chrome profile and re-do the golden-path test. The MV3 worker should boot, the new tab should render, permission prompts should fire correctly when you first touch bookmarks / history.

## 3. Package the upload zip

The Web Store accepts a zip whose **root** contains `manifest.json`. Do **not** zip the containing folder.

```sh
cd dist
zip -r ../novatab-v$(node -p "require('../package.json').version").zip . -x '*.DS_Store' '*.map'
cd ..
ls -lh novatab-v*.zip
```

- [ ] Resulting zip is under 50 MB (it will be — ours is tiny).
- [ ] Unzip it into a scratch directory and reload it as an unpacked extension to confirm the zip itself is good (`unzip -d /tmp/novatab-check novatab-v0.1.0.zip`).

## 4. Prepare store assets

Drop everything into `store-assets/` (gitignored if you prefer). The dashboard accepts PNG and JPEG.

| Asset | Required size | Capture tip |
|---|---|---|
| Screenshots × 1–5 | **1280×800** or **640×400** (strict) | Five scenes already captured at 3024×1654 — must be resized to 1280×800 before upload (recipe below). |
| Small promo tile (optional, recommended) | 440×280 | A poster-style image with the icon + tagline. |
| Marquee tile (optional) | 1400×560 | Only needed if applying for featured placement. |
| Icon | 128×128 | Already at `public/icons/128.png`. |

Captured scene order (drop into `store-assets/` and rename `01_*.png` … `05_*.png` so they upload in this sequence — the first one shows in search results):

1. `01_home.png` — Homepage with clock, search bar, Speed Dial grid.
2. `02_settings.png` — Settings drawer (cloud sync + wallpaper + sliders).
3. `03_library.png` — Library drawer (bookmarks + history search).
4. `04_ai_organize.png` — AI-organized bookmarks view with categories + "AI 自动分类" trigger.
5. `05_site_test.png` — Site test dialog (broken-link cleanup).

### Resize 3024×1654 → 1280×800

The source aspect ratio (1.83) is wider than the required (1.60), so a straight resize would squish; the recipe below resizes to **height = 800** first, then center-crops to **width = 1280** so the clock + main content stay centered. macOS has `sips` built-in, no install needed.

```sh
mkdir -p store-assets
# Drop your five source PNGs (any name) into a folder, e.g. ~/Desktop/novatab-shots/
for src in ~/Desktop/novatab-shots/*.png; do
  name=$(basename "$src")
  # 1. Resize so the shorter side scales to 800 (height) — width becomes ~1463.
  sips --resampleHeight 800 "$src" --out "store-assets/$name" >/dev/null
  # 2. Center-crop width to 1280.
  sips --cropToHeightWidth 800 1280 "store-assets/$name" >/dev/null
  # 3. Verify.
  sips -g pixelWidth -g pixelHeight "store-assets/$name" | tail -2
done
```

If a screenshot is shorter than 800px after step 1 (it shouldn't be for these inputs), re-shoot at higher resolution. If you'd rather avoid losing pixels from the sides, recapture at exactly 1280×800: open Chrome → DevTools → device toolbar → "Responsive" → set 1280×800 → use the screenshot icon in the device toolbar (captures the viewport at exact pixels).

## 5. Dashboard submission

Open https://chrome.google.com/webstore/devconsole/, click **"New item"** for first release, upload the zip, then fill in:

### "Package" tab
- Upload the zip from step 3.

### "Store listing" tab
Copy text from [STORE_LISTING.md](STORE_LISTING.md):
- [ ] **Description** — pasted in.
- [ ] **Category** — Productivity.
- [ ] **Language** — add both English and Chinese (Simplified).
- [ ] **Screenshots** — upload 1–5.
- [ ] **Small promo tile** — if you made one.
- [ ] **Homepage URL / Support URL** — paste `https://github.com/ljw0404/NovaTab`. Issues on the same repo serve as the support channel.

### "Privacy practices" tab
- [ ] **Single purpose** — paste from STORE_LISTING.md §4.
- [ ] **Permission justifications** — one box per permission, paste from STORE_LISTING.md §5.
- [ ] **Remote code** — answer "No"; paste rationale from STORE_LISTING.md §6 into reviewer notes.
- [ ] **Data usage disclosure** — tick the boxes per STORE_LISTING.md §7. Tick the three compliance checkboxes at the bottom.
- [ ] **Privacy policy URL** — paste the hosted URL of PRIVACY.md.

### "Distribution" tab
- [ ] **Visibility** — Public (or Unlisted if you want soft-launch).
- [ ] **Regions** — All regions, unless you have a reason to exclude.
- [ ] **Pricing** — Free.

### Final
- [ ] Hit **"Submit for review"**.

## 6. Post-submit

- Initial review typically lands in **1–3 business days**; can stretch to ~2 weeks for first-time developers or if any permission gets flagged.
- Watch the developer-account inbox for a rejection email. Common rejection reasons and how to address each:
  - **"Permissions not justified"** → tighten the justification for the cited permission in STORE_LISTING.md §5 and resubmit.
  - **"Single purpose violation"** → trim the description so the single purpose reads cleanly first; tuck AI/cloud-sync under "additional features".
  - **"Remote code"** → confirm you marked "No remote code" and emphasize that AI calls are API data fetches, not script loading.
  - **"Privacy policy missing / unreachable"** → make sure the URL is publicly accessible without login.
- Once approved, the listing goes live within a few hours.

## 7. Shipping a future update

1. Cut a branch, land changes, bump `package.json` `version`.
2. Re-run steps 1 → 3 (sanity + build + zip).
3. In the Dashboard, open the existing item → **"Package"** → upload the new zip → "Submit for review".
4. Update STORE_LISTING.md / PRIVACY.md if behavior changed; re-paste any changed fields in the dashboard. Updating only the package doesn't re-trigger a listing review of unchanged fields.

## 8. If you need to roll back

- The Web Store does **not** let you re-publish an older `.crx`. You can only ship a **newer** version. Plan: keep the previous zip on disk, bump version, rebuild from the old commit, re-upload as a new version.
- For an emergency takedown (e.g., the bundled API key leaks), use "Unpublish" in the Dashboard — the item disappears from search and new installs immediately, but already-installed copies keep working until users uninstall.
