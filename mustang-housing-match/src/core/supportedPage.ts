// Supported Page detection: which Source a URL belongs to, by the patterns in the sources decision (issue #8).

export type SourceKind = "home" | "building" | "listing";
export interface DetectedSource {
  source: "zillow" | "craigslist" | "apartments" | "redfin";
  kind: SourceKind;
}

const FIXTURE_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Returns the Source and page kind for a Supported Page, or null for an Unsupported Page. */
export function detectSource(url: string): DetectedSource | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname;

  // Fixture pages for the e2e build: ?mhm-source=zillow&kind=home on localhost.
  if (FIXTURE_HOSTS.has(host)) {
    const source = u.searchParams.get("mhm-source");
    const kind = u.searchParams.get("kind");
    if (source === "zillow") return { source, kind: kind === "building" ? "building" : "home" };
    if (source === "craigslist" || source === "apartments" || source === "redfin") return { source, kind: "listing" };
    return null;
  }

  if (host === "zillow.com" || host.endsWith(".zillow.com")) {
    // Home details sometimes grow an extra segment; building pages use /apartments/… and /b/….
    if (/\/homedetails\/.+\/\d+_zpid\b/.test(path)) return { source: "zillow", kind: "home" };
    if (/^\/apartments\/[^/]+\/[^/]+\/[A-Za-z0-9]+/.test(path)) return { source: "zillow", kind: "building" };
    if (/^\/b\/[^/]+/.test(path)) return { source: "zillow", kind: "building" };
    return null;
  }
  if (host === "craigslist.org" || host.endsWith(".craigslist.org")) {
    if (/^\/view\/d\/[^/]+\/[A-Za-z0-9]+\/?$/.test(path)) return { source: "craigslist", kind: "listing" };
    if (/\/d\/[^/]+\/\d+\.html$/.test(path)) return { source: "craigslist", kind: "listing" };
    return null;
  }
  if (host === "apartments.com" || host.endsWith(".apartments.com")) {
    // Listing ids vary in length. City and search pages are a single path segment and stay unsupported.
    if (/^\/[a-z0-9-]+\/[a-z0-9]{5,12}\/?$/i.test(path)) return { source: "apartments", kind: "listing" };
    return null;
  }
  if ((host === "redfin.com" || host.endsWith(".redfin.com")) && /\/home\/\d+/.test(path)) {
    return { source: "redfin", kind: "listing" };
  }
  return null;
}

/** Facebook Marketplace items and group posts are handled as Text Listings (student selects the post text). */
export function isTextListingPage(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  if (!(host === "facebook.com" || host.endsWith(".facebook.com"))) return false;
  return /^\/marketplace\/item\/\d+/.test(u.pathname) || /^\/groups\/[^/]+\/(posts|permalink)\/\d+/.test(u.pathname);
}
