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

  function onMouseover(e) {
    if (state !== 'PICKING') return;
    if (isOwnElement(e.target)) return;

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
    if (isOwnElement(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    // Freeze highlight
    document.removeEventListener('mouseover', onMouseover);

    // Extract content from selected element
    const selected = currentHighlight || e.target;
    const extracted = window._atomicClipperExtract(selected);

    // Capture page metadata
    const clipUrl = window.location.href;
    const clipTitle = document.title;

    // Remove visual highlight
    if (currentHighlight) {
      currentHighlight.classList.remove('atomic-clipper-highlight');
      currentHighlight = null;
    }

    if (!extracted.text.trim()) {
      // Empty extraction → SELECTING state: let user select text manually
      state = 'SELECTING';
      selectingUrl = clipUrl;
      selectingTitle = clipTitle;
      document.body.style.cursor = '';
      document.removeEventListener('click', onClick, true);
      document.addEventListener('mouseup', onMouseup);
      showSelectHint();
      return;
    }

    // Non-empty extraction → normal save flow
    state = 'SELECTED';
    document.body.style.cursor = '';
    showSavePanel(extracted.text, extracted.assets, clipUrl, clipTitle);
  }

  document.addEventListener('click', onClick, true);

  // --- MOUSEUP FOR TEXT SELECTION (SELECTING state only) ---

  function onMouseup() {
    if (state !== 'SELECTING') return;
    const sel = window.getSelection().toString().trim();
    if (!sel) return; // empty selection — wait for next mouseup
    document.removeEventListener('mouseup', onMouseup);
    const hint = document.getElementById('atomic-clipper-select-hint');
    if (hint) hint.remove();
    showSavePanel(sel, [], selectingUrl, selectingTitle);
  }

  // --- INLINE SAVE PANEL ---

  function showSavePanel(clipText, clipAssets, clipUrl, clipTitle) {
    state = 'SAVING';

    // Fetch existing categories for datalist
    chrome.runtime.sendMessage({ action: 'getCategories' }, (categories) => {
      // Suppress "no handler" error (Sprint 7 — handler added in Sprint 8)
      void chrome.runtime.lastError;
      if (cleaned) return;

      if (!Array.isArray(categories)) categories = [];

      const preview = clipText.length > 200
        ? clipText.slice(0, 200) + '\u2026'
        : clipText;

      const panel = document.createElement('div');
      panel.id = 'atomic-clipper-panel';

      // Header
      const header = document.createElement('div');
      header.style.cssText = 'font-weight:700;margin-bottom:8px;color:#0a66c2;font-size:14px;';
      header.textContent = 'Atomic Clipper \u2014 Save Clip';

      // Preview
      const previewEl = document.createElement('div');
      previewEl.style.cssText =
        'font-size:12px;color:#555;margin-bottom:12px;' +
        'max-height:60px;overflow:hidden;line-height:1.4;' +
        'white-space:pre-wrap;word-break:break-word;';
      previewEl.textContent = preview;

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

      // Focus trap: Tab cycles input → Cancel → Save → input
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          dropdown.style.display = 'none';
          if (e.shiftKey) saveBtn.focus(); else cancelBtn.focus();
        }
      });
      cancelBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          if (e.shiftKey) input.focus(); else saveBtn.focus();
        }
      });
      saveBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          if (e.shiftKey) cancelBtn.focus(); else input.focus();
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
      panel.appendChild(label);
      panel.appendChild(inputWrapper);
      panel.appendChild(btnRow);

      document.body.appendChild(panel);
      setTimeout(() => input.focus(), 50);

      // --- SAVE ---
      saveBtn.addEventListener('click', () => {
        const category = input.value.trim() || 'Uncategorized';
        const clip = {
          id: crypto.randomUUID(),
          url: clipUrl,
          title: clipTitle,
          text: clipText,
          assets: clipAssets,
          category,
          scrapedAt: new Date().toISOString()
        };

        chrome.runtime.sendMessage({ action: 'saveClip', data: clip }, (response) => {
          void chrome.runtime.lastError;
          cleanup();
          if (response?.ok === false) {
            showToast('Could not save \u2014 storage may be full.');
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
  function showSelectHint() {
    const hint = document.createElement('div');
    hint.id = 'atomic-clipper-select-hint';
    hint.setAttribute('role', 'status'); // announces to screen readers (polite live region)
    hint.textContent = "Couldn\u2019t extract \u2014 select text to clip";
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
