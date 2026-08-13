import { saveClip, getTags, migrateIfNeeded } from '../shared/storage.js';

// Single-flight: concurrent messages arriving during a cold start await the same migration instead of
// racing it. Runs at module load — every service-worker wake — rather than from onInstalled, so a store
// that missed its update event still migrates. Costs one get() once already migrated.
let migrationPromise = null;
function ensureMigrated() {
  if (!migrationPromise) {
    migrationPromise = migrateIfNeeded()
      .then((result) => {
        // Clear a stale banner so it cannot outlive the problem it described.
        chrome.storage.local.remove('migrationError');
        return result;
      })
      .catch((err) => {
        console.error('[Atomic Clipper] migration failed:', err);
        // Non-destructive: the legacy `clips` key is untouched on every throw path. Record it so the
        // library can say so.
        chrome.storage.local.set({ migrationError: String(err?.message ?? err) });
        // Drop the cached rejection so the next call retries. The realistic failure is quota, which
        // the user fixes by deleting clips — without this, nothing would pick that up until the
        // service worker happened to restart. The library sends `ensureMigrated` on every open, so
        // reopening it becomes the retry gesture.
        migrationPromise = null;
        throw err;
      });
  }
  return migrationPromise;
}

ensureMigrated().catch(() => { /* already logged and recorded above */ });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'saveClip') {
    // Two failure sources, reported distinctly: the migration not completing (`migrating`) versus the
    // write itself failing, which really is a full disk. Collapsing them would put the wrong message
    // in front of the user for whichever one is rarer.
    ensureMigrated()
      .then(() => saveClip(message.data).then(
        () => sendResponse({ ok: true }),
        err => sendResponse({ ok: false, error: err.message })
      ))
      .catch(err => sendResponse({ ok: false, error: err.message, migrating: true }));
    return true; // Async response — keep channel open
  }

  if (message.action === 'getTags') {
    ensureMigrated()
      .then(() => getTags())
      .then(tags => sendResponse(tags))
      .catch(() => sendResponse([]));
    return true; // Async response — keep channel open
  }

  // Picker → background: storage usage for the size-cap warning (Sprint 21). Deliberately not gated on
  // the migration — getBytesInUse is version-agnostic, and delaying a size warning behind unrelated
  // work buys nothing.
  if (message.action === 'getStorageUsage') {
    chrome.storage.local.getBytesInUse(null, (bytesUsed) => {
      const quota = chrome.storage.local.QUOTA_BYTES || 10485760;
      sendResponse({ bytesUsed, quota });
    });
    return true; // Async response — keep channel open
  }

  // Library → background: block rendering until the migration settles, so the page never paints a
  // partially-migrated store. Resolves either way; the library reads `migrationError` itself.
  if (message.action === 'ensureMigrated') {
    ensureMigrated()
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: String(err?.message ?? err) }));
    return true; // Async response — keep channel open
  }
});
