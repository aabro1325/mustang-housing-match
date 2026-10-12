export interface ActiveTab { id: number; url: string | undefined; title: string | undefined }

export async function activeTab(): Promise<ActiveTab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || tab.id === undefined) return undefined;
  return { id: tab.id, url: tab.url, title: tab.title };
}

export function onActiveTabChanged(cb: () => void): () => void {
  const onActivated = () => cb();
  const onUpdated = (_id: number, info: chrome.tabs.TabChangeInfo) => { if (info.status === "complete" || info.url) cb(); };
  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  return () => {
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
  };
}
