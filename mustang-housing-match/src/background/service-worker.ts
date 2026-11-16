// MV3 service worker. Registers listeners at top level; keeps no state (the worker dies after 30s idle).
const PANEL_PATH = "src/sidepanel/index.html";

function enablePanel(): void {
  // Set on every worker start, not only onInstalled. A missed install event leaves the toolbar click doing nothing.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: unknown) => {
    console.error("Could not open the side panel from the toolbar", err);
  });
  chrome.sidePanel.setOptions({ path: PANEL_PATH, enabled: true }).catch((err: unknown) => {
    console.error("Could not enable the side panel", err);
  });
}

enablePanel();
chrome.runtime.onInstalled.addListener(() => {
  enablePanel();
});
