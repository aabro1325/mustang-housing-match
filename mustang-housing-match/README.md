# Mustang Housing Match

A Chrome side-panel extension (Manifest V3) that helps Cal Poly students evaluate off-campus rental listings against
their own priorities and decide together with roommates. Independent student project (IME 4403); not affiliated with
Cal Poly or any listing site.

What it does, in one pass:

1. **Capture** the listing you are looking at on Zillow, Craigslist or Apartments.com (or paste a Facebook post, or
   type one in). Anything the page does not state is shown as **Not Listed**, never guessed.
2. **Review** and correct what was captured, pick a floor plan, choose per-unit or per-person rent.
3. **Score** it 0–100 against your preferences (budget, how you get to campus, max commute, lease type, room, amenities,
   and how much each matters), with a cost breakdown, Cal Poly commute times for walk, bike, bus and car, benefits,
   watch-outs and questions to ask the landlord.
4. **Share** a list with roommates by invitation link; everyone sees the same saved listings, statuses, tour dates,
   notes and questions, plus a Group Fit across everyone's scores. Compare finalists side by side.

## Install the pilot build (students)

1. Get the `dist/` folder from your group's developer (or build it below).
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, choose `dist/`.
3. Click the extension's toolbar icon; the side panel opens. Set your preferences, then open any listing.
4. To join your roommates' list: Roommates tab → **Join with a link** → paste the invitation link you were sent.

Chrome 116 or newer. Preferences stay in your Chrome profile; the shared list lives in the group's backend.

## Develop

```
npm install
cp .env.example .env     # fixture commute + local-only sharing by default; no keys needed
npm run build            # dist/ is the unpacked extension (side panel, service worker, capture script)
npm test                 # Vitest: core, providers, capture readers, panel state and components
npm run e2e              # Playwright: loads dist/ into Chromium and drives the real panel
npm run typecheck
```

Rebuild after changes and press the reload icon on `chrome://extensions`. Panel pages pick up HTML/CSS/JS changes on
reopen; the service worker and capture script need the extension reload.

### Going live (developer, once)

```
scripts/provision.sh
```

walks you through the openrouteservice and Transitland keys (free, no card), the AWS account and Amplify sandbox
deploy of the Shared List backend, the GitHub Pages invitation page, and a live build. Every value lands in `.env`
(git-ignored). The checklists under `docs/checklists/` are then run against live listing pages before the pilot.

## Layout

```
public/manifest.json      MV3 manifest, pilot Source hosts, commute API hosts
src/sidepanel/            Preact app: screens/, components/, state/ (controllers), services.ts
src/background/           service worker (opens the panel on toolbar click)
src/capture/              capture script injected into the listing tab; readers/ per Source
src/core/                 pure modules: domain types, address, cost, scoring, commute, text listing, sharing model
src/providers/            commute (fixture, openrouteservice + Transitland) and sharing (local, AppSync)
src/chrome/               thin wrappers over chrome.* so core and providers never import them
amplify/                  Amplify Gen 2 backend: AppSync + DynamoDB + Cognito guest identities, JS resolvers
e2e/                      Playwright specs and fixture listing pages
docs/checklists/          manual acceptance checklists per feature
scripts/                  icon generator, provisioning wizard
```

Design decisions and their reasoning live on the GitHub issue tracker (map: issue #1) and in `docs/adr/` at the
repository root; vocabulary in `CONTEXT.md`.
