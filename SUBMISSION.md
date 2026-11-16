# Chrome Web Store submission

The agent does not publish the extension. A person with the developer account uploads the package and clicks submit.

Package: `mustang-housing-match/release/mustang-housing-match-1.0.0.zip`  
Unpacked folder (for a final local check): build with `npm run package:store` inside `mustang-housing-match/`, then load `dist/`.  
Privacy policy to host first: `docs/privacy/index.html`  
Suggested public URL, once GitHub Pages is serving the `docs/` folder: `https://aabro1325.github.io/mustang-housing-match/privacy/`

## Listing copy

**Short description** (110 characters):

Score off-campus rentals for Cal Poly: capture a listing, compare cost and commute, and decide with roommates.

**Detailed description:**

Mustang Housing Match helps Cal Poly students judge an off-campus rental without a spreadsheet.

Open a listing on Zillow, Craigslist, Apartments.com, or Redfin and click Analyze listing. The side panel reads the address, rent, beds, baths, lease, and amenities the page states. Anything the listing does not state stays "Not listed." You can correct the details, pick a floor plan, and say whether the rent is for the whole unit or per person.

You get a 0–100 Fit Score from your budget, how you get to campus, maximum commute, lease preference, room type, and amenities. The scorecard shows the estimated monthly total, distance and travel time to Kennedy Library by walking, biking, bus, and driving, benefits, watch-outs, and questions to ask the landlord. If the address cannot be located or a route fails, the panel says so.

Save listings, track status and tours, add notes, and compare finalists. On this store build the shared list stays in your Chrome profile. Commute lookups use keys you paste in the extension options. They are not included in the download.

Facebook posts can be analyzed by selecting or pasting the text. Any other page can be entered by hand.

Independent student project for IME 4403 at Cal Poly San Luis Obispo. Not affiliated with Cal Poly, Zillow, Craigslist, Apartments.com, Redfin, or Facebook.

**Category:** Productivity  
**Language:** English

## Permission justifications

Paste these into the developer dashboard if it asks why each permission is needed.

| Permission | Why it is there |
|---|---|
| `sidePanel` | The product UI is the Chrome side panel. The toolbar icon opens it. |
| `storage` | Preferences, saved listings, the commute cache, and the API keys the student pastes in options. |
| `scripting` | Injects the capture script only after the student clicks Analyze listing or Analyze selected text. |
| `activeTab` | Reads the tab the student is looking at when they invoke the extension. |
| `https://*.zillow.com/*` | Capture a Zillow listing after the student navigates, while the panel stays open. |
| `https://*.craigslist.org/*` | Same, for Craigslist posts. |
| `https://*.apartments.com/*` | Same, for Apartments.com property pages. |
| `https://*.redfin.com/*` | Same, for Redfin home pages. |
| `https://*.facebook.com/*` | Read text the student selects on a Facebook post. |
| `https://api.openrouteservice.org/*` | Geocode the listing address and request walk, bike, and driving routes. Runs only after the student saves a key. |
| `https://transit.land/*` | Request a weekday morning bus itinerary. Runs only after the student saves a key. |

The store package does not request `<all_urls>`, optional host permissions, or `http://localhost`. Those localhost hosts exist only in the Playwright build.

## Dashboard steps

1. Sign in at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) with the account that will own the listing. The one-time developer registration fee is paid there. This agent cannot do that.
2. Confirm GitHub Pages is publishing this repo's `docs/` folder, and open `https://aabro1325.github.io/mustang-housing-match/privacy/` so the privacy URL returns the policy. If Pages is not on, use another host you control and use that URL instead. The dashboard rejects a missing privacy policy.
3. Click **New item** and upload `mustang-housing-match/release/mustang-housing-match-1.0.0.zip`. Do not upload the repo zip or the `extension-alpha` folder. That folder is the old preview.
4. Store listing:
   - Paste the short and detailed descriptions above.
   - Upload at least one 1280×800 screenshot: `mustang-housing-match/release/store-screenshot-1280x800.png`.
   - Upload the 128×128 icon if the form asks for one separately: `mustang-housing-match/public/icons/icon128.png`. The 16, 32, 48, and 128 icons are already inside the zip.
5. Privacy:
   - Privacy policy URL from step 2.
   - Single purpose: help a student score one rental listing against their own housing preferences.
   - Permission justifications from the table above.
   - Data use: the extension reads website content the user chooses to analyze and stores preferences and saved listings locally. It does not sell data. It sends a listing address to openrouteservice and coordinates to Transitland only when the user has saved API keys.
   - Certify that the data use disclosures are accurate.
6. Distribution: public, or unlisted if the class only needs a link. Regions: wherever the team wants students to install it.
7. On the options page of a local install, paste an openrouteservice key and a Transitland key before expecting live commute times. Leave them blank and the panel explains that commute lookup is not set up. Do not put those keys in the zip.
8. Click **Submit for review**. Review is done by Chrome, not by this repository.

## Keys

The store zip is built with `VITE_COMMUTE_PROVIDER=live` and empty key variables. `npm run package:store` refuses to run if either key is set in the environment or in `.env` / `.env.production`. Students enter keys on the extension options page. Those values live in `chrome.storage.local` on that profile. Anyone with access to the profile can read them. That is the remaining risk, and it is why the keys are not compiled into the package.

If a key was ever committed to git history, rotate it at the provider. Do not paste the old value into a commit, issue, or log.
