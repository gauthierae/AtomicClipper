import { saveClip, getCategories } from '../shared/storage.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'saveClip') {
    saveClip(message.data)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // Async response — keep channel open
  }

  if (message.action === 'getCategories') {
    getCategories()
      .then(cats => sendResponse(cats))
      .catch(() => sendResponse([]));
    return true; // Async response — keep channel open
  }
});
