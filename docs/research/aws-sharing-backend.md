# AWS realtime options for a Shared List from an MV3 extension

Research for issue #16 (part of the map, #1; blocks #10). Vocabulary follows `CONTEXT.md`: **Shared List**, **Member** /
**Owner**, **Invitation Link**, **Saved Listing**, **Note**, **Tour**, **Status**, **Fit Score**, **Group Fit**.
Features under test: F4 (Shared Roommate Master List) and F6 (Tour and Decision Workflow) in `docs/product-brief.md`.

Researched 2026-10-11 against official AWS documentation (docs.aws.amazon.com, docs.amplify.aws, aws.amazon.com pricing
pages), first-party source code in `aws-amplify/amplify-js`, and one measurement made for this ticket (a Vite build of
the Amplify client). Every claim carries a link to the page that owns it; where a page did not answer a question, that
is said rather than guessed. The access-model and data-model reasoning continues the Firebase research in
[`docs/research/sharing-backends.md`](https://github.com/aabro1325/mustang-housing-match/blob/research/sharing-backends/docs/research/sharing-backends.md)
(issue #5); the extension constraints come from
[`docs/research/side-panel-mv3.md`](https://github.com/aabro1325/mustang-housing-match/blob/research/side-panel-mv3/docs/research/side-panel-mv3.md).

## Question

The destination ticket chose AWS over Firebase. The developer supplies the AWS account and fills in a `.env`; the code
ships a `.env.example`. Which AWS building blocks give Members on different machines a realtime Shared List from inside
an MV3 side panel, with an Invitation Link access model where "unauthorized users cannot access a private shared list"
(F4), and what must the `.env` contain?

## Short answer

1. **Use AWS AppSync (GraphQL) + Amazon DynamoDB + a Cognito identity pool with guest access, defined with Amplify
   Gen 2 and deployed from the developer's laptop with `npx ampx sandbox`.** The side panel talks to AppSync with the
   Amplify JS v6 client over `fetch` and one WebSocket; nothing in that path needs `eval`, remote code, or a dynamic
   `import()`. A Vite build of `aws-amplify` 6.22.1 (Amplify core + `aws-amplify/data` + `aws-amplify/auth`) is one
   187 kB chunk (56 kB gzip) with zero `eval(`, `new Function(`, `import(` or `XMLHttpRequest` occurrences.
2. **Identity comes from the Cognito identity pool, not from an API key.** An API-key request has no identity
   (`ctx.identity` "isn't populated"), so an API key cannot express "this caller is a Member". Identity-pool guest
   credentials put a stable `cognitoIdentityId` on every request and every subscription, which the resolvers check
   against a membership record. Identity pools are free.
3. **Amplify's built-in authorization rules cannot express membership for guests** (`owner`/`group` rules need a user
   pool or OIDC), so every operation on a Shared List is a *custom* query/mutation/subscription whose AppSync
   JavaScript resolver enforces the Invitation Link model: unguessable list id, `inviteToken` checked by a
   conditional DynamoDB write on join, membership record required for every other read/write, and a subscribe-time
   membership check plus a server-side filter on `listId` for realtime. Amplify-generated model CRUD is not exposed.
4. **Guest identities persist across browser restarts** because Amplify caches the identity id in `localStorage` under
   `com.amplify.Cognito.<identityPoolId>.identityId`, and an extension page's `localStorage` lives as long as the
   extension does unless the user clears browsing data. Mirroring the id into `chrome.storage.local` (deleted only on
   uninstall) is a cheap hardening; losing it means rejoining via the Invitation Link, exactly as with Firebase.
5. **Cost for a handful of pilot groups rounds to zero**: AppSync bills $4 per million operations, $2 per million
   realtime updates and $0.08 per million connection-minutes; a 20-Member pilot is on the order of a dollar a month
   before any free tier or credits. Identity pools are free; DynamoDB has 25 GB always free. New AWS accounts (since
   July 15, 2025) get $100 of credits (up to $200) instead of the old 12-month free tier.
6. **Runners-up.** AppSync used directly without Amplify is the same service with more hand-written CloudFormation;
   choose it only if the team rejects the Amplify CLI. API Gateway WebSocket + Lambda + DynamoDB works but makes the
   team write connection tracking, fan-out, reconnection (10-minute idle / 2-hour maximum connection) and a second
   API for reads. AppSync Events is an excellent pub/sub channel but has no query model, so it only makes sense next
   to a store that lacks realtime; AppSync GraphQL already has it.

## What the extension platform allows (recap)

The constraints below are established in the two prior research notes and are repeated here only so the AWS findings
can be read against them.

- Extension pages (the side panel included) run under `script-src 'self'; object-src 'self';`, which cannot be relaxed
  beyond `'wasm-unsafe-eval'`; no inline scripts, no CDN scripts, no `eval`, no remotely hosted code. Bundled npm
  libraries are fine; data fetched at runtime (JSON, GraphQL, WebSockets) is fine.
  [Chrome: content_security_policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) ·
  [Chrome: Improve extension security](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security)
- The service worker is terminated after 30 s of inactivity; only WebSocket traffic resets its timer (Chrome 116+),
  and Chrome advises against keeping it alive. Realtime therefore lives in the side panel page.
  [Chrome: service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- Extension pages can use the Web Storage API but Chrome warns: "Data saved using the Web Storage API is lost when the
  user clears their browsing history", and "Extension service workers can't use the Web Storage API". `storage.local`
  stays until the extension is uninstalled; its limit is 10 MB without `unlimitedStorage`.
  [Chrome: chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage)

## Comparison

| | Amplify Gen 2 Data (AppSync + DynamoDB + identity pool) | AppSync directly (no Amplify CLI) | API Gateway WebSocket + Lambda + DynamoDB | AppSync Events beside a store |
|---|---|---|---|---|
| Realtime transport | AppSync GraphQL subscriptions over "pure WebSockets" (`graphql-ws` subprotocol); server keep-alives; connection auto-closes after 24 h | Same | API Gateway WebSocket; server pushes via `@connections`; closes at 10 min idle or 2 h maximum | WebSocket (`aws-appsync-event-ws`); keep-alive every 60 s; connection up to 24 h |
| Identity for guests | Cognito identity pool unauthenticated role; `ctx.identity.cognitoIdentityId` in resolvers | Same (AWS_IAM mode); or API key (no identity) | IAM (SigV4) or Lambda authorizer on `$connect` only | API key, IAM (identity pool), user pool, OIDC, Lambda; per-namespace override |
| Server-side membership enforcement | Custom operations with APPSYNC_JS resolvers: `GetItem` membership check, `util.unauthorized()`, conditional `TransactWriteItems` on join; subscribe-time check + `extensions.setSubscriptionFilter` | Same resolvers, written as CloudFormation/CDK/console | Lambda code on every route; connection table keyed by Member; you implement rooms and filtering | `onSubscribe`/`onPublish` handlers with DynamoDB data source can reject with `util.unauthorized()`; no read model |
| Realtime honours access rules | Yes: the subscription resolver runs when the client subscribes, with the caller's identity and data-source access | Yes (same mechanism) | Only what your Lambda does | Yes for subscribe/publish; nothing to protect on read because there is no read |
| Client under MV3 CSP | Measured: 1 chunk, 187 kB / 56 kB gzip; 0 `eval`, 0 `new Function`, 0 dynamic `import()`, 0 XHR; uses `fetch`, `new WebSocket`, `localStorage` | Same library, or hand-rolled SigV4 + WebSocket protocol | Plain `WebSocket` + `fetch`; SigV4 signing needs a library | `events` client from `aws-amplify/data` (experimental), or hand-rolled |
| Guest identity persists across restarts | Yes: identity id cached in `localStorage` (`com.amplify.Cognito.<poolId>.identityId`); 1-hour credentials refreshed from it | Same if using Amplify Auth; otherwise you cache the `GetId` result yourself ("The application is expected to cache this identity ID") | Same identity-pool mechanics | Same |
| Price (us-east-1) | $4.00/M queries+mutations, $2.00/M realtime updates (per 5 KB), $0.08/M connection-minutes; DynamoDB on-demand $0.625/M WRU, $0.125/M RRU; identity pool free | Same | $1.00/M messages (32 KB increments), $0.25/M connection-minutes; Lambda $0.20/M requests; DynamoDB as left | $1.00/M operations (per 5 KB), $0.08/M connection-minutes, plus the store |
| Free allowance | AppSync: 250K ops, 250K realtime updates, 600K connection-minutes, "expires after 12 months"; DynamoDB 25 GB always free; new accounts get credits instead | Same | WebSocket: 1M messages + 750K connection-minutes for 12 months; Lambda 1M requests + 400K GB-s/month | Events: 250K updates + 600K connection-minutes for 12 months |
| Human provisioning | AWS account, IAM Identity Center user with `AmplifyBackendDeployFullAccess`, `aws configure sso`, one-time CDK bootstrap; then `npx ampx sandbox` from the laptop | Account + deploy role; write and deploy the CloudFormation/CDK yourself | Account + deploy role; CDK/SAM for API, routes, Lambdas, tables, IAM | As Amplify, plus CDK `CfnApi` + `CfnChannelNamespace` in `backend.ts` |
| Deploy from laptop suffices? | Yes for a pilot (`ampx sandbox`, "not intended for production workloads"); branch deployments need an Amplify app connected to the Git repo | Yes (`cdk deploy` / CloudFormation) | Yes | Yes |
| Code the team writes | Schema + ~10 JS resolvers (a few hundred lines) | Same plus the infrastructure definitions | Connect/disconnect/authorizer Lambdas, fan-out Lambda, connection table, reconnect logic, plus a read API | Handlers plus a separate read API |

## Amplify Gen 2 Data

### Authorization rules and why guests need custom operations

- Strategies: `publicApiKey()` (API key), `guest()` (identity pool unauthenticated role, "Recommended for production
  environment's public data access"), `authenticated()`, `owner()`/`ownerDefinedIn()`, `group()`/`groupDefinedIn()`,
  `custom()` (Lambda). Rules are deny-by-default and "If there are multiple authorization rules present, they will be
  logically OR'ed." `owner` and `group` rules need `userPool` or `oidc`; "Dynamic rules (`owner`, `ownerDefinedIn`,
  `groupDefinedIn`, …) aren't supported on non-model types like custom queries and mutations."
  [Amplify: Customize your auth rules](https://docs.amplify.aws/react/build-a-backend/data/customize-authz/)
- `allow.guest()` maps to `authMode: 'identityPool'` and "Uses the unauthenticated role from your Cognito identity
  pool"; "The Auth resource in `amplify/auth/resource.ts` automatically generates scoped-down IAM policies for the
  unauthenticated role." "If you don't use the auto-generated `amplify_outputs.json`, you must set
  `allowGuestAccess: true` in the Amplify Auth configuration."
  [Amplify: Public data access](https://docs.amplify.aws/react/build-a-backend/data/customize-authz/public-data-access/)
- Consequence for this product: with guest identities only, the built-in rules can say "every guest may read/write this
  model" or nothing. They cannot say "only Members of list X". The model-level `owner` rule is unavailable to guests,
  and the ticket's requirement that "Unauthorized users cannot access a private shared list" is per-list. So the
  Shared List API is built from **custom operations** whose resolvers do the membership check (next section). The
  Amplify data layer is still worth using: it provisions AppSync, DynamoDB, the identity pool and IAM, generates the
  client types, and lets custom resolvers target tables as data sources.
- Custom operations: `a.query()`/`a.mutation()` with `.arguments()`, `.returns()`, `.authorization(allow => allow.guest())`
  and a handler. `a.handler.custom({ dataSource, entry })` runs an AppSync JavaScript resolver ("no cold starts");
  `dataSource: a.ref('Post')` "points to an existing model's DynamoDB table"; external tables are attached in
  `amplify/backend.ts` with `backend.data.addDynamoDbDataSource("ExternalTableDataSource", table)` and referenced by
  name. "All handlers must be of the same type" within one `.handler()`; "Async handlers can be used in function
  pipelines."
  [Amplify: Custom business logic](https://docs.amplify.aws/react/build-a-backend/data/custom-business-logic/)
- Custom subscriptions: `a.subscription().for(a.ref('publish')).arguments({...}).handler(a.handler.custom({ entry }))`
  with "a return type that matches the subscribed mutations' return type"; the handler's `request` returns
  `{ payload: null }` and `response` calls `extensions.setSubscriptionFilter(util.transform.toSubscriptionFilter(filter))`.
  "The custom subscription `.authorization()` modifier does not support the `owner` strategy." The page's examples
  pass only `entry` (no `dataSource`) and a single mutation to `.for()`; whether `.for()` accepts an array and whether
  a subscription handler may take a `dataSource` in Amplify's DSL is **not documented** and must be confirmed in #10
  (AppSync itself allows both: `@aws_subscribe(mutations: [...])` takes a list, and "you can attach resolvers to your
  subscription fields and perform logic using the identity of the caller and AWS AppSync data sources").
  [Amplify: Custom subscriptions](https://docs.amplify.aws/react/build-a-backend/data/custom-subscription/) ·
  [AppSync: Using subscriptions](https://docs.aws.amazon.com/appsync/latest/devguide/aws-appsync-real-time-data.html)
- Lambda authorizer (`allow.custom()`): `defaultAuthorizationMode: 'lambda'`, `lambdaAuthorizationMode.function`,
  `timeToLiveInSeconds`; the function receives `authorizationToken` and returns `isAuthorized`, optional
  `resolverContext`, `deniedFields`, `ttlOverride`. It is an alternative identity scheme (a client-held bearer secret
  looked up by the Lambda), not needed here because identity-pool credentials already identify the caller without a
  Lambda in the hot path.
  [Amplify: Custom data access patterns](https://docs.amplify.aws/react/build-a-backend/data/customize-authz/custom-data-access-patterns/)
- Model subscriptions (for completeness): `onCreate/onUpdate/onDelete` and `observeQuery` are automatic for
  `a.model()`; authorization is `read` OR `listen`; "Subscriptions reconnect automatically, but … messages missed while
  offline are not replayed"; connection state is observable via `Hub` (`CONNECTION_STATE_CHANGE`). The page never
  names the transport.
  [Amplify: Subscribe to real-time events](https://docs.amplify.aws/react/build-a-backend/data/subscribe-data/)

### Client configuration: `amplify_outputs.json` versus `.env`

- `amplify_outputs.json` is "the client configuration file". `auth`: `aws_region`, `user_pool_id`, `user_pool_client_id`,
  `identity_pool_id` (+ optional policy/oauth fields); `data`: `aws_region`, `url`, `model_introspection`, `api_key`,
  `default_authorization_type`, `authorization_types`. It is written by `ampx sandbox`, by CI, or by
  `ampx generate outputs`. "Overriding Amplify-managed configurations on amplify_outputs.json is not supported" (extend
  with `backend.addOutput()`). The page does not say whether to commit it.
  [Amplify: amplify_outputs.json](https://docs.amplify.aws/react/reference/amplify_outputs/)
- The CLI can only emit `json` or `dart`: `ampx sandbox --outputs-out-dir --outputs-format (json|dart) --identifier --once`;
  `ampx generate outputs --app-id --branch | --stack --format (json|dart)`; `ampx pipeline-deploy --branch --app-id`.
  There is no `.env` output, so a `.env` is either hand-filled from the JSON or produced by a tiny script.
  [Amplify: CLI commands](https://docs.amplify.aws/react/reference/cli-commands/)
- Manual configuration is supported by the library types (first-party source): `Amplify.configure({ Auth: { Cognito:
  { identityPoolId, allowGuestAccess } }, API: { GraphQL: { endpoint, region, defaultAuthMode } } })`.
  `AuthIdentityPoolConfig` exists without any user-pool fields (`userPoolId?: never`); `APIGraphQLConfig.endpoint` is
  required, `region` is "Required only if the auth mode is 'iam'", `apiKey` "Required only if the auth mode is
  'apiKey'", `defaultAuthMode` is one of `'apiKey' | 'oidc' | 'userPool' | 'iam' (deprecated) | 'identityPool' |
  'lambda' | 'none'`, and `modelIntrospection` is optional.
  [amplify-js: core/singleton/Auth/types.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/core/src/singleton/Auth/types.ts) ·
  [amplify-js: core/singleton/API/types.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/core/src/singleton/API/types.ts)
- The typed `client.queries.x()` / `client.mutations.x()` surface relies on `model_introspection`; `client.graphql({
  query, variables })` with hand-written documents does not. The connect page documents `authMode` per client
  (`'apiKey' | 'userPool' | 'identityPool' | 'oidc' | 'lambda'`) and per request, and a custom `endpoint` per client.
  [Amplify: Connect your frontend](https://docs.amplify.aws/react/build-a-backend/data/connect-to-API/)
- Vite exposes only `VITE_`-prefixed variables to client code, loads `.env`, `.env.local`, `.env.[mode]`,
  `.env.[mode].local`, expects `*.local` to be git-ignored, and warns that "`VITE_*` variables should _not_ contain
  sensitive information such as API keys" because they are embedded in the bundle.
  [Vite: Env variables and modes](https://vite.dev/guide/env-and-mode)

### Running inside the MV3 side panel

- Official position: there is no Amplify documentation for browser extensions. The 2021 feature request "Chrome Browser
  Extension Support (Auth)" is still open; maintainers said "This is not currently supported in Amplify" and pointed
  at custom storage. The 2022 bug "amplify-js appears to be incompatible with chrome extension service workers under
  manifest v3" (axios/XHR in the service worker) was closed in 2024 with "Amplify no longer relies on axios and should
  be more compatible with chrome extension service workers" (v6).
  [amplify-js #9260](https://github.com/aws-amplify/amplify-js/issues/9260) ·
  [amplify-js #10468](https://github.com/aws-amplify/amplify-js/issues/10468) ·
  [amplify-js #6197](https://github.com/aws-amplify/amplify-js/issues/6197)
- Measurement for this ticket (scratch project, `aws-amplify@6.22.1`, `vite@8.3.4`, imports `Amplify` from
  `aws-amplify`, `generateClient` from `aws-amplify/data`, `fetchAuthSession` from `aws-amplify/auth`, identity-pool
  guest config, `build.target: 'es2022'`, default minifier): output is a single `index-*.js` of **186.92 kB raw /
  56.45 kB gzip**. Grep of that chunk: `eval(` 0, `new Function(` 0, dynamic `import(` 0, `XMLHttpRequest` 0,
  `new WebSocket` 1, `fetch(` 2, `localStorage` 3, `appsync-realtime-api` 2, `graphql-ws` 1, `cognito-identity` 1.
  Nothing in the chunk requires a CSP relaxation; it is static code that opens `fetch` and `WebSocket` connections,
  which Chrome permits ("You can still load data remotely at runtime"). The latest release at research time is
  `aws-amplify@6.22.1` (2026-09-28).
  [amplify-js releases](https://github.com/aws-amplify/amplify-js/releases)
- Where the client runs: in the **side panel page**, as the prior note recommends. Amplify's default key-value store
  is `getLocalStorageWithFallback()` (in-memory when `localStorage` is absent), so running Amplify Auth inside the
  service worker would lose the guest identity every time the worker is killed; it also could not keep the WebSocket.
  If a background write is ever needed, the service worker can call `fetch` against the GraphQL endpoint with
  credentials handed over from the panel, or the panel can own all traffic.
  [amplify-js: core/storage/DefaultStorage.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/core/src/storage/DefaultStorage.ts)

### Guest identity and persistence

- Identity pools "provide temporary AWS credentials for users who are guests (unauthenticated)"; guest access "provides
  a unique identifier and AWS credentials for users who do not authenticate with an identity provider" and is switched
  on per pool. Deleting an identity from the pool means "When your user requests credentials again, they receive a new
  identity ID".
  [Cognito: Identity pools](https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html)
- Enhanced flow: `GetId` then `GetCredentialsForIdentity`; "The AWS credentials from enhanced authentication are valid
  for one hour." For unauthenticated access "users can request a new identity ID at any time via the `GetId` API. The
  application is expected to cache this identity ID to make subsequent calls to Amazon Cognito. The AWS Mobile SDKs and
  the AWS SDK for JavaScript in the Browser have credentials providers that handle this caching for you." Default
  console-created roles "have effectively no permissions granted."
  [Cognito: Identity pools authentication flow](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html)
- Amplify Gen 2: "Guest access is on by default"; disable via `cfnIdentityPool.allowUnauthenticatedIdentities = false`;
  the client reads the Identity ID through `fetchAuthSession`; the page does not describe caching.
  [Amplify: Guest access](https://docs.amplify.aws/react/build-a-backend/auth/concepts/guest-access/)
- First-party source fills the gap: `DefaultIdentityIdStore.storeIdentityId` writes a guest id with
  `keyValueStorage.setItem(this._authKeys.identityId, identity.id)` where the keys come from
  `createKeysForAuthStorage('Cognito', identityPoolId)`, i.e. `com.amplify.Cognito.<identityPoolId>.identityId`; the
  default store is `localStorage` with an in-memory fallback. Developers can supply their own
  `credentialsProvider: CredentialsAndIdentityIdProvider` through `LibraryAuthOptions`.
  [amplify-js: IdentityIdStore.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/auth/src/providers/cognito/credentialsProvider/IdentityIdStore.ts) ·
  [amplify-js: core/storage/index.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/core/src/storage/index.ts) ·
  [amplify-js: core/singleton/Auth/types.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/core/src/singleton/Auth/types.ts)
- Put together: in the side panel the guest identity survives browser restarts (extension-origin `localStorage`), dies
  if the user clears browsing data (Chrome's warning above) or the extension is uninstalled, and never exists in the
  service worker. Mirroring the identity id into `chrome.storage.local` and seeding the provider from it on startup
  removes the clear-browsing-data case; the uninstall case is handled by re-opening the Invitation Link, which creates
  a fresh membership (old Notes keep their stored `authorName`). This is the same durability picture as Firebase
  anonymous auth in the prior note.

### Provisioning and deployment

- Account: either attach `AmplifyBackendDeployFullAccess` to an existing IAM user, or (recommended by the page) enable
  IAM Identity Center, create an `amplify-admin` user with an `amplify-policy` permission set carrying that managed
  policy, run `aws configure sso`, then `npx ampx sandbox`; if the Region is not bootstrapped, sign in to the console
  as root/admin, open the Amplify console and choose "Initialize setup now", then rerun.
  [Amplify: Account setup](https://docs.amplify.aws/react/start/account-setup/)
- `ampx sandbox` deploys a CloudFormation stack `amplify-<app-name>-<whoami>-sandbox`, watches `amplify/` and
  hot-swaps changes; "Each developer on your team can use their own disposable sandbox"; sandboxes are "not intended
  for production workloads"; Ctrl+C stops watching but does not delete; `ampx sandbox delete` removes everything.
  [Amplify: Sandbox setup](https://docs.amplify.aws/react/deploy-and-host/sandbox-environments/setup/)
- Shared environments are "fullstack branch deployments" in Amplify Hosting: the console connects a Git repository,
  branch auto-detection deploys matching branches, and `npx ampx generate outputs --branch --app-id` fetches that
  branch's `amplify_outputs.json`. Custom pipelines still start by "connecting a fullstack Gen 2 branch from a Git
  repository" and then run `npx ampx pipeline-deploy --branch BRANCH_NAME --app-id AMPLIFY_APP_ID`.
  [Amplify: Branch deployments](https://docs.amplify.aws/react/deploy-and-host/amplify-hosting/branch-deployments/) ·
  [Amplify: Custom pipelines](https://docs.amplify.aws/react/deploy-and-host/amplify-hosting/custom-pipelines/)
- Pricing: Amplify lists its backend services (Cognito, AppSync, DynamoDB, Lambda, S3) at their own rates with "No
  monthly minimums"; Hosting build minutes and CDN storage are irrelevant to an extension that is not hosted.
  [Amplify pricing](https://aws.amazon.com/amplify/pricing/)
- Practical reading for this project: a CLI deploy from the developer's laptop is enough for the pilot. Run
  `npx ampx sandbox --identifier pilot --once` so the stack name does not depend on the developer's username and the
  stack persists between sessions; treat it as the pilot backend; move to a branch deployment (which needs the GitHub
  repository connected in the Amplify console) once the schema stabilises. Only the developer's AWS profile is needed;
  Members need nothing.

## AppSync used directly (no Amplify CLI)

- Authorization types: `API_KEY`, `AWS_LAMBDA`, `AWS_IAM`, `OPENID_CONNECT`, `AMAZON_COGNITO_USER_POOLS`. "API keys are
  configurable for up to 365 days" and "are recommended for development purposes or use cases where it's safe to
  expose a public API"; the key travels in `x-api-key`. `AWS_IAM` enforces SigV4 and can use "short-lived, temporary
  credentials provided by Amazon Cognito Federated Identities"; IAM policies grant `appsync:GraphQL` on
  `arn:aws:appsync:<region>:<account>:apis/<apiId>/types/<Type>/fields/<field>` so the unauthenticated role can be
  limited to exactly the Shared List fields. Additional modes are declared per field with `@aws_iam`,
  `@aws_api_key`, etc. Fine-grained access control is done in resolvers using `ctx.identity`.
  [AppSync: Authorization and authentication](https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html)
- Identity in resolvers: for `API_KEY` "The `identity` field isn't populated." For `AWS_IAM` it carries `accountId`,
  `cognitoIdentityPoolId`, `cognitoIdentityId`, `sourceIp`, `username`, `userArn`, `cognitoIdentityAuthType`
  ("Either authenticated or unauthenticated") and `cognitoIdentityAuthProvider`; "If you're using IAM authorization
  with credentials vended from Amazon Cognito identity pools, we recommend that you use `cognitoIdentityId`."
  Pipeline state flows through `ctx.stash` and `ctx.prev.result`.
  [AppSync: JS resolver context reference](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-context-reference-js.html)
- This is the decisive point against API-key auth for the Shared List: with no identity, the resolver cannot tell
  Members apart, so a membership record is meaningless and anyone with the (shipped) key can read every list.
- Resolvers: unit resolvers (request/response against one data source) or pipeline resolvers (request handler →
  functions → response handler); `util.error` aborts, `util.appendError` records without aborting,
  `runtime.earlyReturn` skips the data source. Quota: 10 functions per pipeline resolver, 32 KB code per handler, 30 s
  request execution, 5 MB response.
  [AppSync: JS resolvers overview](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-reference-overview-js.html) ·
  [AWS General Reference: AppSync quotas](https://docs.aws.amazon.com/general/latest/gr/appsync.html)
- Utilities: `util.unauthorized()` "Throws `Unauthorized` for the field being resolved"; `util.autoId()` "Returns a
  128-bit randomly generated UUID"; `util.autoUlid()` returns a sortable ULID (handy for Note ids);
  `util.authType()` names the auth mode in use.
  [AppSync: Built-in utilities](https://docs.aws.amazon.com/appsync/latest/devguide/built-in-util-js.html)
- DynamoDB operations from resolvers: `PutItem` with `condition` (a failed condition surfaces as an error rather than
  overwriting); `TransactWriteItems` with `PutItem`/`UpdateItem`/`DeleteItem`/`ConditionCheck` items across tables,
  "all-or-nothing", 100 items, with `cancellationReasons` on `TransactionCanceledException`. This is what makes the
  join step atomic: a `ConditionCheck` on the list's `inviteToken` plus a `PutItem` of the membership in one request.
  [AppSync: PutItem](https://docs.aws.amazon.com/appsync/latest/devguide/js-aws-appsync-resolver-reference-dynamodb-putitem.html) ·
  [AppSync: TransactWriteItems](https://docs.aws.amazon.com/appsync/latest/devguide/js-aws-appsync-resolver-reference-dynamodb-transact-write-items.html)
- Subscriptions: triggered by mutations via `@aws_subscribe(mutations: [...])`; "a secure WebSocket connection is
  automatically established and maintained by AWS AppSync"; the subscription selection set must be a subset of the
  mutation's; subscription arguments give basic filtering; "To control authorization at connection time to a
  subscription, you can use … Amazon Cognito identity pools … For fine-grained access controls on subscriptions, you
  can attach resolvers to your subscription fields and perform logic using the identity of the caller and AWS AppSync
  data sources." Pure WebSockets payload limit 240 KB.
  [AppSync: Using subscriptions](https://docs.aws.amazon.com/appsync/latest/devguide/aws-appsync-real-time-data.html)
- Enhanced filtering: the subscription resolver's response handler calls
  `extensions.setSubscriptionFilter(util.transform.toSubscriptionFilter(filter))`; filters "take precedence over
  filtering based only on subscription arguments"; `context.identity` is available "when the subscription is
  established"; you "can't use basic filtering and enhanced filtering concurrently"; nesting up to five levels.
  [AppSync: Enhanced subscription filters](https://docs.aws.amazon.com/appsync/latest/devguide/aws-appsync-real-time-enhanced-filtering.html)
- WebSocket protocol: connect to `wss://<id>.appsync-realtime-api.<region>.amazonaws.com/graphql` with subprotocols
  `graphql-ws` and `header-<base64url(JSON auth headers)>`; `connection_ack` carries `connectionTimeoutMs` (300000 in
  the example); keep-alives continue "until it shuts down the connection automatically (after 24 hours)"; IAM
  connections sign a `POST` to the HTTP endpoint and include `X-Amz-Security-Token`. Quotas: 240 KB subscription
  payload, 200 subscriptions per connection (adjustable), 2,000 connections/s per API.
  [AppSync: Real-time WebSocket client](https://docs.aws.amazon.com/appsync/latest/devguide/real-time-websocket-client.html) ·
  [AWS General Reference: AppSync quotas](https://docs.aws.amazon.com/general/latest/gr/appsync.html)
- Verdict: identical runtime to the Amplify option; the difference is who writes the CloudFormation. Amplify Gen 2 is
  CDK underneath and exposes the constructs (`backend.data.resources.graphqlApi`, `cfnResources`,
  `amplifyDynamoDbTables` with `billingMode`, `pointInTimeRecoveryEnabled`, `timeToLiveAttribute`), so nothing is lost
  by starting with Amplify.
  [Amplify: Override resources](https://docs.amplify.aws/react/build-a-backend/data/override-resources/)

## API Gateway WebSocket + Lambda + DynamoDB

- Model: "a WebSocket API supports two-way communication"; routes `$connect`, `$disconnect`, `$default` and custom
  routes chosen by a `routeSelectionExpression` such as `${request.body.action}`; the backend sends data back via
  route responses or "the `@connections` API to send a POST request". Close code 1001 "when the client is idle for 10
  minutes or reaches the maximum 2 hour connection lifetime"; binary frames unsupported (1003); too-large messages
  (1009).
  [API Gateway: WebSocket API overview](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-overview.html)
- `$connect`: "you can configure authorization on the `$connect` route only. `AuthN`/`AuthZ` will be performed only at
  connection time"; use it to "store connection IDs … in a database (for example, Amazon DynamoDB). The connection ID
  is a variable-length string whose length and format might change." Query strings are available to the `$connect`
  integration (`event['queryStringParameters']`). `$disconnect` "is a best-effort event".
  [API Gateway: $connect and $disconnect](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-route-keys-connect-disconnect.html)
- Push: `POST https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/@connections/{connection_id}`; "These
  requests use IAM authorization, so you must sign them with Signature Version 4"; the Lambda uses
  `ApiGatewayManagementApiClient.PostToConnectionCommand` and must handle `GoneException`.
  [API Gateway: @connections](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-how-to-call-websocket-api-connections.html)
- Pricing: $1.00 per million messages, $0.25 per million connection-minutes, "Messages are metered in 32KB
  increments" with a 128 KB maximum; free tier "one million messages and 750,000 connection minutes for WebSocket
  APIs per month for up to 12 months" (new customers only). Lambda: "one million requests and 400,000 GB-seconds per
  month" free, then $0.20 per million requests. DynamoDB: 25 GB storage and 25 WCU/25 RCU provisioned free; on-demand
  $0.625/M WRU, $0.125/M RRU; Streams 2.5 M read requests/month free.
  [API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/) · [Lambda pricing](https://aws.amazon.com/lambda/pricing/) ·
  [DynamoDB on-demand pricing](https://aws.amazon.com/dynamodb/pricing/on-demand/)
- What it costs in code: a `$connect` Lambda (or IAM/Lambda authorizer) that validates the Member and writes
  `{connectionId, identityId, listId}` with a TTL; a `$disconnect` Lambda (best-effort, so the TTL and `GoneException`
  handling are mandatory); a fan-out Lambda per write that queries Members' connections and `PostToConnection`s each;
  client reconnection every ≤2 h and after 10 min idle (a heartbeat or re-subscribe on panel focus); and, because a
  WebSocket API has no query model, a second API (HTTP API + Lambda, or AppSync anyway) for the initial load, Saved
  Listing CRUD and Notes. Membership checks live in each Lambda. Nothing here is hard, but it is all code the team
  owns, versus a dozen lines of resolver on AppSync.

## AppSync Events (pub/sub) beside a store

- "AWS AppSync Events lets you create secure and performant serverless WebSocket APIs that can broadcast real-time
  event data"; clients "publish events over HTTP or WebSocket, and can subscribe to channels using WebSockets"; events
  live in channels grouped under namespaces; `OnPublish` handlers "transform, filter, and reject events", `OnSubscribe`
  handlers "customize the behavior or reject the subscription request"; auth "can be configured at the API level and
  customized at the channel namespace level"; wildcard subscriptions `namespace/channel/*`.
  [AppSync Events: What is AWS AppSync Events?](https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-welcome.html)
- Auth: `API_KEY`, `AWS_LAMBDA`, `AWS_IAM` (`appsync:EventConnect`, `appsync:EventPublish`, `appsync:EventSubscribe` on
  `apis/{APIID}` and `apis/{APIID}/channelNamespace/{NAME}`; works with "temporary credentials provided by Amazon
  Cognito Federated Identities"), `OPENID_CONNECT`, `AMAZON_COGNITO_USER_POOLS`; connect, publish and subscribe modes
  are configured separately and per namespace.
  [AppSync Events: Authorization](https://docs.aws.amazon.com/appsync/latest/eventapi/configure-event-api-auth.html)
- Handlers run on the APPSYNC_JS runtime "after the incoming request is authorized"; `onSubscribe` can call
  `util.unauthorized()` (the docs' example restricts a user to `/messages/inbox/${ctx.identity.username}`); with a
  data source a handler has `request`/`response` functions, e.g. `ddb.batchPut` to persist events before broadcast,
  or a lookup whose empty result triggers `util.unauthorized()` in `response`.
  [AppSync Events: Handlers](https://docs.aws.amazon.com/appsync/latest/eventapi/channel-namespace-handlers.html) ·
  [AppSync Events: Data source integrations](https://docs.aws.amazon.com/appsync/latest/eventapi/data-source-integrations.html)
- Protocol: `wss://<id>.appsync-realtime-api.<region>.amazonaws.com/event/realtime`, subprotocols
  `aws-appsync-event-ws` + `header-<base64url>`; connection "up to a maximum of 24 hours"; `connection_ack` with
  `connectionTimeoutMs: 300000`; keep-alive every 60 s; channels of 1–5 segments of ≤50 chars; "up to five events in
  a batch". Quotas: 5 events per publish, 1.2 MB publish payload, 25 publishes/s per connection, 50 namespaces per API.
  [AppSync Events: WebSocket protocol](https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-websocket-protocol.html) ·
  [AWS General Reference: AppSync quotas](https://docs.aws.amazon.com/general/latest/gr/appsync.html)
- Pricing: $1.00 per million Event API operations, $0.08 per million connection-minutes, "charged per 5 KB payload";
  free tier 250,000 realtime updates and 600,000 connection-minutes, expiring after 12 months.
  [AppSync pricing](https://aws.amazon.com/appsync/pricing/)
- Amplify: Gen 2 defines an Event API with CDK (`CfnApi` with `eventConfig`, `CfnChannelNamespace`) in `backend.ts`,
  publishes `custom.events` outputs via `backend.addOutput`, and the client uses `events.connect('default/channel')`,
  `channel.subscribe`, `channel.publish`, `events.post` from `aws-amplify/data`. The docs' example uses a user pool and
  attaches the IAM policy to the authenticated role; guest/IAM use is not shown, though the library's
  `EventsOptions.authMode` is the same `GraphQLAuthMode` union (with `identityPool` normalised to IAM), and the API
  is marked `@experimental`.
  [Amplify: Connect to AppSync Events](https://docs.amplify.aws/react/build-a-backend/data/connect-event-api/) ·
  [amplify-js: api-graphql/internals/events/types.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/api-graphql/src/internals/events/types.ts)
- As a change channel: Events has no read path, so the Shared List would still need AppSync GraphQL or an HTTP API for
  initial load and queries. The one elegant variant is to make Events the *write* path too: the client publishes a
  change to `lists/<listId>`, the `onPublish` handler's single DynamoDB request is a `TransactWriteItems` with a
  `ConditionCheck` on the caller's membership item plus the `PutItem`, and the `onSubscribe` handler denies
  non-Members. That still leaves reads to a second API. Since AppSync GraphQL subscriptions already deliver the same
  "changes made by one member appear for the other group members" with one API and one auth model, Events is not
  recommended for v1; it is the right tool if the store ever moves to a plain REST/Lambda API.

## Free tier and likely monthly cost

- AWS Free Tier today: "If you are new to AWS, you receive USD $100 in credits after you create an account, regardless
  of your account plan", up to another $100 for activities, "over 30 always free AWS services"; a Free account plan
  "ends after six months or when your credits are fully used - whichever occurs first"; a Paid plan pays standard rates
  beyond credits. Service pricing pages add that this applies to accounts created from July 15, 2025.
  [AWS Billing: Free Tier](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html) ·
  [AWS Free Tier](https://aws.amazon.com/free/)
- AppSync free tier: 250,000 query/mutation operations, 250,000 realtime updates, 600,000 connection-minutes;
  "The AWS AppSync Free Tier automatically expires after 12 months." Cognito identity pools: "provided at no charge".
  DynamoDB: 25 GB storage always free. Lambda: 1 M requests + 400,000 GB-s per month.
  [AppSync pricing](https://aws.amazon.com/appsync/pricing/) · [Cognito pricing](https://aws.amazon.com/cognito/pricing/) ·
  [DynamoDB pricing](https://aws.amazon.com/dynamodb/pricing/on-demand/) · [Lambda pricing](https://aws.amazon.com/lambda/pricing/)
- Pilot sizing (assumption, not a source): 5 groups × 4 Members = 20 Members, each with the panel open about one hour a
  day and ~200 operations a day, every write fanned out to ≤3 others. Per month: ~36,000 connection-minutes
  ($0.003), ~120,000 operations ($0.48), ~50,000 realtime updates ($0.10), DynamoDB well under a cent. **Under $1
  per month at list price**, $0 inside the free tier or credits. The API Gateway variant is a similar order of
  magnitude ($0.25/M connection-minutes, $1/M messages, Lambda free). Cost is not a differentiator; code and
  enforcement are.

## Recommendation

**Build the Shared List on AWS AppSync GraphQL + DynamoDB + a Cognito identity pool (guest access), defined with
Amplify Gen 2, with all Shared List operations as custom queries/mutations/subscriptions whose JavaScript resolvers
enforce membership, and with the Amplify JS client running only in the side panel.** Reasons, in order:

1. It is the only option that gives a per-caller identity to guests without any sign-in, user pool, or Lambda in the
   request path, and lets the server enforce "unauthorized users cannot access a private shared list" for both
   one-shot reads and realtime (subscribe-time resolver + server-side filter).
2. The client fits the MV3 side panel as measured: one static chunk, `fetch` + one WebSocket, no eval, no dynamic
   import, 56 kB gzip.
3. A single `npx ampx sandbox` from the developer's laptop provisions AppSync, DynamoDB, the identity pool and IAM, and
   writes the values the `.env` needs. Nothing else to host.
4. Price is effectively zero for the pilot and stays linear and small afterwards.

Reject API-key auth for anything that touches a Shared List (no identity). Keep API Gateway WebSocket and AppSync
Events as documented alternatives: the former if the team wants to own every line of the realtime path, the latter if
the store ever becomes a REST API.

### What a human must provision

1. An AWS account (the developer already has one). Decide Free vs Paid plan; the pilot fits either.
2. IAM Identity Center user `amplify-admin` with the `AmplifyBackendDeployFullAccess` permission set (or that policy on
   an existing IAM user), then `aws configure sso` on the developer laptop.
   [Amplify: Account setup](https://docs.amplify.aws/react/start/account-setup/)
3. First `npx ampx sandbox` in the chosen Region; if prompted, open the Amplify console as root/admin and choose
   "Initialize setup now" (one-time CDK bootstrap), then rerun.
4. Run the pilot backend as `npx ampx sandbox --identifier pilot --once --outputs-out-dir ./config` and copy the four
   values from `amplify_outputs.json` into `.env.local` (or run a small `outputs-to-env` script). Never run
   `ampx sandbox delete` on the pilot identifier while groups are using it.
5. Later, for a durable environment: connect the GitHub repo to an Amplify app in the console (branch deployment) and
   switch the `.env` to `npx ampx generate outputs --app-id <id> --branch main`.
6. Nothing for Members: they install the extension and open an Invitation Link.

### Data model sketch (one DynamoDB table + one GSI, created in `amplify/backend.ts` and attached as a data source)

Table `SharedList` with partition key `pk`, sort key `sk`, billing `PAY_PER_REQUEST`, GSI `byMember`
(`gsi1pk`, `gsi1sk`). Keys use `LIST#<listId>` where `listId` is a server-generated `util.autoId()` (128-bit random
UUID), so the id itself is unguessable; the separate `inviteToken` is a 32-byte random value generated by the Owner's
client with `crypto.getRandomValues` and rotatable.

```
pk                 sk                                    attributes
LIST#<listId>      META                                  name, ownerIdentityId, inviteToken, createdAt, updatedAt
LIST#<listId>      MEMBER#<identityId>                   displayName, role: "owner"|"member", joinedAt
                                                         gsi1pk = MEMBER#<identityId>, gsi1sk = LIST#<listId>   (for "my lists")
LIST#<listId>      SAVED#<savedListingId>                sourceUrl, normalizedAddress, facts (map of Listing Facts with
                                                         provenance Listed|NotListed|Estimated|Corrected),
                                                         status: Saved|Considering|TourScheduled|Applied|Rejected|Selected,
                                                         finalist: bool, tour: { at } | null, landlordQuestions: [string],
                                                         addedByIdentityId, createdAt, updatedAt, version
LIST#<listId>      SAVED#<savedListingId>#NOTE#<ulid>    authorIdentityId, authorName, text, createdAt
LIST#<listId>      SAVED#<savedListingId>#FIT#<identityId>  score (0–100), computedAt
```

- One `Query` on `pk = LIST#<listId>` with `begins_with(sk, "SAVED#")` loads a whole Shared List (Saved Listings,
  Notes and Fit Scores interleave by sort key; the client groups them). Notes use `util.autoUlid()` so they sort by
  time.
- Fit Score stays client-computed from each Member's private Preferences (which remain in `chrome.storage.sync`);
  each Member writes only their own `FIT#<identityId>` item; Group Fit is the client-side average of the FIT items it
  can read.
- Duplicate detection: compare `sourceUrl` and `normalizedAddress` against the loaded list before `addSavedListing`;
  the resolver also conditions the `PutItem` on `attribute_not_exists(pk)` so two Members adding at once cannot both
  succeed with the same id.
- `inviteToken` never appears in any GraphQL type. The GraphQL `SharedList` type has `id, name, ownerIdentityId,
  createdAt, members[]`; the token is returned only by `createList` and `rotateInviteToken` to the Owner.

### GraphQL surface (Amplify `a.schema`, every field `allow.guest()`)

```
queries     myLists(): [SharedList]                       GSI byMember on MEMBER#<me>
            getList(listId): SharedList                   assertMember → GetItem META + Query MEMBER#
            listSavedListings(listId): [SavedListing]     assertMember → Query SAVED#  (includes notes, fitScores)
mutations   createList(name, inviteToken, displayName): CreatedList     TransactWriteItems: Put META + Put MEMBER(owner)
            joinList(listId, inviteToken, displayName): Membership        TransactWriteItems: ConditionCheck META.inviteToken = :t
                                                                           + Put MEMBER#<me>; failure → util.unauthorized()
            rotateInviteToken(listId, newToken): CreatedList            assertOwner → UpdateItem META
            removeMember(listId, identityId): ListChange                 assertOwner → DeleteItem MEMBER#
            leaveList(listId): ListChange                                 DeleteItem MEMBER#<me>
            addSavedListing(listId, input): ListChange                    assertMember → PutItem (attribute_not_exists)
            updateSavedListing(listId, id, patch): ListChange             assertMember → UpdateItem (status, tour, finalist,
                                                                           landlordQuestions, facts corrections, version)
            removeSavedListing(listId, id): ListChange                    assertMember → DeleteItem
            addNote(listId, savedListingId, text): ListChange             assertMember → PutItem NOTE (author = ctx.identity)
            setFitScore(listId, savedListingId, score): ListChange        assertMember → PutItem FIT#<me>
subscription onListChange(listId): ListChange   .for(all ListChange mutations)   handler: membership check + setSubscriptionFilter
```

`ListChange { listId, kind, savedListing, note, fitScore, membership, actorIdentityId, at }` is the common return
type so one subscription covers every change on a list (custom subscriptions must return the subscribed mutations'
type). If Amplify's `.for()` turns out to accept only one ref, declare one subscription per mutation; the handler is
the same.

### Authorization rule logic

1. **Who can call the API at all.** The AppSync API's default mode is `identityPool` (IAM). Only the identity pool's
   unauthenticated role (and, if ever enabled, its authenticated role) holds `appsync:GraphQL` on the Shared List
   fields; `allow.guest()` on each field makes Amplify generate exactly that policy. Anyone can obtain a guest identity
   (that is the design), so IAM establishes **who** is calling (`ctx.identity.cognitoIdentityId`), not **whether** they
   may see a list.
2. **Membership gate.** Every query/mutation except `createList`, `joinList` and `myLists` starts with an
   `assertMember` function: `GetItem(pk = LIST#<listId>, sk = MEMBER#<ctx.identity.cognitoIdentityId>)`; if absent,
   `util.unauthorized()`; otherwise stash `role`. Owner-only mutations additionally require `role == "owner"`.
3. **Join.** `joinList` is one `TransactWriteItems`: `ConditionCheck` on `META` with
   `attribute_exists(pk) AND inviteToken = :presented`, plus `PutItem MEMBER#<me>` (idempotent for a returning
   Member). Any cancellation reason maps to `util.unauthorized()`, so callers cannot distinguish "wrong token" from
   "no such list". The token is compared server-side and never read back by clients.
4. **Revocation.** The Owner rotates `inviteToken` (old links stop working) and removes Members (their next request
   fails at step 2). AppSync also offers subscription invalidation (the quotas page lists a 100/s "subscription
   invalidation requests" rate); whether `removeMember` should invalidate live subscriptions is a #10 decision.
5. **Realtime.** The `onListChange(listId)` subscription resolver runs at subscribe time with the caller's identity: it
   performs the same membership `GetItem`, calls `util.unauthorized()` on a miss, and otherwise sets
   `extensions.setSubscriptionFilter({ listId: { eq: ctx.args.listId } })` so the connection only ever receives that
   list's events. Mutations are what trigger delivery, and each mutation's resolver already passed step 2.
6. **Attribution and integrity.** Resolvers set `addedByIdentityId`, `authorIdentityId`, `actorIdentityId` and
   timestamps from `ctx.identity` and `util.time.nowISO8601()`, never from arguments. `displayName` is the one
   client-supplied identity field and is stored on the membership and copied onto Notes.
7. **Model CRUD is not exposed.** The table is created in CDK and attached with `addDynamoDbDataSource`, so Amplify
   generates no `create/update/delete/list` for it; the only way in is through the resolvers above. If the team later
   prefers `a.model()` tables, give those models a rule no guest can satisfy and keep the custom operations as the sole
   client surface.

### Draft `.env.example`

```dotenv
# Mustang Housing Match — Shared List backend (AWS AppSync + DynamoDB + Cognito identity pool).
# Copy to .env.local (git-ignored) and fill from amplify_outputs.json after `npx ampx sandbox --identifier pilot --once`.
#
# Vite embeds every VITE_* value in the extension bundle, where anyone who unpacks the extension can read it.
# Only public configuration belongs here. Never put AWS access keys, secret keys, or session tokens in any .env.

# ---- Shipped inside the extension (public configuration) -----------------------------------------------------

# amplify_outputs.json → data.aws_region (and auth.aws_region; they are the same Region)
VITE_AWS_REGION=us-west-2

# amplify_outputs.json → auth.identity_pool_id
# Public by design: it only lets a client obtain the pool's *unauthenticated* role, whose IAM policy is limited to
# appsync:GraphQL on this API. Membership is enforced in the resolvers, not by hiding this id.
VITE_COGNITO_IDENTITY_POOL_ID=us-west-2:00000000-0000-0000-0000-000000000000

# amplify_outputs.json → data.url (the GraphQL endpoint; the realtime wss:// endpoint is derived by the client)
VITE_APPSYNC_GRAPHQL_ENDPOINT=https://xxxxxxxxxxxxxxxxxxxxxxxxxx.appsync-api.us-west-2.amazonaws.com/graphql

# amplify_outputs.json → data.default_authorization_type (AWS_IAM) expressed as the Amplify client auth mode.
# Must stay identityPool: API-key requests carry no identity, so membership cannot be enforced for them.
VITE_APPSYNC_AUTH_MODE=identityPool

# Only if a public, read-only field is ever added with allow.publicApiKey(); otherwise leave empty.
# An API key is a bearer credential valid for up to 365 days; it must never guard Shared List data.
VITE_APPSYNC_API_KEY=

# Base of the Invitation Link the Owner shares (format decided in #10, e.g. a hosted landing page or chrome-extension:// URL)
VITE_INVITE_LINK_BASE=https://example.invalid/join

# ---- Developer machine only (not VITE_, never bundled) ---------------------------------------------------------

# AWS CLI profile created by `aws configure sso` (Amplify account setup) and used by `npx ampx sandbox`
AWS_PROFILE=amplify-admin
AWS_REGION=us-west-2

# Stable sandbox name so the pilot stack does not depend on who runs the deploy
AMPLIFY_SANDBOX_IDENTIFIER=pilot

# Filled in once the backend moves to an Amplify branch deployment (`npx ampx generate outputs --app-id … --branch …`)
AMPLIFY_APP_ID=
AMPLIFY_BRANCH=main
```

Which values are safe to ship: `VITE_AWS_REGION`, `VITE_COGNITO_IDENTITY_POOL_ID`, `VITE_APPSYNC_GRAPHQL_ENDPOINT`
and `VITE_APPSYNC_AUTH_MODE` are public configuration; shipping them grants nothing beyond what any anonymous client
can already obtain from the identity pool, and what that grants is bounded by the unauthenticated role's policy and the
resolvers. `VITE_APPSYNC_API_KEY` is a shared bearer secret: acceptable only for genuinely public fields, so it is empty
by default. Everything under "Developer machine only" stays out of the bundle because it lacks the `VITE_` prefix; AWS
access keys never appear in any of these files (the SSO profile holds them).

## Open questions for #10

- **Amplify DSL coverage.** Confirm in a prototype that `a.subscription().for()` accepts several mutation refs and that
  its `a.handler.custom` accepts a `dataSource` (needed for the subscribe-time membership `GetItem`). Fallbacks: one
  subscription per mutation; or attach the subscription resolver through the CDK escape hatch
  (`backend.data.resources.graphqlApi`).
- **Identity durability.** Decide whether to mirror the guest identity id into `chrome.storage.local` via a custom
  `credentialsProvider`, and what the Owner does if they lose their identity (today: nobody can rotate the token;
  option: let any Member become Owner when the Owner's membership is gone, or store the token hash so a second device
  with the original link can re-claim).
- **Invitation Link format.** Same open question as the Firebase note: hosted landing page versus
  `chrome-extension://<id>/join.html?list=…&t=…` versus a pasteable code. The URL carries `listId` and `inviteToken`
  and must not be logged by any analytics.
- **Service worker writes.** If Capture ever needs to save a Listing while the panel is closed, decide between opening
  the panel first or passing short-lived credentials to the worker; do not run the Amplify client in the worker.
- **Offline.** AppSync does not replay missed subscription messages; the panel should re-query the list on
  `ConnectionState` transitions back to `Connected`.
- **Account plan.** A Free account plan closes after six months or when credits are spent; a pilot that must outlive
  the quarter should sit on the Paid plan (which still has the credits and always-free tiers).

## Sources

AWS AppSync (GraphQL): [Authorization and authentication](https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html) ·
[Using subscriptions](https://docs.aws.amazon.com/appsync/latest/devguide/aws-appsync-real-time-data.html) ·
[Enhanced subscription filters](https://docs.aws.amazon.com/appsync/latest/devguide/aws-appsync-real-time-enhanced-filtering.html) ·
[Real-time WebSocket client](https://docs.aws.amazon.com/appsync/latest/devguide/real-time-websocket-client.html) ·
[JS resolver context reference](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-context-reference-js.html) ·
[JS resolvers overview](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-reference-overview-js.html) ·
[Built-in utilities](https://docs.aws.amazon.com/appsync/latest/devguide/built-in-util-js.html) ·
[DynamoDB PutItem](https://docs.aws.amazon.com/appsync/latest/devguide/js-aws-appsync-resolver-reference-dynamodb-putitem.html) ·
[DynamoDB TransactWriteItems](https://docs.aws.amazon.com/appsync/latest/devguide/js-aws-appsync-resolver-reference-dynamodb-transact-write-items.html) ·
[Quotas (AWS General Reference)](https://docs.aws.amazon.com/general/latest/gr/appsync.html) ·
[Pricing](https://aws.amazon.com/appsync/pricing/)

AWS AppSync Events: [What is AppSync Events](https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-welcome.html) ·
[Authorization](https://docs.aws.amazon.com/appsync/latest/eventapi/configure-event-api-auth.html) ·
[Handlers](https://docs.aws.amazon.com/appsync/latest/eventapi/channel-namespace-handlers.html) ·
[Data source integrations](https://docs.aws.amazon.com/appsync/latest/eventapi/data-source-integrations.html) ·
[WebSocket protocol](https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-websocket-protocol.html)

Amplify Gen 2: [Customize auth rules](https://docs.amplify.aws/react/build-a-backend/data/customize-authz/) ·
[Public data access](https://docs.amplify.aws/react/build-a-backend/data/customize-authz/public-data-access/) ·
[Custom data access patterns](https://docs.amplify.aws/react/build-a-backend/data/customize-authz/custom-data-access-patterns/) ·
[Subscribe to real-time events](https://docs.amplify.aws/react/build-a-backend/data/subscribe-data/) ·
[Custom business logic](https://docs.amplify.aws/react/build-a-backend/data/custom-business-logic/) ·
[Custom subscriptions](https://docs.amplify.aws/react/build-a-backend/data/custom-subscription/) ·
[Connect your frontend](https://docs.amplify.aws/react/build-a-backend/data/connect-to-API/) ·
[Override resources](https://docs.amplify.aws/react/build-a-backend/data/override-resources/) ·
[Connect to AppSync Events](https://docs.amplify.aws/react/build-a-backend/data/connect-event-api/) ·
[Guest access](https://docs.amplify.aws/react/build-a-backend/auth/concepts/guest-access/) ·
[amplify_outputs.json](https://docs.amplify.aws/react/reference/amplify_outputs/) ·
[CLI commands](https://docs.amplify.aws/react/reference/cli-commands/) ·
[Account setup](https://docs.amplify.aws/react/start/account-setup/) ·
[Sandbox setup](https://docs.amplify.aws/react/deploy-and-host/sandbox-environments/setup/) ·
[Branch deployments](https://docs.amplify.aws/react/deploy-and-host/amplify-hosting/branch-deployments/) ·
[Custom pipelines](https://docs.amplify.aws/react/deploy-and-host/amplify-hosting/custom-pipelines/) ·
[Amplify pricing](https://aws.amazon.com/amplify/pricing/)

Amplify JS source and issues: [core/singleton/Auth/types.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/core/src/singleton/Auth/types.ts) ·
[core/singleton/API/types.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/core/src/singleton/API/types.ts) ·
[auth/.../credentialsProvider/IdentityIdStore.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/auth/src/providers/cognito/credentialsProvider/IdentityIdStore.ts) ·
[core/storage/DefaultStorage.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/core/src/storage/DefaultStorage.ts) ·
[core/storage/index.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/core/src/storage/index.ts) ·
[api-graphql/internals/events/types.ts](https://github.com/aws-amplify/amplify-js/blob/main/packages/api-graphql/src/internals/events/types.ts) ·
[#9260 Chrome Browser Extension Support (Auth)](https://github.com/aws-amplify/amplify-js/issues/9260) ·
[#10468 incompatible with chrome extension service workers under MV3](https://github.com/aws-amplify/amplify-js/issues/10468) ·
[#6197 Have Amplify work in chrome extension context](https://github.com/aws-amplify/amplify-js/issues/6197) ·
[Releases](https://github.com/aws-amplify/amplify-js/releases)

Amazon Cognito: [Identity pools](https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html) ·
[Identity pools authentication flow](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html) ·
[Pricing](https://aws.amazon.com/cognito/pricing/)

Amazon API Gateway: [WebSocket API overview](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-overview.html) ·
[$connect and $disconnect](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-route-keys-connect-disconnect.html) ·
[@connections](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-how-to-call-websocket-api-connections.html) ·
[Pricing](https://aws.amazon.com/api-gateway/pricing/)

Other AWS: [Lambda pricing](https://aws.amazon.com/lambda/pricing/) · [DynamoDB on-demand pricing](https://aws.amazon.com/dynamodb/pricing/on-demand/) ·
[AWS Free Tier (Billing guide)](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html) · [AWS Free Tier](https://aws.amazon.com/free/)

Chrome and Vite: [content_security_policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) ·
[Improve extension security](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security) ·
[Service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) ·
[chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage) ·
[Vite env variables and modes](https://vite.dev/guide/env-and-mode)

Measurement: scratch Vite project built 2026-10-11 with `aws-amplify@6.22.1` and `vite@8.3.4`; figures quoted in
"Running inside the MV3 side panel".
