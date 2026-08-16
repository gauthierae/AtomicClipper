(function () {
  'use strict';

  function buildExtractor() {
    const assets = [];
    let droppedCount = 0;

    function resolveUrl(raw) {
      if (!raw || !raw.trim()) return '';
      try { return new URL(raw.trim(), document.baseURI).href; }
      catch (_) { return raw.trim(); }   // best-effort: keep raw if unparseable
    }

    function firstSrcsetUrl(srcset) {
      // "a.jpg 1x, b.jpg 2x" | "a.jpg 320w, b.jpg 640w" → first candidate URL
      return (srcset || '').split(',')[0].trim().split(/\s+/)[0] || '';
    }

    // Only http(s) and data:image/* may enter assets[] — javascript:/blob:/non-image data: are
    // dropped. No execution path exists via img.src today; this is the guard the redesign was going
    // to need anyway (decisions.md 2026-07-19), moved up because this sprint already rewrites
    // pushAsset. Unparseable → drop, not keep: fail closed on a string the page fully controls.
    function isAllowedAssetUrl(url) {
      try {
        const u = new URL(url);
        if (u.protocol === 'http:' || u.protocol === 'https:') return true;
        if (u.protocol === 'data:') return /^data:image\//i.test(url);
        return false;
      } catch (_) {
        return false;
      }
    }

    // Only these may become a Markdown link target. A `javascript:` href is inert everywhere the
    // extension displays a clip (library assigns text with textContent), so the risk is the exported
    // .md reaching renderers we do not control — the same reasoning that omits SVG at the export
    // boundary in markdown.js.
    const LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

    const LINK_URL_ESCAPES = {
      '(': '%28', ')': '%29', '[': '%5B', ']': '%5D', '<': '%3C', '>': '%3E', ' ': '%20'
    };

    function isAllowedLinkUrl(url) {
      try {
        return LINK_SCHEMES.has(new URL(url).protocol);
      } catch (_) {
        return false;
      }
    }

    // A page-controlled href can otherwise inject arbitrary Markdown into the export, and a remote
    // `![]()` smuggled in that way becomes a tracking pixel the moment the note opens in the user's
    // vault. Same threat class as ENH-20-01 (title) and the Sprint 21 asset-URL fix.
    //
    // `(` matters as much as `)`, which is the part that is easy to get wrong. Encoding only `)`
    // leaves an unbalanced `(` in the destination; CommonMark then abandons the link, emits it as
    // literal text, and parses the attacker's `![](…)` out of that text as a real image. Escaping
    // both keeps the whole payload inside one destination, where it renders as an inert link.
    // Verified against a CommonMark renderer, not by string comparison — see LINK_URL_ESCAPES users.
    function sanitizeLinkUrl(url) {
      return url.replace(/[\r\n]+/g, '').replace(/[()[\]<> ]/g, c => LINK_URL_ESCAPES[c]);
    }

    // `]` closes the label early and lets the rest of it escape into document context. Backslash is
    // the CommonMark escape, so a legitimate label like "[PDF] Report" still renders as written.
    function sanitizeLinkLabel(label) {
      return label.replace(/[[\]]/g, '\\$&');
    }

    function pushAsset(url) {
      const resolved = resolveUrl(url);
      if (!resolved) return;                          // empty candidate — nothing to count
      if (!isAllowedAssetUrl(resolved)) { droppedCount++; return; }
      if (!assets.includes(resolved)) assets.push(resolved); // absolutize + dedup
    }

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent;
        if (!t.trim()) return '';        // discard whitespace-only nodes
        return t.replace(/\s+/g, ' '); // collapse multi-space runs
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tag = node.tagName.toLowerCase();

      switch (tag) {
        case 'h1':
          return '# ' + node.innerText.trim() + '\n';
        case 'h2':
          return '## ' + node.innerText.trim() + '\n';
        case 'h3':
          return '### ' + node.innerText.trim() + '\n';
        case 'h4':
        case 'h5':
        case 'h6':
          return '#### ' + node.innerText.trim() + '\n';

        case 'br':
          return '\n';

        case 'img': {
          const candidate =
            node.getAttribute('data-src') ||
            node.getAttribute('data-original') ||
            node.getAttribute('data-lazy') ||
            firstSrcsetUrl(node.getAttribute('srcset')) ||
            node.getAttribute('src') ||
            node.src;
          pushAsset(candidate);
          return '';
        }
        case 'video':
          pushAsset(node.getAttribute('src') || node.src);
          return '';
        case 'source':
          pushAsset(firstSrcsetUrl(node.getAttribute('srcset')) || node.getAttribute('src'));
          return '';

        // Non-content elements: skip entirely so the recursing `default` case
        // below never leaks raw JS/CSS source into the clip text.
        case 'script':
        case 'style':
        case 'noscript':
        case 'template':
          return '';

        case 'ul': {
          const items = Array.from(node.children).filter(
            c => c.tagName.toLowerCase() === 'li'
          );
          return items.map(li => '- ' + walk(li).trim()).join('\n') + '\n';
        }
        case 'ol': {
          const items = Array.from(node.children).filter(
            c => c.tagName.toLowerCase() === 'li'
          );
          let n = 1;
          return items.map(li => n++ + '. ' + walk(li).trim()).join('\n') + '\n';
        }
        case 'li':
          return Array.from(node.childNodes).map(walk).join('');

        case 'a': {
          // Recurse children (not innerText) so a nested <img> reaches assets[]
          // instead of being silently dropped by the link short-circuit.
          const label = sanitizeLinkLabel(Array.from(node.childNodes).map(walk).join('').trim());
          const href = resolveUrl(node.getAttribute('href'));
          // Fail closed, and degrade to the label rather than dropping it: the clip keeps the words
          // the reader saw on the page, minus a target we cannot vouch for.
          if (!isAllowedLinkUrl(href)) return label;
          return '[' + label + '](' + sanitizeLinkUrl(href) + ')';
        }

        case 'strong':
        case 'b':
          return '**' + node.innerText.trim() + '**';
        case 'em':
        case 'i':
          return '*' + node.innerText.trim() + '*';

        case 'code':
          return '`' + node.innerText.trim() + '`';
        case 'pre':
          return '```\n' + node.innerText.trim() + '\n```';

        case 'p':
        case 'div':
        case 'section':
        case 'article':
          return Array.from(node.childNodes).map(walk).join('') + '\n\n';

        default:
          return Array.from(node.childNodes).map(walk).join('');
      }
    }

    // Getter, not a destructured primitive: pushAsset mutates droppedCount during walk(), which
    // runs after buildExtractor() returns — a copied number would freeze at 0.
    return { walk, assets, getDroppedCount: () => droppedCount };
  }

  function extract(element) {
    const { walk, assets, getDroppedCount } = buildExtractor();
    const text = walk(element).trim();
    const droppedCount = getDroppedCount();
    return text.length >= 10
      ? { text, assets, droppedCount }
      : { text: element.innerText.trim(), assets, droppedCount };
  }

  // Entry point for drag-selected ranges: walks a DocumentFragment's childNodes
  function extractFragment(fragment) {
    const { walk, assets, getDroppedCount } = buildExtractor();
    const text = Array.from(fragment.childNodes).map(walk).join('').trim();
    const droppedCount = getDroppedCount();
    return text.length >= 10
      ? { text, assets, droppedCount }
      : { text: '', assets, droppedCount };
  }

  window._atomicClipperExtract = extract;
  window._atomicClipperExtractFragment = extractFragment;
})();
