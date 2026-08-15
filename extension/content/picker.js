// Atomic Clipper — picker state machine (Sprint 23)
//
// Picking logic only. Every node on screen is built by picker-ui.js, which must be injected
// before this file. See sprints/sprint-23.md §5 for the contract.
//
// This file builds exactly one node: the double-injection sentinel meta tag. It is a guard, not UI.
// UAT step 9 greps for that and expects a single hit, so keep the phrasing out of comments.

(function () {
  'use strict';

  const ui = window._atomicClipper && window._atomicClipper.ui;
  if (!ui) {
    console.error('[Atomic Clipper] picker-ui.js must load before picker.js');
    return;
  }

  // Guard against double-injection
  if (document.querySelector('meta[name="atomic-clipper-active"]')) {
    window._atomicClipperAutoClip = false; // prevent stale flag if guard fires
    return;
  }

  const sentinel = document.createElement('meta');
  sentinel.name = 'atomic-clipper-active';
  document.head.appendChild(sentinel);

  ui.mount();

  let state = 'PICKING';
  let currentHighlight = null;
  let cleaned = false;
  let selectingUrl = '';
  let selectingTitle = '';

  // --- MULTI-BLOCK SELECTION (Sprint 18) ---
  const pendingBlocks = [];                                   // [{ text, assets }]
  let justAccumulatedDrag = false; // one-shot guard: consumed by the very next click (DEF-18-01)
  const isMac = /Mac/i.test(navigator.platform || navigator.userAgent || '');
  function isAccel(e) { return isMac ? e.metaKey : e.ctrlKey; }         // modifier currently held?
  function isAccelKey(e) { return isMac ? e.key === 'Meta' : e.key === 'Control'; } // released key

  // --- AUTO-CLIP MODE ---
  if (window._atomicClipperAutoClip) {
    window._atomicClipperAutoClip = false;
    document.addEventListener('keydown', onKeydown); // Esc closes save panel
    const target = document.querySelector('article') || document.querySelector('main') || document.body;
    const extracted = window._atomicClipperExtract(target);
    showSavePanel(extracted.text, extracted.assets, window.location.href, document.title);
    return; // skip PICKING phase — no cursor, no event listeners
  }

  // --- CLEANUP ---

  function cleanup() {
    if (cleaned) return;
    cleaned = true;

    // All overlay UI lives in the picker shadow host — one removal covers the lot.
    ui.unmount();

    // Strip any lingering pick-confirmation flash (ENH-18-01). These are PAGE elements, not
    // overlay nodes, so they can never live in the shadow root (spec §1 F2).
    document.querySelectorAll('.atomic-clipper-added').forEach(el => el.classList.remove('atomic-clipper-added'));

    // Remove highlight
    if (currentHighlight) {
      currentHighlight.classList.remove('atomic-clipper-highlight');
      currentHighlight = null;
    }

    // Remove sentinel
    const s = document.querySelector('meta[name="atomic-clipper-active"]');
    if (s) s.remove();

    // Restore cursor
    document.body.style.cursor = '';

    // Remove all listeners
    document.removeEventListener('mouseover', onMouseover);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('mouseup', onMouseup);
    document.removeEventListener('keyup', onKeyup);
    window.removeEventListener('popstate', onNavigate);
    window.removeEventListener('hashchange', onNavigate);
  }

  // --- SPA NAVIGATION GUARD ---

  const activationUrl = window.location.href;

  function onNavigate() {
    if (window.location.href !== activationUrl) {
      cleanup();
      ui.showToast('Picker cancelled — page navigated', 'nav');
    }
  }

  window.addEventListener('popstate', onNavigate);
  window.addEventListener('hashchange', onNavigate);

  // --- PICKING PHASE ---

  document.body.style.cursor = 'crosshair';

  function isOwnElement(el) {
    if (!el) return true;
    if (el === document.documentElement) return true;
    if (el === document.body) return true;
    // Shadow DOM retargets: a click inside the overlay arrives here as the host itself, so an
    // identity check replaces the pre-Sprint-23 ancestor walk (spec §2 AD-6).
    return ui.isOwnHost(el);
  }

  // A container this large is structural (page shell, `<main>`, a full-width wrapper), not a pickable
  // content element — treat it like isOwnElement so it can never become currentHighlight or a click
  // target (DEF-19-01). Media leaf elements are exempt: a full-viewport image/video is legitimate
  // content a user may deliberately want to clip (Sprint 19), not page whitespace.
  const STRUCTURAL_AREA_RATIO = 0.9; // covers ≥90% of both viewport dimensions
  const STRUCTURAL_EXEMPT_TAGS = new Set(['IMG', 'VIDEO', 'PICTURE', 'CANVAS', 'SVG']);

  // Stored string length, not decoded image bytes. Storage is per-clip since Sprint 22, so this is
  // no longer what every future write pays for — but it is still what this clip costs against the
  // 10MB quota, which is the budget the cap defends.
  const INLINE_ASSET_SIZE_CAP_BYTES = 100 * 1024;

  function isOversizedInlineAsset(url) {
    return typeof url === 'string'
      && url.startsWith('data:image/')
      && url.length > INLINE_ASSET_SIZE_CAP_BYTES;
  }

  function isStructuralContainer(el) {
    if (!el) return false;
    if (STRUCTURAL_EXEMPT_TAGS.has(el.tagName)) return false;
    if (el.tagName === 'MAIN') return true;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!vw || !vh || !rect.width || !rect.height) return false;
    return (rect.width / vw) >= STRUCTURAL_AREA_RATIO && (rect.height / vh) >= STRUCTURAL_AREA_RATIO;
  }

  function onMouseover(e) {
    if (state !== 'PICKING') return;
    if (isOwnElement(e.target)) return;

    if (isStructuralContainer(e.target)) {
      // Whitespace / structural area — clear any stale highlight, do not adopt this element.
      if (currentHighlight) {
        currentHighlight.classList.remove('atomic-clipper-highlight');
        currentHighlight = null;
      }
      return;
    }

    if (currentHighlight && currentHighlight !== e.target) {
      currentHighlight.classList.remove('atomic-clipper-highlight');
    }
    e.target.classList.add('atomic-clipper-highlight');
    currentHighlight = e.target;
  }

  document.addEventListener('mouseover', onMouseover);

  // --- ESC TO CANCEL ---

  function onKeydown(e) {
    if (e.key === 'Escape') {
      cleanup();
    }
  }

  document.addEventListener('keydown', onKeydown);

  // --- CLICK TO SELECT (capture phase intercepts before page handlers) ---

  function onClick(e) {
    if (state !== 'PICKING') return;
    if (isOwnElement(e.target)) return;          // tray + buttons retarget to the host → ignored here
    if (justAccumulatedDrag) { justAccumulatedDrag = false; return; }  // consume unconditionally (DEF-18-01)

    const selected = currentHighlight || e.target;
    if (isStructuralContainer(selected)) {
      e.preventDefault();
      e.stopPropagation();
      return;                                     // whitespace / structural area — nothing valid under the cursor
    }

    e.preventDefault();
    e.stopPropagation();                          // keeps suppressing browser Cmd/Ctrl+click new-tab

    const extracted = window._atomicClipperExtract(selected);
    const hasContent = !!extracted.text.trim() ||
                       (Array.isArray(extracted.assets) && extracted.assets.length > 0);

    // --- ACCUMULATE (modifier held) ---
    if (isAccel(e)) {
      if (!hasContent) return;                    // ignore empty pick; never enter SELECTING while accumulating
      addBlock(extracted);
      flashPick(selected);
      if (currentHighlight) { currentHighlight.classList.remove('atomic-clipper-highlight'); currentHighlight = null; }
      ui.showTray(trayHandlers);
      ui.updateTray(pendingBlocks.length);
      return;                                     // stay PICKING; mouseover + keyup still attached
    }

    // --- PLAIN pick (no modifier) ---
    // Freeze highlight (only on the plain branch — accumulation keeps mouseover live)
    document.removeEventListener('mouseover', onMouseover);
    if (currentHighlight) { currentHighlight.classList.remove('atomic-clipper-highlight'); currentHighlight = null; }

    if (pendingBlocks.length > 0) { finalize(); return; }   // key already released; finish (do NOT add the stray click)

    // No pending → existing single-block behavior, verbatim
    const clipUrl = window.location.href;
    const clipTitle = document.title;
    if (!hasContent) {
      // Empty extraction with no assets → SELECTING state: let user select text manually.
      // (An image-only element has empty text but a populated assets[]; it falls through to save.)
      state = 'SELECTING';
      selectingUrl = clipUrl;
      selectingTitle = clipTitle;
      document.body.style.cursor = '';
      document.removeEventListener('click', onClick, true);
      ui.showSelectHint(extracted.droppedCount > 0);
      return;
    }
    state = 'SELECTED';
    document.body.style.cursor = '';
    showSavePanel(extracted.text, extracted.assets, clipUrl, clipTitle);
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('mouseup', onMouseup);

  // --- RELEASE-TO-FINALIZE (Sprint 18) ---

  function onKeyup(e) {
    if (state !== 'PICKING') return;
    if (!isAccelKey(e)) return;                 // only the accel key release matters
    if (pendingBlocks.length > 0) finalize();   // release with picks → save panel; else no-op
  }

  document.addEventListener('keyup', onKeyup);

  // --- MOUSEUP FOR DRAG-SELECT (PICKING) AND TEXT SELECTION (SELECTING) ---

  function extractFromSelection(selection) {
    try {
      const fragment = selection.getRangeAt(0).cloneContents();
      return window._atomicClipperExtractFragment(fragment);
    } catch (_e) {
      return { text: selection.toString().trim(), assets: [] };
    }
  }

  function onMouseup(e) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    if (state === 'PICKING') {
      const extracted = extractFromSelection(selection);

      if (isAccel(e)) {                                   // modifier+drag → accumulate
        if (!extracted.text.trim()) { selection.removeAllRanges(); return; }   // text-gated
        addBlock(extracted);
        selection.removeAllRanges();                      // clear stray browser selection
        if (currentHighlight) { currentHighlight.classList.remove('atomic-clipper-highlight'); currentHighlight = null; }
        justAccumulatedDrag = true;                        // guard the next click (DEF-18-01)
        ui.showTray(trayHandlers);
        ui.updateTray(pendingBlocks.length);
        return;
      }

      if (!extracted.text.trim()) return; // trivial selection — let onClick handle it
      document.removeEventListener('mouseover', onMouseover);
      if (currentHighlight) {
        currentHighlight.classList.remove('atomic-clipper-highlight');
        currentHighlight = null;
      }
      selection.removeAllRanges();
      if (pendingBlocks.length > 0) { finalize(); return; }   // plain drag after release → finish
      state = 'SELECTED';
      document.body.style.cursor = '';
      showSavePanel(extracted.text, extracted.assets, window.location.href, document.title);

    } else if (state === 'SELECTING') {
      const extracted = extractFromSelection(selection);
      if (!extracted.text.trim()) return; // empty selection — wait for next mouseup
      document.removeEventListener('mouseup', onMouseup);
      ui.hideSelectHint();
      showSavePanel(extracted.text, extracted.assets, selectingUrl, selectingTitle);
    }
  }

  // --- MULTI-BLOCK ACCUMULATION (Sprint 18) ---

  function addBlock(extracted) {                              // append a pick
    pendingBlocks.push({
      text: extracted.text || '',
      assets: Array.isArray(extracted.assets) ? extracted.assets : []
    });
  }

  // The tray no longer decides when to close itself (SR-23-07) — that call belongs here, where
  // pendingBlocks lives.
  const trayHandlers = {
    onRemoveLast: () => {
      pendingBlocks.pop();
      if (pendingBlocks.length === 0) ui.hideTray();
      else ui.updateTray(pendingBlocks.length);
    },
    onCancel: () => cleanup(),
    onSave: () => finalize()
  };

  function mergeBlocks() {                                    // → one { text, assets }
    const text = pendingBlocks
      .map(b => b.text)
      .filter(t => t && t.trim())          // drop empty-text (image-only) segments from the join
      .join('\n\n---\n\n');                // '---' divider between blocks (AC2)
    const seen = new Set();
    const assets = [];
    for (const b of pendingBlocks) {
      for (const url of b.assets) {        // cross-block dedup (AC3); per-block already deduped by pushAsset
        if (!seen.has(url)) { seen.add(url); assets.push(url); }
      }
    }
    return { text, assets };
  }

  function finalize() {                                       // teardown picking UI → save panel
    const merged = mergeBlocks();
    document.removeEventListener('mouseover', onMouseover);
    document.removeEventListener('keyup', onKeyup);
    ui.hideTray();
    if (currentHighlight) { currentHighlight.classList.remove('atomic-clipper-highlight'); currentHighlight = null; }
    document.querySelectorAll('.atomic-clipper-added').forEach(el => el.classList.remove('atomic-clipper-added')); // ENH-18-01
    state = 'SELECTED';
    document.body.style.cursor = '';
    showSavePanel(merged.text, merged.assets, window.location.href, document.title, pendingBlocks.length);
  }

  function flashPick(el) {                                    // brief green confirm on a click-add
    if (!el || !el.classList) return;
    el.classList.add('atomic-clipper-added');
    setTimeout(() => { if (el.classList) el.classList.remove('atomic-clipper-added'); }, 350);
  }

  // --- ASSET AVAILABILITY PROBE (ENH-19-01) ---
  // Best-effort capture-time probe: `new Image()` works cross-origin with no new permission; a
  // fetch()-based probe would fail CORS on most CDNs (200-po/BACKLOG.md, 2026-07-04). Non-blocking —
  // starts when the save panel opens and races the user's category entry; an asset not yet resolved by
  // Save time is treated as available.
  function probeAssetAvailability(urls, unavailableSet) {
    for (const url of urls) {
      const probe = new Image();
      probe.referrerPolicy = 'no-referrer';
      probe.addEventListener('error', () => unavailableSet.add(url));
      probe.src = url;
    }
  }

  // --- SAVE PANEL (data side; the DOM is picker-ui.js) ---

  function showSavePanel(clipText, clipAssets, clipUrl, clipTitle, blockCount) {
    state = 'SAVING';

    const assets = Array.isArray(clipAssets) ? clipAssets : [];
    const unavailableAssets = new Set();
    if (assets.length) probeAssetAvailability(assets, unavailableAssets);

    const oversizedAssets = assets.filter(isOversizedInlineAsset);

    // Fetch existing tags for the autocomplete list
    chrome.runtime.sendMessage({ action: 'getTags' }, (categories) => {
      // Suppress "no handler" error (Sprint 7 — handler added in Sprint 8)
      void chrome.runtime.lastError;
      if (cleaned) return;   // user pressed Esc during the round trip

      ui.showSavePanel({
        text: clipText,
        assets,
        oversizedAssets,
        categories: Array.isArray(categories) ? categories : [],
        blockCount,
        onCancel: () => cleanup(),
        onSave: (category, finalAssets) => {
          // Skipping the sole asset of an image-only clip would otherwise persist a card with no
          // text and no image — junk the user has to find and delete (SR-21-01).
          if (!clipText.trim() && finalAssets.length === 0) {
            cleanup();
            ui.showToast('Nothing left to save — the image was skipped.');
            return;
          }

          const capturedAt = new Date().toISOString();
          const clip = {
            id: crypto.randomUUID(),
            url: clipUrl,
            title: clipTitle,
            text: clipText,
            assets: finalAssets,
            unavailableAssets: Array.from(unavailableAssets).filter(u => finalAssets.includes(u)),
            tags: [category],
            // Fields defined now, filled by extraction in a later sprint — defining them here is what
            // spares that sprint a second migration.
            reference: {
              author: null,
              title: null,
              publication: null,
              publishDate: null,
              sourceUrl: clipUrl,
              // Kept distinct from scrapedAt despite agreeing here: one is a storage timestamp, the
              // other a citation field that may later be edited independently.
              accessDate: capturedAt
            },
            provenance: [],   // reserved; single-source today, populated when merge lands
            scrapedAt: capturedAt
          };

          chrome.runtime.sendMessage({ action: 'saveClip', data: clip }, (response) => {
            void chrome.runtime.lastError;
            cleanup();
            if (response?.ok === false) {
              // `migrating` distinguishes a blocked save from a full disk — different problem, different fix.
              ui.showToast(response.migrating
                ? 'Could not save — your library is still being upgraded.'
                : 'Could not save — storage may be full.');
            } else {
              ui.showToast('Clip saved!');
            }
          });
        }
      });
    });
  }
})();
