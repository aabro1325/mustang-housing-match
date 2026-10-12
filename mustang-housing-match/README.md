# Mustang Housing Match

Chrome side-panel extension (Manifest V3) that helps Cal Poly students evaluate off-campus rental listings against
their priorities and decide together with roommates.

## Develop

```
npm install
cp .env.example .env        # fixture providers by default; fill keys for live mode
npm run build               # dist/ is the unpacked extension
npm test                    # Vitest unit tests
npm run e2e                 # Playwright, loads dist/ into Chromium
```

Load `dist/` at `chrome://extensions` (Developer mode, "Load unpacked"). Click the toolbar icon to open the side panel.

## Layout

See `docs/agents/issue-tracker.md` (tracker) and the layout decision on issue #12.
