# Chrome side panel and MV3 constraints for the Figma flow

Resolves GitHub issue #7. Researched 2026-10-07 against the official Chrome extension docs
(developer.chrome.com/docs/extensions). Every claim carries a bracketed citation into the
[Sources](#sources) list. Where the official docs are silent, this note says so instead of guessing.

The Figma shows one persistent 420px side panel with a four-tab bar (Match, Saved, Compare,
Roommates) that stays open while the student browses listings, and a content script that captures
Listing Facts from the active tab on "Analyze Listing". The questions below are the ones that flow
raises, in the order the ticket asked them.

## TL;DR

- `chrome.sidePanel` needs Chrome 114; `sidePanel.open()` needs Chrome 116. Set
  `"minimum_chrome_version": "116"`. [S1]
- Use one **global** panel (`side_panel.default_path`) enabled on every site and open it on
  toolbar click with `setPanelBehavior({ openPanelOnActionClick: true })`. A global panel stays
  open as the user switches tabs and navigates; a panel that is *disabled* for a tab or site hides or
  closes instead, so per-site enabling would kill the Saved/Compare/Roommates tabs the moment the
  student leaves a listing. Show an "Unsupported Page" state inside the Match tab instead. [S1]
- The panel is an ordinary extension page with access to every Chrome API, so it can find the active
  tab itself (`tabs.query({ active: true, lastFocusedWindow: true })`, `tabs.onActivated`,
  `tabs.onUpdated`). Reading `tab.url` requires either the `"tabs"` permission (install warning
  "Read your browsing history") or a host permission for that tab's site. Declared host permissions
  for the pilot Sources give URLs on exactly the tabs we care about, with no `"tabs"` permission. [S1] [S9] [S11]
- Chrome does not document the panel width and the extension cannot set it; the user picks the
  side (left/right) and drags the width. Treat 420px as a target and build fluid. [S1]
- The service worker dies after 30s idle and loses all globals; any event (including an incoming
  `runtime.sendMessage`) revives it. Register listeners at top level; keep state in
  `chrome.storage`. [S3] [S4]
- The simplest capture path needs no messaging at all: the panel's "Analyze Listing" click calls
  `chrome.scripting.executeScript({ target: { tabId }, files: ["..."] })` and reads the Listing
  Facts straight from the returned `InjectionResult[]`. [S7]
- `storage.sync` is tiny (100 KB total, 8 KB per item, 512 items, 120 writes/min) and falls back to
  `local` behaviour when the user has sync off; `storage.local` is 10 MB (lifted by
  `unlimitedStorage`). Preferences -> `sync`; Scorecard cache -> `local`; session tokens -> `session`. [S5]
- MV3 CSP for extension pages is `script-src 'self'; object-src 'self';` and cannot be relaxed
  beyond adding `'wasm-unsafe-eval'`: no inline scripts, no CDN scripts, no `eval`, and no remotely
  hosted code anywhere. Bundled npm libraries are fine; libraries that `import()` code at runtime
  (the docs name Firebase) are not. [S10] [S12]
- The official docs are build-tool agnostic: tutorials are plain files, `"type": "module"` service
  workers support static `import` (but not dynamic `import()`), and the migration guide points to a
  Rollup example only for bundling third-party libraries. Nothing about an eight-screen panel forces
  a bundler; the sharing SDK chosen in #5 and the stack decision in #12 are what would. [S4b] [S12] [S13]

## 1. `chrome.sidePanel` behaviour

**Minimum version and manifest.** The API is "Chrome 114+ MV3+". `sidePanel.open()` arrived in
Chrome 116; `close()`/`onOpened` in 141; `onClosed` in 142; `getLayout()` in 140. Add `"sidePanel"`
to `permissions` and a `"side_panel": { "default_path": "..." }` key whose path "should point to a
relative path within the extension directory". [S1] `minimum_chrome_version` makes the Web Store
show "Not compatible" instead of an install button on older Chrome and silently stops updates for
users below it. [S14]

**Opening on action click.** Declare an `"action"` key, then call
`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` (defaults to `false`). The
docs' example does this from the service worker. [S1] `sidePanel.open({ windowId })` or
`open({ tabId })` can also be called programmatically but "may only be called in response to a user
action": an action click, keyboard shortcut, context menu item, or a user gesture on an extension
page or content script. At least one of `windowId`/`tabId` is required. [S1] The first-party
`cookbook.sidepanel-open` sample opens the panel from a content script by messaging the service
worker, which calls `sidePanel.open({ tabId: sender.tab.id })`. [S15]

**Global vs per-tab.** `setOptions()` without `tabId` sets the default (global) options that apply
to every tab without its own settings. With `tabId` it creates tab-specific options; `enabled:
false` disables the panel for that tab; `path` "must be a local resource within the extension
package". The docs warn that using the same path for the tab and the default creates separate panel
instances. `getOptions({ tabId })` returns the active configuration. Global panels are per window:
closing one with `windowId` closes it "for all tabs in that window" that have no tab-specific
panel. [S1]

**Persistence across tab switches and navigation.** The panel "remains open when navigating between
tabs (if set to do so)." If the user switches to a tab where the panel is not enabled, it is hidden
and reappears on return. If the user navigates to a *site* where the panel is not enabled, "the
panel closes and the extension is missing from the drop-down menu." [S1]

> Design consequence. The docs' "enable on a specific site" recipe (listen to `tabs.onUpdated`, call
> `setOptions({ tabId, enabled: url matches })`) is wrong for this product: Saved, Compare and
> Roommates must work on any page, so the panel must stay enabled everywhere. Supported vs
> Unsupported Page is a state of the Match tab, not of the panel.

**How the panel learns the active tab/URL.** "As an extension page, side panels have access to all
Chrome APIs." [S1] The Tabs reference's own pattern for "the user's current tab" is
`tabs.query({ active: true, lastFocusedWindow: true })`; `tabs.onActivated` fires on tab switch
(URL may not be set yet, so pair it with `tabs.onUpdated`, whose `changeInfo.url`/`changeInfo.status`
report navigation). [S9] `tab.url`, `title`, `favIconUrl` and `pendingUrl` are present only when the
extension has the `"tabs"` permission or a host permission for that page; `activeTab` grants the
same temporarily after a user invocation. [S9] [S11] The `"tabs"` permission carries the install
warning "Read your browsing history". [S8]

> Design consequence. With host permissions declared for the pilot Sources (issue #8), `tab.url` is
> populated exactly on Supported Pages and `undefined` elsewhere, which is the Supported/Unsupported
> signal US1 needs with no `"tabs"` permission and no browsing-history warning. The caveat is that a
> user who sets the extension's site access to "On click" withholds those hosts until they click the
> icon (section 4).

**Width and placement.** The docs give no width or size guidance. Users choose the side in Chrome
settings; `getLayout()` (Chrome 140+) only reports `"left"`/`"right"`. [S1] Nothing lets the
extension set or lock a width. Build the Figma's 420px layout fluid (the four-tab bar, score ring and
Compare columns must survive narrower drags).

**Lifetime.** The docs do not describe the panel page's lifetime. It is one HTML document per window
for a global panel [S1], so treat in-memory panel state as disposable and keep source of truth in
`chrome.storage` (which also emits `onChanged`, so two windows stay consistent). [S5]

## 2. Messaging: panel, service worker, content script

**Channels.** Content scripts send with `runtime.sendMessage()`/`runtime.connect()` and receive
with `runtime.onMessage`/`runtime.onConnect`. Extension pages (the side panel and the service
worker) reach a content script with `tabs.sendMessage(tabId, ...)`/`tabs.connect()`, and receive via
`runtime.onMessage`/`runtime.onConnect`. `tabs.sendMessage` requires the Tabs API, which content
scripts do not have. [S2] [S9] Content scripts can use `runtime`, `storage`, `i18n` and `dom`
directly; everything else goes through messages. [S6]

**Responses.** `sendResponse` must be called synchronously unless the listener returns literal `true`
to keep the channel open; from Chrome 148 (gradual rollout) a listener may return a Promise instead.
An `async` listener that returns nothing sends `null` and "can interfere with other listeners".
Only the first listener to respond affects the sender, so a message a content script broadcasts with
`runtime.sendMessage` reaches both the panel page and the service worker, but only one reply counts.
Give each message a `type` and have exactly one context answer each type. [S2]

**Security.** Treat messages from content scripts as attacker-controlled: validate and sanitise,
assume anything sent to a content script can leak to the page, prefer `JSON.parse`/`innerText`
over `eval`/`innerHTML`. [S2] For Mustang this means the panel must validate captured Listing Facts
(types, ranges, provenance enum) before scoring or saving.

**Waking a suspended service worker.** Chrome terminates the worker after 30 seconds of inactivity,
when a single request runs over 5 minutes, or when a `fetch()` takes over 30 seconds to respond.
"Events and extension API calls reset the idle timer. A dormant worker is revived by an incoming
event." Globals are lost on shutdown; persist with `chrome.storage` or IndexedDB (Web Storage is
unavailable in extension service workers). [S3] Listeners must be registered synchronously at the
top level of the script, "not nested inside functions", so Chrome can dispatch events the moment the
worker starts; registering inside a `storage.get` callback is explicitly "Not advised". [S4] Since
Chrome 114, sending a message over a long-lived port keeps the worker alive (opening the port alone
does not); since Chrome 116 active WebSockets extend its lifetime. [S3]

**Programmatic injection.** `scripting.executeScript({ target: { tabId }, files | func, args })`
needs the `"scripting"` permission plus host access via `host_permissions` or `activeTab`. Exactly
one of `files` (paths relative to the extension root) or `func` (serialised; closures lost; `args`
JSON-serialisable) must be set; strings cannot be executed. It resolves to `InjectionResult[]` with
one entry per frame, main frame first; if the injected code returns a promise Chrome awaits it and
returns the resolved value. Default world is `ISOLATED`. [S7]

> Recommended capture flow. The side panel is an extension page, so it can call `chrome.scripting`
> directly [S1] [S7]. On "Analyze Listing": `tabs.query` for the active tab, then
> `executeScript({ target: { tabId }, files: ["src/capture/capture.js"] })`, whose last expression
> evaluates to the Listing Facts object, and read `results[0].result`. No static `content_scripts`,
> no `web_accessible_resources`, no message bus, and nothing runs on a listing page until the
> student asks. The service worker is then only needed for `onInstalled` (`setPanelBehavior`),
> and later for alarms/sync. If live Supported Page detection on the page itself is wanted (a badge
> or on-page affordance), add static `content_scripts` for the pilot Sources; those are the only
> case that needs the message channel.

## 3. Storage: `local` vs `sync` vs `session`

| Area | Quota | Behaviour | Fit |
|---|---|---|---|
| `storage.local` | 10,485,760 bytes (10 MB; 5 MB before Chrome 114); "ignored if the extension has the `unlimitedStorage` permission" | Cleared when the extension is removed; exposed to content scripts | Scorecard cache, captured Listings, Corrections, commute results |
| `storage.sync` | `QUOTA_BYTES` 102,400; `QUOTA_BYTES_PER_ITEM` 8,192; `MAX_ITEMS` 512; `MAX_WRITE_OPERATIONS_PER_HOUR` 1,800; `MAX_WRITE_OPERATIONS_PER_MINUTE` 120 | "If disabled, it behaves like `storage.local`" (user not syncing); exposed to content scripts | Preferences (one small object), active Shared List id |
| `storage.session` | 10,485,760 bytes (1 MB before Chrome 112) | In memory; cleared on disable/reload/update/browser restart; not exposed to content scripts unless `setAccessLevel()` widens it | Auth/session tokens for the sharing backend (#5, #10) |

All from [S5]. `storage.onChanged` fires with `(changes, areaName)` for every area and is the right
way for the panel to re-render when the service worker or another window writes. [S5] The docs do
not call storage encrypted or unencrypted; their only guidance is "If you're working with sensitive
user data, instead use `storage.session`." [S5] Do not put Scorecards in `sync`: one Scorecard with
Benefits, Watch-outs, Cost Breakdown and Landlord Questions can approach the 8 KB per-item cap, and
re-scoring on every Preference change would hit the 120 writes/minute limit. `unlimitedStorage`
shows no install warning [S8], but 10 MB of `local` is ample for a pilot cache; add it only if the
cache stores page snapshots.

## 4. Host permission strategy and what the install prompt shows

**Mechanics.** `permissions` and `host_permissions` are granted at install; `optional_permissions`
and `optional_host_permissions` are "granted by the user at runtime, instead of at install time".
Host permissions are needed for `fetch()` from extension pages/service worker, reading sensitive tab
properties, programmatic injection, and `webRequest`/`cookies`/`declarativeNetRequest`; manifest
`content_scripts` do not need a separate host permission (their `matches` already count). "Adding
or changing match patterns in the `host_permissions` and `content_scripts.matches` fields ... will
also trigger a warning", and a warning-triggering permission added in an update leaves "the extension
... disabled until the user accepts the new permission". [S10b] [S11b]

**Warnings by permission.** `activeTab`, `storage`, `scripting`, `sidePanel`, `unlimitedStorage`,
`alarms`, `contextMenus`: no install warning listed. `tabs`: "Read your browsing history" (suppressed
if `<all_urls>` is also requested). [S8] [S11b] The Permissions reference does not print the host
warning strings; the match-patterns page notes that `<all_urls>` "face[s] longer Chrome Web Store
review times". [S8] [S16] To see the exact dialog, pack the extension (`chrome://extensions` ->
Pack extension) and drop the `.crx` on the Extensions page, or use the Extension Update Testing
Tool. [S11b]

**`activeTab`.** Grants temporary host access to the active tab when the user clicks the action,
runs a command, picks a context-menu item or accepts an omnibox suggestion. It allows
`scripting.executeScript`/`insertCSS` (with `"scripting"`) and reading the tab's URL/title/favicon.
It survives same-origin navigation (example.com -> example.com/foo) and is revoked when the user
navigates to another site or closes the tab. It "does not display a permission warning". The
activeTab page does not mention side panels, and a click *inside* the side panel is not in its list
of invoking gestures, so do not assume a panel button grants it. [S11]

**Runtime requests.** `permissions.request()` "must be requested from inside a user gesture, like a
button's click handler" (a side-panel button qualifies). Chrome prompts only if the new permissions
carry warnings the user has not already accepted; the promise resolves `true` on grant. To request
hosts discovered at runtime, list `"https://*/*"` in `optional_host_permissions`; the request itself
should name the specific origin (paths are ignored). `permissions.contains()` checks state;
`permissions.remove()` gives it back. [S17]

**User-side controls.** Since Chrome 70 users can set an extension's site access to "On click", "On
specific sites" or "On all sites" from `chrome://extensions` or the extension menu. On "On click" the
extension "essentially behaves as though it used the activeTab permission" and the icon is badged;
`permissions.contains()` reports whether an origin is currently granted. The official guide for this
is MV2-era but the user controls are unchanged. [S18]

**Options compared.**

| Strategy | Install prompt | Capture on a Source | Supported Page detection | Cost |
|---|---|---|---|---|
| A. Declared `host_permissions` for pilot Sources | One host warning per pattern set (and the extension is disabled on update until the user re-accepts if Sources are added later) | Works automatically | `tab.url` present on Sources, absent elsewhere | Adding a Source later is a disruptive update; users may still set "On click" |
| B. `activeTab` + `scripting` only | No warning | Only after a toolbar click on that tab; lost when the student opens a different Source | Needs `"tabs"` (history warning) or the user to click first | Fragile for a panel that stays open while browsing; panel clicks are not documented as activeTab gestures |
| C. `activeTab` + `optional_host_permissions: ["https://*/*"]`, request per Source from the panel | No warning at install; one prompt per Source on first Analyze | Works after a one-time grant per Source | `tab.url` present on granted Sources | More code (grant flow, "On click" fallback), least alarming store listing, Sources can be added without an update |

**Recommendation.** Ship A for the pilot's fixed Source list from #8 (predictable, no runtime prompt
flow to build, URL-based Supported Page detection for free) and include
`optional_host_permissions: ["https://*/*"]` from day one so a long-tail Source (a Facebook group, a
property manager's own site) can be enabled from the panel without a disruptive update. Keep
`activeTab` too: it is free of warnings and is what the "On click" user setting degrades to. If #2
decides on a public store listing where the first-impression prompt matters most, flip to C.

## 5. CSP, ES modules, bundlers and remote code

**CSP.** The default `extension_pages` policy is exactly `script-src 'self'; object-src 'self';`.
The minimum is `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';` and "cannot be relaxed
beyond this minimum value"; adding `'unsafe-eval'` is an install-time error. Inline scripts and
string-to-code evaluation are blocked. The `sandbox` policy (for sandboxed pages without API
access) is more lenient. [S10] `script-src`, `object-src` and `worker-src` may use only `'self'`,
`'none'`, `'wasm-unsafe-eval'` and, for unpacked extensions only, localhost sources. [S12]

**Remote code.** "In Manifest V3, all of your extension's logic must be part of the extension
package." No CDN scripts, no fetched JS, no `eval`/`new Function` on remote strings (they still work
inside sandboxed iframes). Remote *data* and configuration JSON are fine. Bundle libraries locally;
beware libraries "like Firebase" that fetch code at runtime: pick one that does not, or "download
all possible dynamic imports at build time" (the docs link a Rollup example). [S12] This is a hard
input to #5 (realtime backend SDK).

**Service worker modules.** `"background": { "service_worker": "...", "type": "module" }` enables
static `import`; "Dynamic `import()` is not supported" in the worker, nor are import assertions.
`importScripts()` works without the module flag. The worker must be in the package and is a single
entry file that pulls in others by `import`. [S4b]

**Content script modules.** The `content_scripts` manifest key has no `type` field and the docs
never mention ES modules in content scripts [S6b]; `web_accessible_resources` is the mechanism that
lets a page-side script `fetch`/`import` extension files via `runtime.getURL()`, at the cost of
making those files fingerprintable by the listed sites (`use_dynamic_url: true` mitigates with a
per-session ID). [S19] The `chrome-extension/` loader in this repo (classic script that
`import()`s `main.js` from `web_accessible_resources`) is that pattern; it works but is undocumented
as a content-script module strategy. The `executeScript({ files })` capture flow in section 2 avoids
needing it at all.

**Build tooling.** The official docs name no bundler or framework. The getting-started tutorial's
only structural requirement is `manifest.json` at the extension root; it reloads the extension for
manifest/worker/content-script changes and notes that extension HTML pages (the side panel included)
do not need a reload. It suggests the `chrome-types` npm package for editor completion. [S13] The
only bundling guidance is the Rollup pointer for third-party libraries above. [S12]

**No-build vanilla vs Vite for an eight-screen panel.** Both satisfy the constraints above; what
differs is where friction lands.

- *No-build ES modules.* `<script type="module" src="...">` in `sidepanel.html` is `'self'` and
  passes CSP [S10]; shared scoring/cost modules can be imported by both the panel and the module
  service worker [S4b]; edits to panel HTML/CSS/JS need no extension reload [S13]. Eight screens
  are eight templates or eight `<section>`s toggled by a tiny router; no framework is required for
  that. Costs: no TypeScript, no npm libraries unless vendored by hand, and a sharing SDK (#5) would
  have to be copied into the package as a pre-built file.
- *Vite (or Rollup) bundle.* Needed the moment the team wants TypeScript, a component framework, or
  an npm backend SDK, because that SDK must be bundled locally anyway [S12]. Constraints to configure
  for: emit the service worker as one chunk with no code-splitting (dynamic `import()` is unsupported
  there [S4b]); emit the capture script as a classic self-contained file for `executeScript`
  [S7]; no inline scripts or `eval` in output [S10]; dev-server HMR injects localhost scripts, which
  CSP permits only for unpacked extensions [S12], so production builds must be fully static.

**Recommendation.** The side panel itself does not need a bundler; the backend decision does. If #5
lands on a REST/WebSocket backend callable with plain `fetch`/`WebSocket`, stay no-build (the
`chrome-extension/` layout minus its content-script loader). If #5 picks an npm SDK (Supabase,
Firebase, PocketBase client) or #12 picks TypeScript or a framework, adopt Vite with the three
constraints above. Either way, fix the layout now so the choice is a build-config change, not a
rewrite: `src/sidepanel/` (one HTML page, screens as modules), `src/background/service-worker.js`,
`src/capture/capture.js` (self-contained, no imports), `src/shared/` (scoring, cost, commute,
storage schema), importable from both the panel and the worker.

## Recommended `manifest.json` skeleton

Source host patterns are placeholders until #8 fixes the pilot Sources. Everything else is
settled by this note.

```json
{
  "manifest_version": 3,
  "name": "Mustang Housing Match",
  "version": "0.1.0",
  "description": "Evaluate off-campus rental listings against your priorities and decide together with your roommates.",
  "minimum_chrome_version": "116",

  "permissions": ["sidePanel", "storage", "scripting", "activeTab"],

  "host_permissions": [
    "*://*.zillow.com/*",
    "*://*.apartments.com/*",
    "*://*.craigslist.org/*"
  ],
  "optional_host_permissions": ["https://*/*"],

  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },

  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },

  "action": {
    "default_title": "Open Mustang Housing Match"
  },

  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

Notes on what is deliberately absent:

- No `"tabs"` permission: `tab.url` is readable on host-permitted Sources without it, and it would
  add the "Read your browsing history" warning. [S8] [S9]
- No `content_scripts` and no `web_accessible_resources`: capture is injected on demand with
  `scripting.executeScript({ files })`. Add `content_scripts` (with the same Source patterns) only if
  on-page Supported Page detection is wanted. [S7] [S19]
- No `content_security_policy`: the default is already the strictest useful policy and cannot be
  loosened in a way that helps. [S10]
- Add `"unlimitedStorage"` (no warning) only if the Scorecard cache outgrows 10 MB; add `"alarms"`
  (no warning) when background re-sync of Shared Lists needs a schedule. [S5] [S8]
- Service worker start-up, registered at top level:

```js
// src/background/service-worker.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);
});
```

## Open questions this note hands to other tickets

- #8: the pilot Source list fixes `host_permissions`; each later addition is a warning-bearing
  update that disables the extension until re-accepted, so the optional-host grant flow is worth
  building if the list is expected to grow. [S10b] [S11b] [S17]
- #5: the backend SDK must not fetch code at runtime and must be bundled into the package; a plain
  `fetch`/`WebSocket` API keeps the no-build option open. [S12]
- #12: the no-build vs Vite decision depends on #5 and on whether TypeScript/a framework is wanted;
  the panel's screen count does not decide it.
- Design: confirm the Figma frames work when the panel is dragged narrower than 420px, since width
  is user-controlled and not settable. [S1]

## Sources

All official Chrome extension documentation unless marked.

- [S1] chrome.sidePanel API reference: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- [S2] Message passing: https://developer.chrome.com/docs/extensions/develop/concepts/messaging
- [S3] Extension service worker lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- [S4] Events in service workers (top-level listener registration): https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/events
- [S4b] Extension service worker basics (`"type": "module"`, no dynamic `import()`): https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics
- [S5] chrome.storage API reference (quotas, areas, `onChanged`): https://developer.chrome.com/docs/extensions/reference/api/storage
- [S6] Content scripts concept (APIs available, isolated worlds, injection methods): https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- [S6b] `content_scripts` manifest key reference: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- [S7] chrome.scripting API reference: https://developer.chrome.com/docs/extensions/reference/api/scripting
- [S8] Permissions list (per-permission warnings): https://developer.chrome.com/docs/extensions/reference/permissions-list
- [S9] chrome.tabs API reference (`Tab.url` requirements, `query`, `onActivated`, `onUpdated`, `sendMessage`): https://developer.chrome.com/docs/extensions/reference/api/tabs
- [S10] `content_security_policy` manifest key: https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy
- [S10b] Declare permissions: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- [S11] activeTab: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- [S11b] Permission warnings: https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings
- [S12] Improve extension security (MV3 migration: remote code, CSP, bundling, Rollup example): https://developer.chrome.com/docs/extensions/develop/migrate/improve-security
- [S13] Hello World tutorial (plain-file layout, load unpacked, reload rules, `chrome-types`): https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world
- [S14] `minimum_chrome_version` manifest key: https://developer.chrome.com/docs/extensions/reference/manifest/minimum-chrome-version
- [S15] First-party sample linked from [S1], not a docs page: `cookbook.sidepanel-open` (manifest sets `minimum_chrome_version` 116; service worker calls `sidePanel.open({ tabId: sender.tab.id })` on a content-script message): https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/functional-samples/cookbook.sidepanel-open
- [S16] Match patterns: https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
- [S17] chrome.permissions API reference: https://developer.chrome.com/docs/extensions/reference/api/permissions
- [S18] User controls for host permissions (official, MV2-era page; describes the Chrome 70+ site-access settings): https://developer.chrome.com/docs/extensions/mv2/runtime-host-permissions
- [S19] `web_accessible_resources` manifest key: https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources
