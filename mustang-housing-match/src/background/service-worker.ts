// MV3 service worker. Registers listeners at top level; keeps no state (the worker dies after 30s idle).
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
