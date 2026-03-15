function show(stateId) {
  document.getElementById('state-default').hidden = true;
  document.getElementById('state-unsupported').hidden = true;
  document.getElementById(stateId).hidden = false;
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs?.[0];
  if (tab?.url?.startsWith('http')) {
    show('state-default');
  } else {
    show('state-unsupported');
  }
});

document.getElementById('start-clipping').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/picker.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/extractor.js', 'content/picker.js']
      });
    } catch (err) {
      console.error('[Atomic Clipper] Injection failed:', err);
    }
  }
  window.close();
});

document.getElementById('clip-article').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content/picker.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/extractor.js'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => { window._atomicClipperAutoClip = true; } });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/picker.js'] });
    } catch (err) {
      console.error('[Atomic Clipper] Auto-clip failed:', err);
    }
  }
  window.close();
});

document.getElementById('open-library').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('library/library.html') });
  window.close();
});
