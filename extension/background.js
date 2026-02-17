chrome.runtime.onInstalled.addListener((details) => {
  console.log('[UPG] Background service worker installed/updated.', details);

  if (details.reason === 'install') {
    chrome.runtime.setUninstallURL('https://upwork.webxhosts.in/extension/uninstall').catch(() => {});
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[UPG] Background service worker started.');
});

// Auto-update is handled by Chrome using manifest.update_url.
// Trigger a lightweight check on startup (best effort).
chrome.runtime.requestUpdateCheck((status, details) => {
  console.log('[UPG] Update check:', status, details || '');
});
