# Mustang Housing Match privacy policy

Independent student project for IME 4403 at Cal Poly San Luis Obispo. Not affiliated with Cal Poly or any listing site. This policy describes the Chrome extension version 1.0.0.

## What stays on your device

The extension stores data in your Chrome profile:

- Housing preferences (budget, transportation, lease, room, amenities, priorities) in `chrome.storage.sync`.
- Saved listings, notes, tour times, statuses, and the local shared list in `chrome.storage.local`.
- A cache of commute results for addresses you have already looked up.
- Openrouteservice and Transitland API keys, if you paste them on the options page. Those keys are not included in the extension package.

The extension does not run analytics and does not have an account system in the store build.

## What is read from a web page

Nothing is read until you click **Analyze listing** or **Analyze selected text**. That click reads the listing you are viewing (address, rent, beds, baths, lease, fees, and amenities the page states) or the text you selected or pasted. The extension does not crawl pages in the background.

## Third-party services

Commute lookups run only after you save both API keys in the extension options.

- **openrouteservice** (HeiGIT) receives the listing address and returns coordinates plus walking, biking, and driving routes to the Robert E. Kennedy Library at Cal Poly.
- **Transitland** receives those coordinates and returns a weekday morning bus itinerary to the same library.

If keys are missing, the panel says commute lookup is not set up. It does not send the address and it does not invent a travel time.

The store build keeps roommate lists on this device. A separately configured developer build can send the shared list to an AWS AppSync API the group operates. That endpoint is not packaged in the store zip.

## What this extension does not do

- It does not sell or share your data with advertisers.
- It does not request your precise device location.
- It does not read pages you have not asked it to analyze.
- It does not embed commute API keys in the download.

## Contact

Questions about this policy can be opened as an issue on the project repository: https://github.com/aabro1325/mustang-housing-match/issues
