(function () {
  'use strict';

  // Guard against double-injection
  if (document.querySelector('meta[name="atomic-clipper-active"]')) {
    window._atomicClipperAutoClip = false; // prevent stale flag if guard fires
    return;
  }

  const sentinel = document.createElement('meta');
  sentinel.name = 'atomic-clipper-active';
  document.head.appendChild(sentinel);

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
  function isAccelKey(e) { return isMac ? e.key === 'Meta' : e.key === 'Control'; } // the released key

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

    // Remove all injected elements
    document.querySelectorAll('[id^="atomic-clipper-"]').forEach(el => el.remove());

    // Strip any lingering pick-confirmation flash (ENH-18-01)
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
      showNavToast('Picker cancelled \u2014 page navigated');
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
    if (el.id && el.id.startsWith('atomic-clipper-')) return true;
    // Check ancestors up to body
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      if (parent.id && parent.id.startsWith('atomic-clipper-')) return true;
      parent = parent.parentElement;
    }
    return false;
  }

  // A container this large is structural (page shell, `<main>`, a full-width wrapper), not a pickable
  // content element — treat it like isOwnElement so it can never become currentHighlight or a click
  // target (DEF-19-01). Media leaf elements are exempt: a full-viewport image/video is legitimate
  // content a user may deliberately want to clip (Sprint 19), not page whitespace.
  const STRUCTURAL_AREA_RATIO = 0.9; // covers ≥90% of both viewport dimensions
  const STRUCTURAL_EXEMPT_TAGS = new Set(['IMG', 'VIDEO', 'PICTURE', 'CANVAS', 'SVG']);

  // Stored string length, not decoded image bytes — storage.js rewrites the whole clips array on
  // every save, so the string is exactly what each future write pays for.
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
    if (isOwnElement(e.target)) return;          // tray + buttons are own elements → ignored here
    if (justAccumulatedDrag) { justAccumulatedDrag = false; return; }  // consume unconditionally (DEF-18-01)

    const selected = currentHighlight || e.target;
    if (isStructuralContainer(selected)) {
      e.preventDefault();
      e.stopPropagation();
      return;                                     // whitespace / structural area — no valid element under the cursor
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
      showPendingTray();
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
      showSelectHint(extracted.droppedCount > 0);
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
        showPendingTray();
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
      const hint = document.getElementById('atomic-clipper-select-hint');
      if (hint) hint.remove();
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
    const tray = document.getElementById('atomic-clipper-tray');
    if (tray) tray.remove();
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

  // --- PENDING-BLOCKS TRAY ---

  function showPendingTray() {
    let tray = document.getElementById('atomic-clipper-tray');
    if (!tray) { tray = buildPendingTray(); document.body.appendChild(tray); }
    updatePendingTray();
  }

  function updatePendingTray() {
    const tray = document.getElementById('atomic-clipper-tray');
    if (!tray) return;
    const n = pendingBlocks.length;
    if (n === 0) { tray.remove(); return; }               // auto-close → clean PICKING
    tray.querySelector('#atomic-clipper-tray-count').textContent = n + (n === 1 ? ' block' : ' blocks');
    tray.querySelector('#atomic-clipper-tray-save').textContent = 'Save (' + n + ')';
  }

  function buildPendingTray() {
    const tray = document.createElement('div');
    tray.id = 'atomic-clipper-tray';

    const header = document.createElement('div');
    header.style.cssText = 'font-weight:700;margin-bottom:8px;color:#0a66c2;font-size:14px;';
    header.textContent = 'Atomic Clipper — Pending';

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:#555;margin-bottom:10px;line-height:1.4;';
    hint.textContent = 'Hold Ctrl (⌘) · click/drag regions · release to save';

    const count = document.createElement('div');
    count.id = 'atomic-clipper-tray-count';
    count.style.cssText = 'font-size:13px;font-weight:600;color:#333;margin-bottom:12px;';
    count.textContent = '0 blocks';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';

    const removeBtn = document.createElement('button');
    removeBtn.id = 'atomic-clipper-tray-remove';
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove last';
    removeBtn.style.cssText =
      'padding:6px 10px;border:1px solid #ccc;background:#fff;' +
      'border-radius:4px;cursor:pointer;font-size:13px;color:#333;';
    removeBtn.addEventListener('click', () => { pendingBlocks.pop(); updatePendingTray(); });

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'atomic-clipper-tray-cancel';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText =
      'padding:6px 10px;border:1px solid #ccc;background:#fff;' +
      'border-radius:4px;cursor:pointer;font-size:13px;color:#333;';
    cancelBtn.addEventListener('click', () => { cleanup(); });

    const saveBtn = document.createElement('button');
    saveBtn.id = 'atomic-clipper-tray-save';
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save (0)';
    saveBtn.style.cssText =
      'padding:6px 10px;background:#0a66c2;color:#fff;border:none;' +
      'border-radius:4px;cursor:pointer;font-size:13px;';
    saveBtn.addEventListener('click', () => { finalize(); });

    btnRow.appendChild(removeBtn);
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);

    tray.appendChild(header);
    tray.appendChild(hint);
    tray.appendChild(count);
    tray.appendChild(btnRow);
    return tray;
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

  // --- SIZE-CAP DECISION ROW (Sprint 21) ---
  // Non-blocking on Save, matching probeAssetAvailability: an asset the user never decides on is
  // kept. The KB figure describes the stored string, not the decoded image — hence "image data".
  function buildOversizedAssetRow(url, sizeBytes, onDecision) {
    const row = document.createElement('div');
    row.style.cssText =
      'font-size:12px;color:#555;margin:8px 0;padding:8px;border:1px solid #f0ad4e;' +
      'border-radius:4px;background:#fff8ec;';

    const kb = Math.round(sizeBytes / 1024);
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `Oversized inline image, ${kb} KB`);

    const label = document.createElement('div');
    label.style.cssText = 'margin-bottom:6px;';
    label.setAttribute('role', 'status'); // the storage-usage figure arrives async — announce it
    label.textContent = `Inline image data · ${kb} KB`;
    row.appendChild(label);

    chrome.runtime.sendMessage({ action: 'getStorageUsage' }, (usage) => {
      void chrome.runtime.lastError;
      if (!usage || typeof usage.quota !== 'number' || !usage.quota) return;
      const pct = Math.round((sizeBytes / usage.quota) * 100);
      label.textContent = `Inline image data · ${kb} KB — uses ${pct}% of your library space`;
    });

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;';

    const btnStyle =
      'padding:4px 10px;border:1px solid #ccc;background:#fff;' +
      'border-radius:4px;cursor:pointer;font-size:12px;';

    const keepBtn = document.createElement('button');
    keepBtn.type = 'button';
    keepBtn.textContent = 'Keep';
    keepBtn.setAttribute('aria-label', `Keep the ${kb} KB inline image`);
    keepBtn.style.cssText = btnStyle;
    keepBtn.addEventListener('click', () => { onDecision('keep'); row.remove(); });

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.textContent = 'Skip';
    skipBtn.setAttribute('aria-label', `Skip the ${kb} KB inline image`);
    skipBtn.style.cssText = btnStyle;
    skipBtn.addEventListener('click', () => { onDecision('skip'); row.remove(); });

    btnRow.appendChild(keepBtn);
    btnRow.appendChild(skipBtn);
    row.appendChild(btnRow);
    return row;
  }

  // --- INLINE SAVE PANEL ---

  function showSavePanel(clipText, clipAssets, clipUrl, clipTitle, blockCount) {
    state = 'SAVING';

    const unavailableAssets = new Set();
    if (Array.isArray(clipAssets) && clipAssets.length) {
      probeAssetAvailability(clipAssets, unavailableAssets);
    }

    const skippedAssets = new Set();
    const oversizedAssets = (Array.isArray(clipAssets) ? clipAssets : []).filter(isOversizedInlineAsset);

    // Fetch existing categories for datalist
    chrome.runtime.sendMessage({ action: 'getTags' }, (categories) => {
      // Suppress "no handler" error (Sprint 7 — handler added in Sprint 8)
      void chrome.runtime.lastError;
      if (cleaned) return;

      if (!Array.isArray(categories)) categories = [];

      const preview = clipText.length > 200
        ? clipText.slice(0, 200) + '\u2026'
        : clipText;

      const isImageOnly = !clipText.trim() && Array.isArray(clipAssets) && clipAssets.length > 0;

      const panel = document.createElement('div');
      panel.id = 'atomic-clipper-panel';

      // Header
      const header = document.createElement('div');
      header.style.cssText = 'font-weight:700;margin-bottom:8px;color:#0a66c2;font-size:14px;';
      header.textContent = (blockCount && blockCount > 1)
        ? 'Atomic Clipper \u2014 Save Clip (' + blockCount + ' blocks)'
        : 'Atomic Clipper \u2014 Save Clip';

      // Preview
      const previewEl = document.createElement('div');
      previewEl.style.cssText =
        'font-size:12px;color:#555;margin-bottom:12px;' +
        'max-height:60px;overflow:hidden;line-height:1.4;' +
        'white-space:pre-wrap;word-break:break-word;';
      if (isImageOnly) {
        // Image-only clip: show an affordance (caption + thumbnail) instead of a blank box.
        const cap = document.createElement('div');
        cap.textContent = clipAssets.length === 1
          ? 'Image clip'
          : 'Image clip — ' + clipAssets.length + ' images';
        const thumb = document.createElement('img');
        thumb.src = clipAssets[0];
        thumb.alt = '';
        thumb.loading = 'lazy';
        thumb.referrerPolicy = 'no-referrer';
        thumb.style.cssText =
          'display:block;max-width:100%;max-height:44px;margin-top:6px;border-radius:3px;';
        // Dead / hotlink-protected / host-CSP-blocked URL → drop the img, keep the caption.
        thumb.addEventListener('error', () => thumb.remove());
        previewEl.appendChild(cap);
        previewEl.appendChild(thumb);
      } else {
        previewEl.textContent = preview;
      }

      // Size-cap decision rows (one per oversized inline asset), or null when there are none.
      // Read lazily by focusRing(), which is why it is built here rather than at append time.
      let oversizedContainer = null;
      if (oversizedAssets.length) {
        oversizedContainer = document.createElement('div');
        for (const url of oversizedAssets) {
          oversizedContainer.appendChild(
            buildOversizedAssetRow(url, url.length, (decision) => {
              if (decision === 'skip') skippedAssets.add(url);
            })
          );
        }
        // Delegated: rows come and go as they are decided, so binding per button would go stale.
        oversizedContainer.addEventListener('keydown', (e) => {
          if (e.key !== 'Tab') return;
          e.preventDefault();
          stepFocus(e.target, e.shiftKey);
        });
      }

      // Category label
      const label = document.createElement('label');
      label.htmlFor = 'atomic-clipper-category-input';
      label.style.cssText = 'display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#333;';
      label.textContent = 'Category';

      // Category input wrapper (position:relative anchors the dropdown)
      const inputWrapper = document.createElement('div');
      inputWrapper.style.cssText = 'position:relative;margin-bottom:12px;';

      // Category input
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'atomic-clipper-category-input';
      input.placeholder = 'e.g. AI Research';
      input.style.cssText =
        'width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:4px;' +
        'font-size:14px;outline:none;';

      // Custom autocomplete dropdown
      const dropdown = document.createElement('div');
      dropdown.style.cssText =
        'position:absolute;left:0;right:0;top:100%;background:#fff;' +
        'border:1px solid #0a66c2;border-top:none;border-radius:0 0 4px 4px;' +
        'max-height:120px;overflow-y:auto;z-index:1;display:none;';

      function renderDropdown(items) {
        dropdown.innerHTML = '';
        if (!items.length) { dropdown.style.display = 'none'; return; }
        items.forEach(cat => {
          const item = document.createElement('div');
          item.textContent = cat;
          item.setAttribute('tabindex', '-1');
          item.style.cssText = 'padding:6px 8px;cursor:pointer;font-size:14px;';
          item.addEventListener('mouseover', () => { item.style.background = '#f0f6ff'; });
          item.addEventListener('mouseout',  () => { item.style.background = ''; });
          item.addEventListener('focus',     () => { item.style.background = '#f0f6ff'; });
          item.addEventListener('blur',      () => { item.style.background = ''; });
          item.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent input blur before value is set
            input.value = cat;
            dropdown.style.display = 'none';
            saveBtn.focus(); // FR-S11-01: move focus to Save after selection
          });
          dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
      }

      let escPressed = false;

      input.addEventListener('focus', () => {
        input.style.borderColor = '#0a66c2';
        if (escPressed) { escPressed = false; return; }
        const val = input.value.trim().toLowerCase();
        const filtered = val ? categories.filter(c => c.toLowerCase().includes(val)) : categories;
        renderDropdown(filtered);
      });

      input.addEventListener('blur', () => {
        input.style.borderColor = '#ccc';
      });

      input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        const filtered = val ? categories.filter(c => c.toLowerCase().includes(val)) : categories;
        renderDropdown(filtered);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          dropdown.style.display = 'none';
          if (input.value.trim()) saveBtn.focus();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (dropdown.style.display === 'none') {
            // Re-open dropdown if it was closed (e.g. user pressed Esc earlier)
            const val = input.value.trim().toLowerCase();
            const filtered = val ? categories.filter(c => c.toLowerCase().includes(val)) : categories;
            renderDropdown(filtered);
          }
          const items = dropdown.querySelectorAll('div');
          if (items.length > 0) items[0].focus();
        } else if (e.key === 'Escape') {
          if (dropdown.style.display !== 'none') {
            e.stopPropagation(); // Prevent global Esc → cleanup while dropdown is open
            dropdown.style.display = 'none';
          }
          // If dropdown already hidden, Esc propagates → global cleanup fires (expected)
        }
      });

      dropdown.addEventListener('keydown', (e) => {
        const items = [...dropdown.querySelectorAll('div')];
        const idx = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (idx < items.length - 1) items[idx + 1].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (idx > 0) items[idx - 1].focus();
          else input.focus();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (idx !== -1) {
            input.value = items[idx].textContent;
            dropdown.style.display = 'none';
            saveBtn.focus(); // FR-S11-01: move focus to Save after selection
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation(); // Prevent global Esc → cleanup; user is dismissing the dropdown
          escPressed = true;   // Prevent focus handler from re-showing the dropdown
          dropdown.style.display = 'none';
          input.focus();
        }
      });

      // Hide dropdown when focus leaves the inputWrapper entirely
      // (relatedTarget = element receiving focus; if inside inputWrapper, keep dropdown open)
      inputWrapper.addEventListener('focusout', (e) => {
        if (!inputWrapper.contains(e.relatedTarget)) {
          dropdown.style.display = 'none';
        }
      });

      inputWrapper.appendChild(input);
      inputWrapper.appendChild(dropdown);

      // Button row
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

      const cancelBtn = document.createElement('button');
      cancelBtn.id = 'atomic-clipper-cancel';
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText =
        'padding:6px 14px;border:1px solid #ccc;background:#fff;' +
        'border-radius:4px;cursor:pointer;font-size:14px;color:#333;';

      const saveBtn = document.createElement('button');
      saveBtn.id = 'atomic-clipper-save';
      saveBtn.type = 'button';
      saveBtn.textContent = 'Save';
      saveBtn.style.cssText =
        'padding:6px 14px;background:#0a66c2;color:#fff;border:none;' +
        'border-radius:4px;cursor:pointer;font-size:14px;';

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(saveBtn);

      // Focus trap: Tab cycles the panel's live controls in DOM order —
      // [size-cap Keep/Skip buttons…] → input → Cancel → Save → wrap.
      // Rebuilt on every Tab rather than captured once: a size-cap row removes itself as soon as it
      // is decided, so the ring shrinks mid-session (CR-21-01). With no rows it is
      // [input, Cancel, Save] — identical to the pre-Sprint-21 cycle in both directions.
      function focusRing() {
        const rows = oversizedContainer
          ? Array.from(oversizedContainer.querySelectorAll('button'))
          : [];
        return [...rows, input, cancelBtn, saveBtn];
      }

      function stepFocus(from, backwards) {
        const ring = focusRing();
        const i = ring.indexOf(from);
        if (i === -1) { input.focus(); return; }
        ring[(i + (backwards ? -1 : 1) + ring.length) % ring.length].focus();
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          dropdown.style.display = 'none';
          stepFocus(input, e.shiftKey);
        }
      });
      cancelBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          stepFocus(cancelBtn, e.shiftKey);
        }
      });
      saveBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          stepFocus(saveBtn, e.shiftKey);
        }
      });
      dropdown.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          dropdown.style.display = 'none';
          if (e.shiftKey) input.focus(); else cancelBtn.focus();
        }
      });

      panel.appendChild(header);
      panel.appendChild(previewEl);
      if (oversizedContainer) panel.appendChild(oversizedContainer);
      panel.appendChild(label);
      panel.appendChild(inputWrapper);
      panel.appendChild(btnRow);

      document.body.appendChild(panel);
      setTimeout(() => input.focus(), 50);

      // --- SAVE ---
      saveBtn.addEventListener('click', () => {
        const category = input.value.trim() || 'Uncategorized';
        const finalAssets = (Array.isArray(clipAssets) ? clipAssets : [])
          .filter(u => !skippedAssets.has(u));

        // Skipping the sole asset of an image-only clip would otherwise persist a card with no
        // text and no image — junk the user has to find and delete (SR-21-01).
        if (!clipText.trim() && finalAssets.length === 0) {
          cleanup();
          showToast('Nothing left to save — the image was skipped.');
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
            showToast(response.migrating
              ? 'Could not save \u2014 your library is still being upgraded.'
              : 'Could not save \u2014 storage may be full.');
          } else {
            showToast('Clip saved!');
          }
        });
      });

      // --- CANCEL ---
      cancelBtn.addEventListener('click', () => {
        cleanup();
      });
    });
  }

  // --- TOAST ---

  function showToast(message) {
    const toast = document.createElement('div');
    toast.id = 'atomic-clipper-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 1500);
  }

  // Selection fallback hint — persistent (no auto-hide); removed by onMouseup or cleanup()
  // `hadDroppedAssets` distinguishes "nothing here" from "the only thing here was a filtered-out
  // image" — telling the latter user to select text points them at something that was never going
  // to produce a savable clip. Manual drag-select still works in either case (onMouseup, SELECTING).
  function showSelectHint(hadDroppedAssets) {
    const hint = document.createElement('div');
    hint.id = 'atomic-clipper-select-hint';
    hint.setAttribute('role', 'status'); // announces to screen readers (polite live region)
    hint.textContent = hadDroppedAssets
      ? "This image can\u2019t be clipped \u2014 Esc to cancel"
      : "Couldn\u2019t extract \u2014 select text to clip";
    document.body.appendChild(hint);
  }

  // Navigation cancellation toast — appended after cleanup() so it survives the sweep
  function showNavToast(message) {
    const toast = document.createElement('div');
    toast.id = 'atomic-clipper-nav-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 2000);
  }
})();
