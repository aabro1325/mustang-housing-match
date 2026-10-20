# mustang-housing-match

## Try the alpha (no build needed)

The prebuilt extension is in `extension-alpha/` (`manifest.json` is directly inside that folder). You do not need Node or a build step.

1. On GitHub, use **Code > Download ZIP**, or `git clone` this repo. Unzip the download if you used Download ZIP.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `extension-alpha` folder (the one with `manifest.json` directly inside it, not the repo root and not a `.zip`).
5. Pin Mustang Housing Match from the puzzle-piece menu.
6. Open a listing on Zillow, Craigslist, or Apartments.com and click **Analyze listing**.

The release zip is an alternative: download `mustang-housing-match-v0.1.0-alpha.zip` from [v0.1.0-alpha](https://github.com/aabro1325/mustang-housing-match/releases/tag/v0.1.0-alpha), unzip it, and load that folder the same way.

## Alpha release (v0.1.0)

This preview covers two features: capturing a rental listing, and a personalized fit score. Commute times, the monthly cost breakdown, shared roommate lists, and tour/compare are coming in later releases. That code stays in the repo and is off in the alpha build (`VITE_RELEASE_SCOPE=alpha`, `npm run build:alpha`).

Notes: [docs/releases/v0.1.0-alpha.md](docs/releases/v0.1.0-alpha.md). Release page: [v0.1.0-alpha](https://github.com/aabro1325/mustang-housing-match/releases/tag/v0.1.0-alpha).
