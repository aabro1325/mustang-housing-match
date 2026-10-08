# Realtime shared backends that work inside an MV3 extension

Research for issue #5 (part of the map, #1). Vocabulary follows `CONTEXT.md`: **Shared List**, **Member** / **Owner**,
**Invitation Link**, **Saved Listing**, **Note**, **Tour**, **Status**. Features under test: F4 (Shared Roommate Master
List) and F6 (Tour and Decision Workflow) in `docs/product-brief.md`.

Researched 2026-10-07 against official documentation and first-party source code only. Every claim carries a link to the
page that owns it; where a page did not answer a question, that is said rather than guessed.

## Question

Several Members, on different machines and different Google accounts, must see each other's changes to one Shared List.
An Invitation Link must grant access, and "unauthorized users cannot access a private shared list" (F4). The client is a
Chrome Manifest V3 extension whose UI is a side panel, so the backend's client SDK must run under the extension CSP (no
remote code, no `eval`) in an extension page and, if needed, in a service worker that Chrome suspends when idle.

## Short answer

1. `chrome.storage.sync` cannot do this: it replicates data between Chrome browsers signed into the *same* Google
   account, nothing else, and is capped at roughly 100 KB. It is a per-user settings store, not a shared store.
2. All three candidate backends (Firebase, Supabase, PocketBase) ship plain-JavaScript SDKs that can be bundled into the
   extension and loaded under the default `script-src 'self'` policy. None of them needs `eval` or remote scripts for
   the paths this product uses.
3. Realtime subscriptions should live in the **side panel page**, not the service worker. The service worker is killed
   after 30 s of inactivity; Chrome only documents a keepalive for WebSocket traffic (Chrome 116+), which covers
   Supabase but not Firestore (WebChannel over HTTP) or PocketBase (Server-Sent Events). Firestore's full SDK also
   still calls `XMLHttpRequest` for some operations, which does not exist in service workers.
4. **Recommendation: Firebase (Cloud Firestore + anonymous Firebase Auth + Security Rules).** It is the only option
   where the official docs explicitly bless the extension path (`firebase/auth/web-extension`, anonymous sign-in with
   no offscreen document), it needs no server, no card, and no CAPTCHA, and the Spark plan does not pause idle projects.
   Supabase is a close second and the better fit if the team would rather write SQL and RLS than Firestore rules; its
   free projects pause after a week of inactivity and anonymous sign-in is "strongly recommended" to sit behind a
   CAPTCHA that cannot be loaded under the extension CSP. PocketBase is the wrong shape here: self-hosted only, no
   anonymous auth, pre-1.0.

The data model and rule logic are sketched in the "Recommended design" sections at the end.

## What the extension platform allows

### Content Security Policy and remote code

- The default policy for extension pages (side panel, offscreen document, options page) and the service worker is
  `script-src 'self'; object-src 'self';`, and "the `extension_pages` policy cannot be relaxed beyond this minimum
  value" except to add `'wasm-unsafe-eval'` (and localhost for unpacked builds). The extension "won't run inline
  Javascript or be able to evaluate strings as executable code."
  [Chrome: content_security_policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- Remotely hosted code is forbidden by policy: "You can no longer execute external logic using `executeScript()`,
  `eval()`, and `new Function()`." CDN-hosted libraries count as remote code. Chrome's migration guide specifically
  warns: "Some libraries (Firebase, for example) fetch additional code as needed at runtime." The sanctioned pattern
  is to bundle libraries locally and declare `"background": {"type": "module"}` for the service worker. Fetching
  *data* at runtime (JSON, API calls, WebSockets) is fine: "You can still load data remotely at runtime."
  [Chrome: Improve extension security](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security)
- The warning about Firebase applies to the `signInWithPopup` / `signInWithRedirect` flows, which load
  `apis.google.com` scripts. Firebase's own guide confirms this: those flows "load code from outside the extension
  package. Starting in Manifest V3, this isn't allowed and will be blocked by the extension platform."
  [Firebase: Authenticate with Firebase in a Chrome extension](https://firebase.google.com/docs/auth/web/chrome-extension)

### Side panel

- The side panel is an ordinary extension page loaded from a packaged HTML file (`side_panel.default_path`), and "as an
  extension page, side panels have access to all Chrome APIs." It requires the `sidePanel` permission. Opening it
  programmatically (`sidePanel.open()`) "may only be called in response to a user action."
  [Chrome: chrome.sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- Chrome does not document the panel's load/unload lifecycle beyond `onOpened` / `onClosed`; like any page, its scripts
  run only while the document exists. Realtime listeners in the panel therefore run exactly while the user can see the
  list, which is what F4/F6 need ("changes made by one member appear for the other group members").

### Service worker lifetime

- Chrome terminates an extension service worker "after 30 seconds of inactivity. Receiving an event or calling an
  extension API resets this timer," and also "when a `fetch()` response takes more than 30 seconds to arrive." Since
  Chrome 116, "sending or receiving messages across a WebSocket in an extension service worker resets the service
  worker's idle timer." Chrome's advice: "avoid keeping your service worker alive indefinitely if possible" and "design
  your service worker to be resilient against unexpected termination."
  [Chrome: extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- The WebSocket keepalive recipe is to send a message every 20 s inside the "30s service worker activity window" and to
  set `"minimum_chrome_version": "116"`.
  [Chrome: Use WebSockets in service workers](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets)
- Service workers have no DOM and no `XMLHttpRequest`: MDN's availability note for XHR reads "This feature is available
  in Web Workers, except for Service Workers."
  [MDN: XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest)
- `EventSource` (SSE) is documented as available in Web Workers; MDN does not state service-worker availability.
  [MDN: EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)

### Offscreen documents

- An offscreen document is a hidden extension page for DOM work the service worker cannot do. It needs the `offscreen`
  permission, the URL must be "a static HTML file bundled with the extension", "an installed extension can only have
  one open at a time", and "the runtime API is the only extensions API supported by offscreen documents."
  [Chrome: chrome.offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- Firebase uses this pattern only for popup/redirect/phone/reCAPTCHA sign-in: the offscreen document embeds an iframe
  of a page you host (e.g. on Firebase Hosting) that runs `signInWithPopup`, and relays the result with `postMessage`.
  Anonymous sign-in does not need it (see Firebase below).

### Why `chrome.storage.sync` cannot be the backend

- `storage.sync` data "syncs with every Chrome browser that the user is logged into" using Chrome Sync; "if disabled,
  it behaves like `storage.local`." Nothing in the API addresses another user. Quotas: `QUOTA_BYTES` 102,400,
  `QUOTA_BYTES_PER_ITEM` 8,192, `MAX_ITEMS` 512, 120 writes/minute.
  [Chrome: chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
- So "sharing" through `storage.sync` would mean every Member signs into Chrome with the same Google account, which
  defeats the Member/Owner model, attribution of Notes, and the Invitation Link. It also could not hold a realistic
  Shared List (a few dozen Saved Listings with Notes already approaches 100 KB). It remains the right place for one
  student's **Preferences**, which are per person.

## Comparison

| | Firebase (Firestore + Auth) | Supabase (Postgres + Realtime + Auth) | PocketBase |
|---|---|---|---|
| Hosting | Google-managed, no server | Supabase-managed, no server | Self-hosted only ("PocketBase is self-hosted only") |
| SDK in side panel under extension CSP | Yes. Modular SDK bundled from npm; official Chrome-extension guide | Yes. `@supabase/supabase-js` bundled; plain fetch + WebSocket | Yes. `pocketbase` JS SDK bundled; plain fetch + `EventSource` |
| SDK in service worker | Auth: yes via `firebase/auth/web-extension` + `initializeAuth` with `indexedDBLocalPersistence`. Firestore: partially; `runTransaction` and other unary RPCs use `XMLHttpRequest` (open bug since 2022). Firestore Lite (fetch-only) works but has no `onSnapshot` | Yes after v2.50.2 (a 2025 release broke it with `require("ws")`); needs a `chrome.storage`-backed `auth.storage` adapter because there is no `localStorage` | Probably: SDK uses `fetch` and `EventSource`; auth store falls back to memory without `localStorage`, so a custom `AsyncAuthStore` is needed. Not documented |
| Realtime transport | WebChannel over HTTP streams (not WebSocket) | WebSocket | Server-Sent Events |
| Realtime can live in the side panel | Yes (recommended) | Yes (recommended) | Yes (recommended) |
| Realtime can survive SW suspension | No documented keepalive for non-WebSocket transports | Technically yes via the 20 s WebSocket keepalive, against Chrome's advice | No documented keepalive |
| Anonymous identity | `signInAnonymously`; listed as working directly in extensions; optional 30-day auto-cleanup (Identity Platform) | `signInAnonymously`; `is_anonymous` JWT claim; 30/hour/IP rate limit; CAPTCHA "strongly recommended"; no automatic cleanup | None. Auth collections support password, OTP, OAuth2, MFA only |
| Access control | Security Rules on document paths; `get()`/`exists()` lookups (10 per request) | Postgres RLS (`auth.uid()`, `auth.jwt()`), security-definer helper functions, RPC | Per-collection API rules with filter syntax (`@request.auth`, `@collection.*`) |
| Realtime honours access rules | Yes; listeners are queries, "rules are not filters" | Postgres Changes: per-event RLS check per subscriber, except DELETE; Broadcast: RLS on `realtime.messages` | List rule for collection topics, View rule for record topics |
| Free tier | Spark: "No payment method needed"; Firestore 1 GiB, 50K reads/day, 20K writes/day, 20K deletes/day, 10 GiB egress/month; exactly one free database per project | Free: 2 active projects, 500 MB DB, 50,000 MAU, 5 GB egress, Realtime 200 concurrent connections and 2M messages/month; "paused after 1 week of inactivity" | Software is MIT and free; you pay for a VPS (FAQ cites a $4/month Hetzner CAX11 handling 10,000+ realtime connections) |
| Card required | No (Spark) | Not stated on official pages I could read; the pricing page lists "from $0/month" | Depends on host |
| Who owns it | The Google Account that creates the Firebase (= Google Cloud) project; IAM shared with Cloud | The Supabase organization; 2 free projects across all orgs where you are Owner/Admin | Whoever rents the server and holds the superuser |
| Maturity | GA | GA | "NOT recommended for production critical applications yet"; v0.40.4, pre-1.0 |

## Firebase

**Running in the extension.** Firebase's Chrome-extension guide says to import from `firebase/auth/web-extension`
(Web SDK v10.8.0+) "in background scripts, service workers, and popup scripts". Methods that "work directly" there:
email/password, email link, **anonymous sign-in**, custom tokens, and `signInWithCredential` with a credential obtained
independently (e.g. from `chrome.identity`). Pop-up, redirect, phone and reCAPTCHA flows need the offscreen-document
relay described above. For federated providers the extension id must be added to Auth's authorized domains as
`chrome-extension://CHROME_EXTENSION_ID`.
[Firebase: Authenticate with Firebase in a Chrome extension](https://firebase.google.com/docs/auth/web/chrome-extension)

In a service worker `getAuth()` "pulls in code that reads from the `window` object, which will cause errors";
`initializeAuth(app, { persistence: indexedDBLocalPersistence })` without a `popupRedirectResolver` is the documented
form. [Firebase: Customize dependencies](https://firebase.google.com/docs/auth/web/custom-dependencies)

**Firestore transport.** The browser `WebChannelConnection` uses `XhrIo` (XMLHttpRequest) for unary RPCs in
`performRPCRequest` and a WebChannel (with an optional `useFetchStreams` flag) for the Listen/Write streams in
`openStream`. [firebase-js-sdk: webchannel_connection.ts](https://github.com/firebase/firebase-js-sdk/blob/main/packages/firestore/src/platform/browser/webchannel_connection.ts).
Consequences, confirmed in the issue tracker: the v8 SDK did not work in an MV3 service worker at all, v9 does for
ordinary reads/writes ([#6124](https://github.com/firebase/firebase-js-sdk/issues/6124)), but `runTransaction` still
fails with `ReferenceError: XMLHttpRequest is not defined` and the issue has been open since 2022; a maintainer notes
"Firestore Lite uses `fetch()` instead of `XMLHttpRequest`" ([#6483](https://github.com/firebase/firebase-js-sdk/issues/6483)).
Firestore Lite "omits latency compensation, offline caching, query resumption and snapshot listeners"
([Firebase: Firestore Lite](https://firebase.google.com/docs/firestore/solutions/firestore-lite)), so the service worker
can at most do REST-style writes; realtime belongs in the side panel.

**Realtime.** `onSnapshot()` on a document or query delivers an initial snapshot and "each time the contents change,
another call updates the document snapshot"; local writes fire listeners immediately (latency compensation) with
`metadata.hasPendingWrites` set. [Firebase: Get realtime updates](https://firebase.google.com/docs/firestore/query-data/listen)

**Access control.** "Every database request from a Cloud Firestore mobile/web client library is evaluated against your
security rules." [Firebase: Get started with rules](https://firebase.google.com/docs/firestore/security/get-started)
Rules can read other documents with `get()` / `exists()`; the limit is 10 document-access calls for single-document
and query requests (20 for batched writes/transactions), and "exceeding either limit results in a permission denied
error." [Firebase: Writing conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
"Security rules are not filters—queries are all or nothing": a query must carry the same constraint the rule checks.
[Firebase: Securely query data](https://firebase.google.com/docs/firestore/security/rules-query)

**Anonymous auth.** Enable the Anonymous provider in the console, call `signInAnonymously(auth)`, observe
`onAuthStateChanged`. Upgrade later with `linkWithCredential`; "the user's new account can access the anonymous
account's Firebase data." Projects on Identity Platform can "automatically delete anonymous accounts older than 30
days." [Firebase: Anonymous auth](https://firebase.google.com/docs/auth/web/anonymous-auth)

**Cost and ownership.** Spark plan: "No payment method needed." Firestore no-cost usage: 1 GiB stored, 50K reads/day,
20K writes/day, 20K deletes/day, 10 GiB egress/month; Authentication lists 50K MAU no-cost (Identity Platform tier);
Blaze is pay-as-you-go with Spark's free usage included. [Firebase pricing](https://firebase.google.com/pricing)
"Cloud Firestore allows exactly one free database per project." [Firestore quotas](https://firebase.google.com/docs/firestore/quotas)
"A Firebase project is actually just a Google Cloud project"; IAM "permissions and roles for the project are shared
across Firebase and Google Cloud." [Firebase: Understand projects](https://firebase.google.com/docs/projects/learn-more)
Note that rules `get()` calls are billed reads ("even if your rules reject the request"), and a realtime listener is
billed one read per document that changes.

## Supabase

**Running in the extension.** `supabase-js` is plain JavaScript (fetch + WebSocket) and bundles without CSP trouble.
Two real-world caveats from the first-party tracker and docs: (1) release 2.50.0 broke MV3 service workers with
`Uncaught ReferenceError: require is not defined` from `require("ws")`; fixed in 2.50.2, with a user noting it was
"the third time" realtime broke on a minor update and the maintainer acknowledging the release process needed work
([supabase-js #1462](https://github.com/supabase/supabase-js/issues/1462)). (2) Session persistence defaults to
`localStorage` ("Set to `true` if you want to automatically save the user session into local storage"); the auth
options include `storage?: SupportedStorage` — "Provide your own local storage implementation to use instead of the
browser's local storage" — which a service worker (no `localStorage`) must point at `chrome.storage`.
[Supabase: Initializing](https://supabase.com/docs/reference/javascript/initializing),
[auth-js types.ts](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts)

**Realtime.** Two mechanisms:
- *Postgres Changes*: add the table to the `supabase_realtime` publication; set `replica identity full` for old
  values. "Postgres Changes authorizes every event against each subscriber", so a change to a table with 100
  subscribers costs 100 RLS checks, and "RLS policies are not applied to `DELETE` statements". Filters are
  server-side, AND-only. [Supabase: Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- *Broadcast from the database*: a trigger calls `realtime.broadcast_changes(...)` into `realtime.messages`;
  "This is the recommended method for scalability and security", Postgres Changes "does not scale as well".
  Private channels are authorised by RLS on `realtime.messages` using `realtime.topic()`; the client passes
  `config: { private: true }` and "the validation is done when the user connects" (cached for the connection).
  [Supabase: Subscribing to database changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes),
  [Supabase: Broadcast](https://supabase.com/docs/guides/realtime/broadcast),
  [Supabase: Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)

**Access control.** RLS per table with `(select auth.uid()) = user_id`; wrap helpers in `select` for per-statement
caching; index the filtered columns; break policy recursion with `security definer` functions ("It reads the
membership table as its owner, so the second policy never runs and the cycle is broken"); pin `search_path = ''`.
[Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
Database functions are callable with `supabase.rpc()`; "Prefer `security invoker`", and when using `security definer`
set the search path and revoke `execute` from `anon`/`public`. [Supabase: Database functions](https://supabase.com/docs/guides/database/functions)

**Anonymous auth.** `supabase.auth.signInAnonymously()`; anonymous users take the `authenticated` role and carry an
`is_anonymous` JWT claim for RLS. "It is strongly recommended to enable invisible CAPTCHA or Cloudflare Turnstile to
prevent abuse for anonymous sign-ins"; the endpoint is rate-limited to "30 requests per hour (with bursts up to 30
requests)" per IP. "Automatic cleanup of anonymous users is currently not available." Anonymous users lose access
after sign-out, clearing site data, or switching devices unless an identity is linked.
[Supabase: Anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous),
[Supabase: Going into prod](https://supabase.com/docs/guides/deployment/going-into-prod)
The CAPTCHA recommendation matters for an extension: CAPTCHA widgets are remote scripts, which the extension-pages
CSP cannot allow, so the sign-in would have to be moved into a hosted page via an offscreen document or skipped.

**Cost and ownership.** Free plan: "from $0/month", "Limit of 2 active projects", "500 MB database size", "50,000
monthly active users", "5 GB egress", Realtime "200 included" concurrent connections and "2 Million included" messages
per month, "Free projects are paused after 1 week of inactivity." Pro from $25/month. [Supabase pricing](https://supabase.com/pricing)
Realtime limits on Free: 200 concurrent connections, 100 messages/s, 100 channel joins/s.
[Supabase: Realtime limits](https://supabase.com/docs/guides/realtime/limits)
Billing is per organization; the two free projects are counted "across every organization where you are an Owner or
Administrator"; "paused projects do not count towards your free project limit."
[Supabase: Billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
MAU is "the number of distinct users who sign in or refresh their token during the billing cycle"; the docs do not
say whether anonymous users are excluded, so assume they count.
[Supabase: MAU](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users)
I could not confirm a credit-card requirement from an official page (the pricing page is script-rendered).

## PocketBase

**What it is.** "An open source backend consisting of embedded database (SQLite) with realtime subscriptions", run as
`./pocketbase serve` from a ~12 MB executable; MIT licensed (GitHub metadata); latest release v0.40.4 (2026-09-12);
"PocketBase is NOT recommended for production critical applications yet" and "full backward compatibility is not
guaranteed before reaching v1.0.0." [PocketBase docs](https://pocketbase.io/docs/),
[pocketbase/pocketbase](https://github.com/pocketbase/pocketbase)

**Hosting.** "PocketBase is self-hosted only"; it scales "only on a single server, aka. vertical"; "there is no paid
team or company behind it." Production guide: upload the binary to a server, systemd unit, built-in Let's Encrypt
TLS, backups to S3-compatible storage; many concurrent realtime connections can hit `Too many open files` and need a
raised `ulimit`. [PocketBase FAQ](https://pocketbase.io/faq), [Going to production](https://pocketbase.io/docs/going-to-production/)

**SDK in the extension.** The JS SDK is installed from npm; the default `LocalAuthStore` "uses the browser's
`LocalStorage` if available, otherwise - will fallback to runtime/memory", and `AsyncAuthStore` adapts "any 3rd party
async storage". Realtime is `pb.collection(name).subscribe(topic, cb)` over `EventSource`; Node needs a polyfill.
Nothing is said about worker contexts. [pocketbase/js-sdk](https://github.com/pocketbase/js-sdk)

**Realtime.** "The Realtime API is implemented via Server-Sent Events (SSE)." Subscribing to a whole collection
applies the collection's **List rule**; subscribing to one record applies its **View rule**. Idle connections close
after five minutes and the SDK reconnects. [PocketBase: Realtime](https://pocketbase.io/docs/api-realtime/)

**Access control.** Each collection has list/view/create/update/delete rules: `null` = superuser only, `""` = anyone,
otherwise a filter expression over the collection's fields ("This includes all nested relation fields too, ex.
`someRelField.status != "pending"`"), `@request.auth.*`, `@request.body.*`, and `@collection.other.*` for unrelated
collections, with `?=` for any-match over multi-valued fields. Rules double as filters on list results.
[PocketBase: API rules and filters](https://pocketbase.io/docs/api-rules-and-filters/)
Back-relations are written `comments_via_post` in filters/expands. [PocketBase: Relations](https://pocketbase.io/docs/working-with-relations/)
Custom endpoints (for a join-by-token flow) go in `pb_hooks` JavaScript (`routerAdd(...)`, embedded ES5 goja engine).
[PocketBase: JS overview](https://pocketbase.io/docs/js-overview/)

**Auth.** Auth collections support identity/password, OTP, OAuth2 and MFA. There is no anonymous mode, so the
extension would have to invent one (e.g. create a random password account per browser profile), which the docs
neither describe nor rule out. [PocketBase: Authentication](https://pocketbase.io/docs/authentication/)

## Mapping the Invitation Link onto each platform

The Invitation Link is "the unique URL that makes whoever opens it a Member of one Shared List" (`CONTEXT.md`). The
pattern that works on all three platforms:

1. A Shared List has a server-generated, unguessable id **and** a separate, rotatable `inviteToken` (both random,
   128-bit or more). The link carries `listId` and `inviteToken`.
2. The list document/row itself is readable only by Members, so the token never leaks through reads.
3. "Joining" is a **create** of a membership record for the caller's own uid that is allowed only when the supplied
   token matches the list's current token. The server checks the match (Firestore `get()`, Supabase RPC, PocketBase
   hook); the client never reads the token back.
4. Every other read/write on the list and its Saved Listings and Notes is allowed only if a membership record exists
   for `auth.uid`.
5. The Owner can rotate the token to revoke a leaked link and delete memberships to remove a Member.

| Step | Firestore | Supabase | PocketBase |
|---|---|---|---|
| Unguessable id | auto-generated document id (`addDoc`); token from `crypto.getRandomValues` stored on the list doc | `gen_random_uuid()` primary key; token column `default encode(gen_random_bytes(16),'hex')` | 15-char record id; token in a hidden field |
| Membership record | `lists/{listId}/members/{uid}` | `memberships(list_id, user_id)` with PK on both | `memberships` collection with `list` and `user` relations, unique index |
| Join check | `allow create` on the member doc if `uid == request.auth.uid` and `request.resource.data.token == get(list).data.inviteToken` | `security definer` function `join_list(list_id, token)` that verifies the token and inserts the membership | `pb_hooks` route `POST /join` that verifies and inserts; or a create rule comparing `@request.body.token` with the related list's token |
| Member gate | `exists(/lists/$(listId)/members/$(request.auth.uid))` | `is_member(list_id)` security-definer helper used in `using`/`with check` | `@request.auth.id != "" && @collection.memberships.list ?= id && @collection.memberships.user ?= @request.auth.id` |
| Realtime honours gate | yes (listener is a query under rules) | Postgres Changes: yes except DELETE; Broadcast: policy on `realtime.messages` using `realtime.topic()` | yes (List/View rule) |

Because an anonymous identity is tied to one browser profile, a Member who clears site data gets a new uid; they
re-open the Invitation Link and rejoin. Earlier Notes stay attributed to the old member record (keep the display name on
the Note). Linking the anonymous account to a Google identity later is possible on Firebase (`linkWithCredential`,
with a credential from `chrome.identity`) and Supabase (`linkIdentity`, manual linking enabled).

## Recommendation

**Use Firebase: Cloud Firestore for data, anonymous Firebase Auth for identity, Security Rules for access, with all
Firestore listeners in the side panel page.** Reasons, in order:

1. It is the only platform whose vendor docs explicitly cover MV3 extensions and list anonymous sign-in as working
   without an offscreen document or hosted page. No remote script, no CAPTCHA, nothing to add to the CSP for the
   paths we use.
2. No server and no card: Spark needs "no payment method", does not pause idle projects, and 50K reads/day covers a
   pilot of a few roommate groups many times over (a Shared List of 30 Saved Listings with Notes is a few hundred
   reads per session).
3. The membership-subcollection pattern expresses "unauthorized users cannot access a private shared list" in a
   dozen lines of rules, enforced identically for one-shot reads and realtime listeners.
4. Known limits are acceptable: do not use `runTransaction` or the full Firestore SDK from the service worker (use
   Firestore Lite there if a background write is ever needed), and keep the side panel as the realtime surface.

Supabase remains a defensible choice if the team prefers SQL; the deciding negatives were the one-week pause on Free
projects (a dormant pilot would break until someone unpauses it), the CAPTCHA recommendation that the extension CSP
cannot honour, and the record of SDK releases breaking the service-worker path. PocketBase is excluded by the hosting
burden, the absence of anonymous auth and its pre-1.0 status.

### What a human must provision (Firebase)

1. Create a Firebase project with a Google Account the team controls (it becomes a Google Cloud project; add
   teammates via IAM). Stay on Spark.
2. Create the single Firestore database (production mode) in a US region.
3. Authentication > Sign-in method: enable **Anonymous**. If the project is upgraded to Identity Platform, turn on
   30-day anonymous cleanup.
4. Register a Web app to obtain the `firebaseConfig` object; it is public configuration, not a secret, and is bundled
   into the extension.
5. Deploy the rules below with the Firebase CLI (`firebase deploy --only firestore:rules`) and the composite
   indexes it asks for.
6. Decide the Invitation Link format (see open questions) and, if a landing page is wanted, enable Firebase Hosting.

### Data model sketch (Firestore)

```
lists/{listId}
  name            string
  ownerUid        string          // creator; the Owner
  inviteToken     string          // random, rotatable; never read by clients
  createdAt       timestamp

lists/{listId}/members/{uid}
  uid             string          // == document id
  displayName     string
  role            "owner" | "member"
  joinedAt        timestamp

lists/{listId}/savedListings/{savedListingId}
  sourceUrl       string          // identifies the Listing
  normalizedAddress string        // for Duplicate detection
  facts           map             // Listing Facts with provenance (Listed / Not Listed / Estimated / Corrected)
  status          "Saved" | "Considering" | "Tour Scheduled" | "Applied" | "Rejected" | "Selected"
  finalist        boolean
  tour            { at: timestamp } | null
  landlordQuestions array<string>
  addedByUid      string
  createdAt, updatedAt timestamp

lists/{listId}/savedListings/{savedListingId}/notes/{noteId}
  authorUid       string          // attribution of the Note
  authorName      string
  text            string
  createdAt       timestamp

lists/{listId}/savedListings/{savedListingId}/fitScores/{uid}
  score           number          // one Member's Fit Score, written only by that Member; Group Fit = average
```

Fit Score and Group Fit are not computed server-side: each Member computes a Fit Score locally from Listing Facts and
their own Preferences (which stay in `chrome.storage.sync`); Group Fit needs Members' scores, so each Member writes
their score into `fitScores/{uid}` and every Member averages the documents they can read.

Finding "my lists" uses a collection-group query on `members` constrained to `uid == auth.uid` (allowed by the
`match /{path=**}/members/{uid}` rule below, rules version 2). The side panel then opens one `onSnapshot` on
`lists/{listId}/savedListings` and one on the notes of the Saved Listing being viewed.

### Rules sketch (Firestore)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function listPath(listId) { return /databases/$(database)/documents/lists/$(listId); }
    function isMember(listId) {
      return signedIn() && exists(/databases/$(database)/documents/lists/$(listId)/members/$(request.auth.uid));
    }
    function isOwner(listId) {
      return signedIn() && get(listPath(listId)).data.ownerUid == request.auth.uid;
    }

    // Collection-group query for "lists I belong to": a member may read only their own membership docs.
    match /{path=**}/members/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
    }

    match /lists/{listId} {
      // Non-members cannot read the list, so inviteToken is never exposed by a read.
      allow read: if isMember(listId);
      allow create: if signedIn()
                    && request.resource.data.ownerUid == request.auth.uid
                    && request.resource.data.inviteToken is string
                    && request.resource.data.inviteToken.size() >= 32;
      // Owner may rename or rotate the token; nobody may change the owner.
      allow update: if isOwner(listId)
                    && request.resource.data.ownerUid == resource.data.ownerUid;
      allow delete: if isOwner(listId);

      match /members/{uid} {
        allow read: if isMember(listId);
        // JOIN: create your own membership by presenting the current invite token.
        // get() runs server-side, so the token is checked without ever being readable.
        allow create: if signedIn()
                      && uid == request.auth.uid
                      && request.resource.data.uid == uid
                      && request.resource.data.role == (get(listPath(listId)).data.ownerUid == uid ? 'owner' : 'member')
                      && request.resource.data.token == get(listPath(listId)).data.inviteToken;
        // Leave, or be removed by the Owner.
        allow delete: if signedIn() && (uid == request.auth.uid || isOwner(listId));
        allow update: if false;
      }

      match /savedListings/{savedListingId} {
        allow read, create, update, delete: if isMember(listId);

        match /notes/{noteId} {
          allow read: if isMember(listId);
          allow create: if isMember(listId) && request.resource.data.authorUid == request.auth.uid;
          allow update, delete: if isMember(listId) && resource.data.authorUid == request.auth.uid;
        }

        match /fitScores/{uid} {
          allow read: if isMember(listId);
          allow write: if isMember(listId) && uid == request.auth.uid;
        }
      }
    }
  }
}
```

Why this satisfies "unauthorized users cannot access a private shared list": every path under `lists/{listId}`
requires `isMember(listId)`, which is an `exists()` on a membership document keyed by the caller's verified uid; the
list id alone (even if guessed) grants nothing, because reading the list or its contents without a membership is
denied, and creating a membership requires the token, which lives only in the unreadable list document and in the
Invitation Link. The `token` field the joiner writes onto their own membership document is compared by the rule and
is otherwise inert; it can be stripped later by a Cloud Function if the team prefers not to persist it, and it stops
matching as soon as the Owner rotates the list token. Each request uses at most two `get()`/`exists()` calls, inside
the limit of 10. Listener queries must mirror the rule: `onSnapshot(collection(db, 'lists', listId, 'savedListings'))`
is a `list` request on a path guarded by `isMember`, so a non-member's listener fails at subscription time rather than
receiving a filtered stream.

### Equivalent on Supabase, for the record

```sql
create table lists (id uuid primary key default gen_random_uuid(), name text, owner_id uuid references auth.users,
  invite_token text not null default encode(gen_random_bytes(16),'hex'));
create table memberships (list_id uuid references lists on delete cascade, user_id uuid references auth.users,
  role text, primary key (list_id, user_id));
create table saved_listings (id uuid primary key default gen_random_uuid(), list_id uuid references lists on delete cascade, ...);
create table notes (id uuid primary key default gen_random_uuid(), saved_listing_id uuid references saved_listings on delete cascade,
  author_id uuid references auth.users, text text, created_at timestamptz default now());

create function is_member(l uuid) returns boolean language sql security definer set search_path = '' as
  $$ select exists (select 1 from public.memberships m where m.list_id = l and m.user_id = (select auth.uid())) $$;

alter table lists enable row level security;   -- and the other three
create policy "members read lists" on lists for select to authenticated using (is_member(id));
-- invite_token must additionally be hidden with a view or column privileges, since RLS is row-, not column-level.
create function join_list(l uuid, token text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.lists where id = l and invite_token = token) then raise exception 'invalid invitation'; end if;
  insert into public.memberships(list_id, user_id, role) values (l, (select auth.uid()), 'member') on conflict do nothing;
end $$;
revoke execute on function join_list from public, anon; grant execute on function join_list to authenticated;
```

Realtime: enable `saved_listings` and `notes` in the `supabase_realtime` publication (or add
`realtime.broadcast_changes` triggers and a `realtime.messages` policy that checks `is_member` against
`realtime.topic()`), and subscribe from the side panel with `filter: 'list_id=eq.<id>'`.

## Open questions for the next ticket

- **Invitation Link format.** A `chrome-extension://<id>/join.html?list=…&t=…` URL only works once the extension is
  installed and the id is fixed (the id is stable only after publishing or pinning a `key`). A hosted landing page
  (Firebase Hosting) that shows install instructions and hands the parameters to the extension is friendlier; a
  pasteable invite code inside the panel is the zero-infrastructure fallback.
- **Identity durability.** Anonymous uids die with the browser profile. Decide whether to offer "link my Google
  account" via `chrome.identity` + `signInWithCredential` (works directly in extensions per Firebase) in v1 or later.
- **Duplicate detection** needs `normalizedAddress` and `sourceUrl` indexed per list; a client-side check before
  `addDoc` suffices at this scale.
- **Offline.** Firestore's IndexedDB persistence in the side panel gives F6's "notes and decisions remain saved after
  users close and reopen" even without connectivity; confirm `persistentLocalCache` behaves in an extension page.

## Sources

Chrome: [CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) ·
[Improve security / remote code](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security) ·
[Service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) ·
[Service worker basics](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics) ·
[WebSockets in service workers](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) ·
[chrome.sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) ·
[chrome.offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen) ·
[chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage) ·
[Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)

MDN: [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) ·
[EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)

Firebase: [Auth in a Chrome extension](https://firebase.google.com/docs/auth/web/chrome-extension) ·
[Custom dependencies](https://firebase.google.com/docs/auth/web/custom-dependencies) ·
[Anonymous auth](https://firebase.google.com/docs/auth/web/anonymous-auth) ·
[Realtime updates](https://firebase.google.com/docs/firestore/query-data/listen) ·
[Rules: get started](https://firebase.google.com/docs/firestore/security/get-started) ·
[Rules: conditions](https://firebase.google.com/docs/firestore/security/rules-conditions) ·
[Rules: queries](https://firebase.google.com/docs/firestore/security/rules-query) ·
[Firestore Lite](https://firebase.google.com/docs/firestore/solutions/firestore-lite) ·
[Quotas](https://firebase.google.com/docs/firestore/quotas) · [Pricing](https://firebase.google.com/pricing) ·
[Projects](https://firebase.google.com/docs/projects/learn-more) ·
[firebase-js-sdk webchannel_connection.ts](https://github.com/firebase/firebase-js-sdk/blob/main/packages/firestore/src/platform/browser/webchannel_connection.ts) ·
[firebase-js-sdk #6124](https://github.com/firebase/firebase-js-sdk/issues/6124) ·
[firebase-js-sdk #6483](https://github.com/firebase/firebase-js-sdk/issues/6483)

Supabase: [Anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous) ·
[Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) ·
[Subscribing to database changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes) ·
[Broadcast](https://supabase.com/docs/guides/realtime/broadcast) ·
[Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization) ·
[Realtime limits](https://supabase.com/docs/guides/realtime/limits) ·
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) ·
[Database functions](https://supabase.com/docs/guides/database/functions) ·
[Initializing supabase-js](https://supabase.com/docs/reference/javascript/initializing) ·
[auth-js types.ts](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts) ·
[supabase-js #1462](https://github.com/supabase/supabase-js/issues/1462) ·
[Pricing](https://supabase.com/pricing) · [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase) ·
[MAU](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users) ·
[Going into prod](https://supabase.com/docs/guides/deployment/going-into-prod)

PocketBase: [Docs](https://pocketbase.io/docs/) · [FAQ](https://pocketbase.io/faq) ·
[API rules and filters](https://pocketbase.io/docs/api-rules-and-filters/) ·
[Realtime](https://pocketbase.io/docs/api-realtime/) · [Relations](https://pocketbase.io/docs/working-with-relations/) ·
[Authentication](https://pocketbase.io/docs/authentication/) · [JS overview](https://pocketbase.io/docs/js-overview/) ·
[Going to production](https://pocketbase.io/docs/going-to-production/) ·
[pocketbase/js-sdk](https://github.com/pocketbase/js-sdk) · [pocketbase/pocketbase](https://github.com/pocketbase/pocketbase)
