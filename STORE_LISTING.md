# Chrome Web Store Listing — NovaTab / 星启页

Paste-ready copy for the Chrome Web Store Developer Dashboard. Each section maps to a field in the Dashboard ("Store listing" tab unless noted).

---

## 1. Item summary (Dashboard → Store listing)

### Name
`NovaTab` (English locale) / `星启页` (zh_CN locale) — sourced automatically from `public/_locales/<lang>/messages.json` because the manifest uses `__MSG_extName__`.

### Category
`Productivity`

### Language
Add both `English` and `Chinese (Simplified)` under "Languages" so the Web Store renders the right `_locales` strings for each visitor.

---

## 2. Summary (short description, ≤ 132 chars)

**English**
> A glass-styled new tab page with search, pinned sites, bookmarks, history, and AI-powered bookmark organization.

**中文**
> 玻璃质感新标签页：搜索、固定网站、收藏、历史与 AI 智能分类，开启每一次浏览都更高效。

---

## 3. Detailed description

### English

```
NovaTab replaces Chrome's new tab page with a calm, glass-styled launcher that puts your sites one keystroke away.

— Glass aesthetic. Live mesh-gradient background or your own wallpaper, with adjustable overlay and blur.
— Speed Dial pins. Pin any site (or organize them into folders). Pins are stored as real Chrome bookmarks under "HubTabPinData" in Other Bookmarks, so Chrome's native sync carries them across devices automatically.
— Unified search. Type a query to search Google/Bing/DuckDuckGo/Baidu (you choose the default), or press "/" to focus the bar.
— Library drawer. Search your full bookmark tree and browsing history from a single command palette.
— AI bookmark organizer. Optional one-click "organize my bookmarks" view. The model receives only titles and domains — never full URLs — and groups them into 5–12 conceptual categories. Results are cached locally.
— Bring your own model. Defaults are bundled for instant use; you can switch to any OpenAI-compatible endpoint (your own key) at any time.
— Cross-device sync. Settings and the AI classification result sync via Chrome's built-in storage.sync. Pins ride along on Chrome bookmark sync.
— Bilingual: English and Simplified Chinese.

Open-source. No analytics. No accounts. All extension data lives on your device + Chrome's own sync.
```

### 中文

```
星启页让 Chrome 新标签页焕然一新——一张干净、带玻璃质感的"启动台"，把你常去的地方放到一击可达。

· 玻璃美学。动态网格渐变背景或自定义壁纸，可调遮罩与模糊。
· Speed Dial 固定。把任意网站固定到首页，按需归入文件夹。每一个 Pin 都是一条真实的 Chrome 书签（位于"其他书签 / HubTabPinData"），Chrome 自带的书签同步会替你把它们带到所有设备。
· 统一搜索。一行输入即可搜 Google / Bing / DuckDuckGo / 百度（默认引擎可切），按"/"快速聚焦。
· 收藏侧栏。一个命令面板把全部书签 + 浏览历史都搜出来。
· AI 整理书签（可选）。一键把书签按概念归到 5–12 个类别。请求只携带标题与域名，从不发送完整 URL；结果本地缓存。
· 自带模型。开箱可用；也可以在设置里换成任意 OpenAI 兼容端点（用你自己的 Key）。
· 跨设备同步。设置与 AI 分类结果走 Chrome storage.sync，Pin 走 Chrome 书签同步。
· 中英双语界面。

开源、零追踪、无账号。除了 Chrome 自己的同步，所有数据都只留在你本地。
```

---

## 4. Single purpose statement (Dashboard → Privacy practices → Single purpose)

> NovaTab's single purpose is to replace Chrome's new tab page with a customizable launcher (search, pinned sites, bookmark/history access, optional AI bookmark grouping). All listed features serve that one job; no functionality runs outside the new tab override.

---

## 5. Permission justifications (Dashboard → Privacy practices → Permission justification)

The Web Store asks for one short justification per declared permission. Limit ≈ 1000 chars each; the snippets below stay well within that.

### `topSites` (required, always on)
> Used to render the "Most visited" row on the new tab page so the user can jump to their frequent sites with one click. Data stays in the page and is not transmitted.

### `storage` (required, always on)
> Persists user preferences (theme, wallpaper, language, default search engine, custom colors) and the AI-organized-bookmarks cache. Also used via `chrome.storage.sync` to mirror those preferences across the user's signed-in Chrome installs. No third-party servers receive this data.

### `favicon` (required, always on)
> Used to render the site icon next to every pinned site, bookmark, history result, and "Most visited" tile via Chrome's built-in `chrome://favicon` resource. No external fetches.

### `bookmarks` (optional, requested at runtime)
> Two purposes: (1) read the user's bookmark library so they can search it from the in-page Library drawer and let the optional AI organizer group it into categories; (2) read/write the dedicated "HubTabPinData" folder under Other Bookmarks where the extension stores Speed Dial pins as real Chrome bookmarks (so Chrome's native sync handles pin sync across devices for free). The extension never modifies bookmarks outside that folder unless the user explicitly edits them through the in-page editor.

### `history` (optional, requested at runtime)
> Used to surface recent browsing history inside the Library drawer's search/command palette. History entries are read on demand and rendered locally; nothing is uploaded.

### `identity` & `identity.email` (optional, requested at runtime)
> Used only via `chrome.identity.getProfileUserInfo` to display the user's signed-in Google account email in the cloud-sync UI ("Synced as: alice@example.com"). The email is shown in the page only — never sent to any external server.

### `host_permissions: https://sa.lijiwang.top/*` (always on)
> The default AI endpoint bundled with the extension. Listed here so that `fetch()` to it is treated as same-origin and skips a CORS preflight the server does not implement. Only used when the user explicitly clicks "Organize bookmarks with AI"; the request body contains bookmark titles + domains (no URLs).

### `optional_host_permissions: *://*/*` (requested at runtime)
> If the user switches to a self-hosted AI endpoint in settings, the extension asks for runtime host permission for that specific origin only via `chrome.permissions.request({ origins: [...] })`. The wildcard pattern is required because we cannot predict the user's chosen host at build time; in practice only the user's chosen origin is ever granted.

---

## 6. Remote code disclosure

When the Dashboard asks **"Does your extension include remote code?"** answer **No**.

Justification (for reviewer notes): the extension does not load or execute remote scripts. It makes HTTPS API calls (chat completions, OpenAI-compatible) for the AI organize feature, which is data fetching, not remote code execution. All JavaScript shipped to the user is bundled in the `.crx`.

---

## 7. Data usage disclosure (Dashboard → Privacy practices → Data usage)

Tick exactly the boxes below and tick the **two compliance statements** at the bottom.

| Data type | Collected? | Notes |
|---|---|---|
| Personally identifiable information (name, email, ...) | ✅ Email (Chrome profile email) | Used only to display "signed-in as X" locally; never transmitted. |
| Authentication information | ❌ | |
| Financial / payment | ❌ | |
| Personal communications | ❌ | |
| Location | ❌ | |
| Web history | ✅ | Browsing history surfaced in the Library drawer; read locally, never transmitted. |
| User activity | ❌ | |
| Website content | ✅ Bookmarks | Bookmark titles + domains optionally sent to the AI endpoint when the user triggers AI organize. Full URLs are never sent. |
| Health information | ❌ | |

**Compliance statements (tick both):**
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases.
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.

---

## 8. Store assets to upload

Prepare these before hitting Submit. See `RELEASE.md` for capture tips.

| Asset | Size | Required? | Notes |
|---|---|---|---|
| Icon | 128×128 PNG | ✅ | Already at `public/icons/128.png` — Chrome reuses it. |
| Screenshots | 1280×800 **or** 640×400 PNG/JPEG | ✅ at least 1 (up to 5) | Show: (1) default mesh-gradient view with pins, (2) AI organize result, (3) Library drawer, (4) wallpaper customization, (5) settings drawer. |
| Small promo tile | 440×280 PNG/JPEG | optional | Recommended for better placement. |
| Marquee promo tile | 1400×560 PNG/JPEG | optional | Only needed if you apply for featured placement. |

---

## 9. Privacy policy URL

You will paste a URL here. Draft text is in `PRIVACY.md` — host it somewhere public (GitHub Pages, a Notion public page, your blog) and put the URL in the Dashboard.

---

## 10. Support / contact email

Required. Use the developer-account email you registered with, e.g. `lijiwang44@gmail.com`.
