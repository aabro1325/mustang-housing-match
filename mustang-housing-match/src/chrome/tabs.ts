export interface ActiveTab { id: number; url: string | undefined; title: string | undefined }

function toTab(tab: chrome.tabs.Tab | undefined): ActiveTab | undefined {
  if (!tab || tab.id === undefined) return undefined;
  return { id: tab.id, url: tab.url, title: tab.title };
}

export async function activeTab(): Promise<ActiveTab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return toTab(tab);
}

/**
 * The tab whose listing the panel evaluates. Normally the active tab. When the panel page itself is open in a tab
 * (the Playwright harness does this, since it cannot open the real side panel), the active tab is an extension page,
 * so fall back to the most recently used http(s) tab.
 */
export async function listingTab(): Promise<ActiveTab | undefined> {
  const active = await activeTab();
  if (active && active.url && !active.url.startsWith("chrome-extension://")) return active;
  const all = await chrome.tabs.query({});
  const web = all
    .filter((t) => t.id !== undefined && typeof t.url === "string" && /^https?:/.test(t.url))
    .sort((a, b) => ((b as { lastAccessed?: number }).lastAccessed ?? 0) - ((a as { lastAccessed?: number }).lastAccessed ?? 0));
  return toTab(web[0]) ?? active;
}

export function onActiveTabChanged(cb: () => void): () => void {
  const onActivated = () => cb();
  const onUpdated = (_id: number, info: chrome.tabs.OnUpdatedInfo) => { if (info.status === "complete" || info.url) cb(); };
  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  return () => {
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
  };
}
