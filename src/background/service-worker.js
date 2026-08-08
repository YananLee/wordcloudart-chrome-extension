/**
 * WordCloudArt — background service worker.
 * Opens the side panel and keeps a right-click entry point for selections.
 */

const MENU_ID = 'wordcloudart-open';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Generate word cloud with WordCloudArt',
      contexts: ['selection', 'page']
    });
  });
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab) return;
  // openPanelOnActionClick does not cover menu clicks, so open it explicitly
  // while the user gesture is still valid.
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
    if (tab.windowId != null) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    }
  });
});
