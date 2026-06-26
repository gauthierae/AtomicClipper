(function () {
  'use strict';

  function buildExtractor() {
    const assets = [];

    function resolveUrl(raw) {
      if (!raw || !raw.trim()) return '';
      try { return new URL(raw.trim(), document.baseURI).href; }
      catch (_) { return raw.trim(); }   // best-effort: keep raw if unparseable
    }

    function firstSrcsetUrl(srcset) {
      // "a.jpg 1x, b.jpg 2x" | "a.jpg 320w, b.jpg 640w" → first candidate URL
      return (srcset || '').split(',')[0].trim().split(/\s+/)[0] || '';
    }

    function pushAsset(url) {
      const resolved = resolveUrl(url);
      if (resolved && !assets.includes(resolved)) assets.push(resolved); // absolutize + dedup
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
          const href = node.getAttribute('href') || '';
          // Recurse children (not innerText) so a nested <img> reaches assets[]
          // instead of being silently dropped by the link short-circuit.
          const label = Array.from(node.childNodes).map(walk).join('').trim();
          return '[' + label + '](' + href + ')';
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

    return { walk, assets };
  }

  function extract(element) {
    const { walk, assets } = buildExtractor();
    const text = walk(element).trim();
    return text.length >= 10 ? { text, assets } : { text: element.innerText.trim(), assets };
  }

  // Entry point for drag-selected ranges: walks a DocumentFragment's childNodes
  function extractFragment(fragment) {
    const { walk, assets } = buildExtractor();
    const text = Array.from(fragment.childNodes).map(walk).join('').trim();
    return text.length >= 10 ? { text, assets } : { text: '', assets };
  }

  window._atomicClipperExtract = extract;
  window._atomicClipperExtractFragment = extractFragment;
})();
