// Atomic Clipper — picker UI module (Sprint 23)
//
// Every node the picker puts on screen is built here, inside a Shadow DOM. The state machine
// (picker.js) owns picking logic and never touches the DOM; this file owns the DOM and never
// touches picking state. See sprints/sprint-23.md §5 for the contract.
//
// Injected as a CLASSIC script by chrome.scripting.executeScript — import/export are not
// available (AD-1), so the module publishes itself on a window namespace like extractor.js does.
//
// LOAD-TIME SIDE EFFECTS ARE FORBIDDEN. The double-injection guard lives in picker.js and runs
// *after* this file has already executed a second time, so this file must only assign the
// namespace: no DOM, no listeners, no state.

(function () {
  'use strict';

  const HOST_ID = 'atomic-clipper-host';
  const TOAST_HOST_ID = 'atomic-clipper-toast-host';

  // `:host { all: initial }` is the load-bearing line (AD-4). A shadow root blocks selector
  // matching but NOT inheritance — font-family, font-size, color, line-height, visibility and
  // direction all cross the boundary from the host element. Without this reset a page running
  // `* { font-size: 0 !important }` still collapses the panel.
  //
  // Because `all: initial` also drops the inherited defaults we *want*, every rule below states
  // its own font-family and font-size rather than relying on inheritance.
  const SHADOW_CSS = `
:host { all: initial; }

.tray, .panel {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483647;
  background: #fff;
  border: 1px solid #0a66c2;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
  /* Every inheritable text property is stated, not inherited. The :host reset above only beats
     NORMAL page declarations — for !important ones the outer document wins, so a page running
     * { line-height: 0 !important } sets it on the host, and anything left unset here inherits it.
     These are the inheritable properties a hostile sheet can collapse the panel with (CR-23-01). */
  font-family: system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #333;
  text-align: left;
  letter-spacing: normal;
  word-spacing: normal;
  text-transform: none;
  white-space: normal;
  box-sizing: border-box;
}
.tray  { width: 240px; padding: 14px; }
.panel { width: 320px; padding: 16px; }

.tray *, .panel * {
  box-sizing: border-box;
  font-family: system-ui, sans-serif;
}

.panel img { display: block; max-width: 100%; }

.head {
  font-weight: 700;
  margin-bottom: 8px;
  color: #0a66c2;
  font-size: 14px;
}

.tray-hint {
  font-size: 12px;
  color: #555;
  margin-bottom: 10px;
  line-height: 1.4;
}

.tray-count {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.btn-row        { display: flex; gap: 6px; justify-content: flex-end; }
.btn-row--pad   { gap: 8px; }
.btn-row--start { justify-content: flex-start; }

.btn {
  padding: 6px 10px;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
}
.btn--primary {
  background: #0a66c2;
  color: #fff;
  border: none;
}
.btn--wide { padding: 6px 14px; font-size: 14px; }

.preview {
  font-size: 12px;
  color: #555;
  margin-bottom: 12px;
  max-height: 60px;
  overflow: hidden;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
.preview img {
  max-width: 100%;
  max-height: 44px;
  margin-top: 6px;
  border-radius: 3px;
}

.oversized {
  font-size: 12px;
  color: #555;
  margin: 8px 0;
  padding: 8px;
  border: 1px solid #f0ad4e;
  border-radius: 4px;
  background: #fff8ec;
}
.oversized-label { margin-bottom: 6px; }
.oversized .btn  { padding: 4px 10px; font-size: 12px; }

.field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #333;
}

.field-wrap { position: relative; margin-bottom: 12px; }

.field {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  color: #333;
  background: #fff;
}
.field:focus { border-color: #0a66c2; }

.dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  background: #fff;
  border: 1px solid #0a66c2;
  border-top: none;
  border-radius: 0 0 4px 4px;
  max-height: 120px;
  overflow-y: auto;
  z-index: 1;
  display: none;
  color: #333;
}
.dropdown-item {
  padding: 6px 8px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
}
.dropdown-item:hover,
.dropdown-item:focus { background: #f0f6ff; outline: none; }

.toast, .hint {
  position: fixed;
  top: 16px;
  right: 16px;
  background: #0a66c2;
  color: #fff;
  padding: 10px 18px;
  border-radius: 6px;
  /* Same reasoning as .tray/.panel — nothing inheritable is left to the host (CR-23-01). */
  font-family: system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  text-align: left;
  letter-spacing: normal;
  word-spacing: normal;
  text-transform: none;
  white-space: normal;
  z-index: 2147483647;
  pointer-events: none;
}
.toast       { opacity: 1; transition: opacity 0.4s ease; }
.toast--nav  { background: #e65100; }
.hint        { line-height: 1.45; }
.hint-esc    { opacity: 0.85; font-size: 13px; }
`;

  let root = null;          // picker shadow root
  let toastRoot = null;     // toast shadow root — independent lifetime (AD-3)

  function makeHost(id) {
    const host = document.createElement('div');
    host.id = id;
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    shadow.appendChild(style);
    return shadow;
  }

  function mount() {
    if (document.getElementById(HOST_ID)) return;
    root = makeHost(HOST_ID);
  }

  function unmount() {
    const host = document.getElementById(HOST_ID);
    if (host) host.remove();
    root = null;
  }

  // Clicks inside a shadow tree retarget to the host at document level, so identity is enough —
  // the pre-Sprint-23 ancestor walk over `atomic-clipper-` id prefixes is no longer needed (AD-6).
  function isOwnHost(node) {
    if (!node) return false;
    return node.id === HOST_ID || node.id === TOAST_HOST_ID;
  }

  function q(sel) { return root ? root.querySelector(sel) : null; }

  function button(label, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls || 'btn';
    b.textContent = label;
    return b;
  }

  // --- PENDING-BLOCKS TRAY ---

  function showTray(opts) {
    mount();
    if (q('.tray')) return;

    const tray = document.createElement('div');
    tray.className = 'tray';

    const header = document.createElement('div');
    header.className = 'head';
    header.textContent = 'Atomic Clipper — Pending';

    const hint = document.createElement('div');
    hint.className = 'tray-hint';
    hint.textContent = 'Hold Ctrl (⌘) · click/drag regions · release to save';

    const count = document.createElement('div');
    count.className = 'tray-count';
    count.textContent = '0 blocks';

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';

    const removeBtn = button('Remove last');
    removeBtn.addEventListener('click', () => opts.onRemoveLast());

    const cancelBtn = button('Cancel');
    cancelBtn.addEventListener('click', () => opts.onCancel());

    const saveBtn = button('Save (0)', 'btn btn--primary tray-save');
    saveBtn.addEventListener('click', () => opts.onSave());

    btnRow.appendChild(removeBtn);
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);

    tray.appendChild(header);
    tray.appendChild(hint);
    tray.appendChild(count);
    tray.appendChild(btnRow);
    root.appendChild(tray);
  }

  // Labels only. Removing the tray is hideTray's job and the state machine decides when (SR-23-07).
  function updateTray(count) {
    const tray = q('.tray');
    if (!tray) return;
    tray.querySelector('.tray-count').textContent =
      count + (count === 1 ? ' block' : ' blocks');
    tray.querySelector('.tray-save').textContent = 'Save (' + count + ')';
  }

  function hideTray() {
    const tray = q('.tray');
    if (tray) tray.remove();
  }

  // --- SIZE-CAP DECISION ROW (Sprint 21) ---
  // Non-blocking on Save: an asset the user never decides on is kept. The KB figure describes the
  // stored string, not the decoded image — hence "image data".
  function buildOversizedRow(url, sizeBytes, onDecision) {
    const row = document.createElement('div');
    row.className = 'oversized';

    const kb = Math.round(sizeBytes / 1024);
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `Oversized inline image, ${kb} KB`);

    const label = document.createElement('div');
    label.className = 'oversized-label';
    label.setAttribute('role', 'status'); // the usage figure arrives async — announce it
    label.textContent = `Inline image data · ${kb} KB`;
    row.appendChild(label);

    // The one chrome API call permitted in this module (spec §5). It renders a single string and
    // has no other consumer; every data operation stays in picker.js.
    chrome.runtime.sendMessage({ action: 'getStorageUsage' }, (usage) => {
      void chrome.runtime.lastError;
      if (!usage || typeof usage.quota !== 'number' || !usage.quota) return;
      const pct = Math.round((sizeBytes / usage.quota) * 100);
      label.textContent = `Inline image data · ${kb} KB — uses ${pct}% of your library space`;
    });

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row btn-row--start';

    const keepBtn = button('Keep');
    keepBtn.setAttribute('aria-label', `Keep the ${kb} KB inline image`);
    keepBtn.addEventListener('click', () => { onDecision('keep'); row.remove(); });

    const skipBtn = button('Skip');
    skipBtn.setAttribute('aria-label', `Skip the ${kb} KB inline image`);
    skipBtn.addEventListener('click', () => { onDecision('skip'); row.remove(); });

    btnRow.appendChild(keepBtn);
    btnRow.appendChild(skipBtn);
    row.appendChild(btnRow);
    return row;
  }

  // --- SAVE PANEL ---

  function showSavePanel(opts) {
    mount();

    const clipText = opts.text || '';
    const clipAssets = Array.isArray(opts.assets) ? opts.assets : [];
    const oversizedAssets = Array.isArray(opts.oversizedAssets) ? opts.oversizedAssets : [];
    const categories = Array.isArray(opts.categories) ? opts.categories : [];
    const skippedAssets = new Set();

    const panel = document.createElement('div');
    panel.className = 'panel';

    const header = document.createElement('div');
    header.className = 'head';
    header.textContent = (opts.blockCount && opts.blockCount > 1)
      ? 'Atomic Clipper — Save Clip (' + opts.blockCount + ' blocks)'
      : 'Atomic Clipper — Save Clip';

    // Preview
    const previewEl = document.createElement('div');
    previewEl.className = 'preview';
    const isImageOnly = !clipText.trim() && clipAssets.length > 0;
    if (isImageOnly) {
      const cap = document.createElement('div');
      cap.textContent = clipAssets.length === 1
        ? 'Image clip'
        : 'Image clip — ' + clipAssets.length + ' images';
      const thumb = document.createElement('img');
      // referrerPolicy BEFORE src: the published privacy policy asserts no-referrer on this
      // request path, so the ordering must not depend on microtask timing.
      thumb.referrerPolicy = 'no-referrer';
      thumb.alt = '';
      thumb.loading = 'lazy';
      thumb.addEventListener('error', () => thumb.remove()); // dead / hotlink-blocked URL
      thumb.src = clipAssets[0];
      previewEl.appendChild(cap);
      previewEl.appendChild(thumb);
    } else {
      previewEl.textContent = clipText.length > 200
        ? clipText.slice(0, 200) + '…'
        : clipText;
    }

    // Size-cap rows. Read lazily by focusRing(), so built before the ring is defined.
    let oversizedContainer = null;
    if (oversizedAssets.length) {
      oversizedContainer = document.createElement('div');
      for (const url of oversizedAssets) {
        oversizedContainer.appendChild(
          buildOversizedRow(url, url.length, (decision) => {
            if (decision === 'skip') skippedAssets.add(url);
          })
        );
      }
      // Delegated: rows come and go as they are decided, so per-button binding would go stale.
      oversizedContainer.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        e.preventDefault();
        stepFocus(e.target, e.shiftKey);
      });
    }

    const label = document.createElement('label');
    label.className = 'field-label';
    label.htmlFor = 'atomic-clipper-category-input';
    label.textContent = 'Category';

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'field-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'atomic-clipper-category-input';
    input.className = 'field';
    input.placeholder = 'e.g. AI Research';

    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown';

    function renderDropdown(items) {
      dropdown.innerHTML = ''; // clears only — never takes input (spec §6.4)
      if (!items.length) { dropdown.style.display = 'none'; return; }
      items.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.textContent = cat;  // tag values are user data — always assigned as text, never markup
        item.setAttribute('tabindex', '-1');
        item.addEventListener('mousedown', (e) => {
          e.preventDefault(); // stop input blur before the value is set
          input.value = cat;
          dropdown.style.display = 'none';
          saveBtn.focus();
        });
        dropdown.appendChild(item);
      });
      dropdown.style.display = 'block';
    }

    function filtered() {
      const val = input.value.trim().toLowerCase();
      return val ? categories.filter(c => c.toLowerCase().includes(val)) : categories;
    }

    let escPressed = false;

    input.addEventListener('focus', () => {
      if (escPressed) { escPressed = false; return; }
      renderDropdown(filtered());
    });

    input.addEventListener('input', () => renderDropdown(filtered()));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        dropdown.style.display = 'none';
        if (input.value.trim()) saveBtn.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (dropdown.style.display === 'none') renderDropdown(filtered());
        const items = dropdown.querySelectorAll('.dropdown-item');
        if (items.length > 0) items[0].focus();
      } else if (e.key === 'Escape') {
        if (dropdown.style.display !== 'none') {
          e.stopPropagation(); // don't let global Esc tear down while the dropdown is open
          dropdown.style.display = 'none';
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        dropdown.style.display = 'none';
        stepFocus(input, e.shiftKey);
      }
    });

    dropdown.addEventListener('keydown', (e) => {
      const items = [...dropdown.querySelectorAll('.dropdown-item')];
      // Must read focus from the shadow root, not from the document. At document level the focused
      // node inside a shadow tree reports as the HOST, so indexOf would return -1 and arrow
      // navigation would die silently — the list would still render and still take mouse clicks,
      // so nothing would look broken (AD-5).
      const idx = items.indexOf(root.activeElement);
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
          saveBtn.focus();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        escPressed = true; // stop the focus handler re-opening it
        dropdown.style.display = 'none';
        input.focus();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        dropdown.style.display = 'none';
        if (e.shiftKey) input.focus(); else cancelBtn.focus();
      }
    });

    inputWrapper.addEventListener('focusout', (e) => {
      if (!inputWrapper.contains(e.relatedTarget)) dropdown.style.display = 'none';
    });

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(dropdown);

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row btn-row--pad';

    const cancelBtn = button('Cancel', 'btn btn--wide');
    const saveBtn = button('Save', 'btn btn--primary btn--wide');
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

    cancelBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); stepFocus(cancelBtn, e.shiftKey); }
    });
    saveBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); stepFocus(saveBtn, e.shiftKey); }
    });

    panel.appendChild(header);
    panel.appendChild(previewEl);
    if (oversizedContainer) panel.appendChild(oversizedContainer);
    panel.appendChild(label);
    panel.appendChild(inputWrapper);
    panel.appendChild(btnRow);

    root.appendChild(panel);
    setTimeout(() => input.focus(), 50);

    saveBtn.addEventListener('click', () => {
      const category = input.value.trim() || 'Uncategorized';
      const finalAssets = clipAssets.filter(u => !skippedAssets.has(u));
      opts.onSave(category, finalAssets);
    });

    cancelBtn.addEventListener('click', () => opts.onCancel());
  }

  // --- SELECTION FALLBACK HINT ---
  // Two lines in both branches (ENH-21-01): the message, then how to get out. `hadDroppedAssets`
  // distinguishes "nothing here" from "the only thing here was a filtered-out image" — telling the
  // latter user to select text points them at something that was never going to produce a clip.
  function showSelectHint(hadDroppedAssets) {
    mount();
    if (q('.hint')) return;

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.setAttribute('role', 'status'); // polite live region

    const line1 = document.createElement('div');
    line1.textContent = hadDroppedAssets
      ? "This image can’t be clipped"
      : "Couldn’t extract — select text to clip";

    const line2 = document.createElement('div');
    line2.className = 'hint-esc';
    line2.textContent = 'Esc to cancel';

    hint.appendChild(line1);
    hint.appendChild(line2);
    root.appendChild(hint);
  }

  function hideSelectHint() {
    const hint = q('.hint');
    if (hint) hint.remove();
  }

  // --- TOASTS ---
  // Own host, because both callers fire *after* cleanup() has unmounted the picker host (AD-3):
  // the save handler and the SPA navigation guard both tear down first, then report.
  function showToast(message, variant) {
    if (!document.getElementById(TOAST_HOST_ID)) {
      toastRoot = makeHost(TOAST_HOST_ID);
    }
    if (!toastRoot) return;

    const toast = document.createElement('div');
    toast.className = variant === 'nav' ? 'toast toast--nav' : 'toast';
    toast.textContent = message;
    toastRoot.appendChild(toast);

    const hold = variant === 'nav' ? 2000 : 1500;
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.remove();
        // Last toast gone → drop the host too, so the page is left exactly as found.
        if (toastRoot && !toastRoot.querySelector('.toast')) {
          const host = document.getElementById(TOAST_HOST_ID);
          if (host) host.remove();
          toastRoot = null;
        }
      }, 400);
    }, hold);
  }

  window._atomicClipper = window._atomicClipper || {};
  window._atomicClipper.ui = {
    mount,
    unmount,
    isOwnHost,
    showTray,
    updateTray,
    hideTray,
    showSavePanel,
    showSelectHint,
    hideSelectHint,
    showToast
  };
})();
