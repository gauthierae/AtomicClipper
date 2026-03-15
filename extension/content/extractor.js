(function () {
  'use strict';

  function extract(element) {
    const assets = [];

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent;
        if (!t.trim()) return '';        // discard whitespace-only nodes (indentation between block elements)
        return t.replace(/\s+/g, ' '); // preserve word-boundary spaces; collapse multi-space runs
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

        case 'img':
          if (node.src) assets.push(node.src);
          return '';
        case 'video':
          if (node.src) assets.push(node.src);
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
          return '[' + node.innerText.trim() + '](' + href + ')';
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
          return node.innerText || '';
      }
    }

    const text = walk(element).trim();
    return text.length >= 10
      ? { text, assets }
      : { text: element.innerText.trim(), assets };
  }

  window._atomicClipperExtract = extract;
})();
