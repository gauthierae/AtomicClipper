function getDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function formatDate(isoString) {
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// A newline in the title would insert a literal line break into the exported Markdown, and if the
// injected content starts with `#` it renders as a spurious heading. Collapsing to a single line closes
// the vector at its root — a leading `#` on the *same* line as the `##` prefix is inert (ENH-20-01).
function sanitizeTitle(title) {
  return String(title).replace(/[\r\n]+/g, ' ').trim();
}

// SVG is the one image type that can carry script. It is inert everywhere the extension displays it
// (img.src), so it stays captured and displayed; the risk is the exported .md reaching renderers we
// do not control (Obsidian, NotebookLM), which is where it gets omitted.
function isSvgDataUri(url) {
  return /^data:image\/svg\+xml/i.test(url);
}

// `)` breaks out of ![]() mid-line; a newline breaks out to a new Markdown block — same threat class
// as the title fix (ENH-20-01). This also guards clips already in storage from before the Sprint 21
// scheme filter existed.
//
// `(` is escaped for the same reason as `)`, and leaving it out was the hole in the original version
// of this function. Encoding only `)` leaves an unbalanced `(` in the destination; CommonMark then
// abandons the image, emits it as literal text, and parses an attacker's `![](…)` out of that text
// as a real image — a tracking pixel in the user's vault. Verified against a CommonMark renderer.
// A legitimate URL with balanced parens (Wikipedia titles) still resolves; it only looks encoded.
const ASSET_URL_ESCAPES = {
  '(': '%28', ')': '%29', '[': '%5B', ']': '%5D', '<': '%3C', '>': '%3E', ' ': '%20'
};

function sanitizeAssetUrl(url) {
  return String(url)
    .replace(/[\r\n]+/g, '')
    .replace(/[()[\]<> ]/g, c => ASSET_URL_ESCAPES[c]);
}

// Only http(s) URLs are safe to use as a clickable href in the privileged
// library page (a javascript: asset URL would execute in the extension origin).
export function isHttpUrl(url) {
  try {
    const proto = new URL(url).protocol;
    return proto === 'http:' || proto === 'https:';
  } catch {
    return false;
  }
}

// Every YAML scalar goes through this. An unquoted tag containing `:`, `,`, `[` or `#` either fails to
// parse or silently parses as something else — and this frontmatter lands in the user's vault, so a
// malformed block is corruption at the destination, not a cosmetic flaw.
function yamlEscape(value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ') + '"';
}

function clipTags(clip) {
  return Array.isArray(clip.tags) ? clip.tags.filter(t => typeof t === 'string' && t) : [];
}

// Non-null bibliographic fields joined for display. Empty until Sprint E fills them, so the caller
// omits the line entirely rather than printing an empty one.
function referenceLine(clip) {
  const r = clip.reference;
  if (!r || typeof r !== 'object') return '';
  return [r.author, r.publication, r.publishDate].filter(Boolean).join(' · ');
}

export function formatClipBlock(clip) {
  const title = sanitizeTitle(clip.title || getDomain(clip.url));
  const lines = [
    `## ${title}`,
    `*Saved: ${formatDate(clip.scrapedAt)}*`,
    `[Source](${clip.url})`,
  ];
  const tags = clipTags(clip);
  if (tags.length) lines.push(`*Tags: ${tags.join(', ')}*`);
  const ref = referenceLine(clip);
  if (ref) lines.push(`*${ref}*`);
  lines.push('', clip.text ?? '');
  const assets = assetLines(clip);
  if (assets.length) lines.push('', ...assets); // blank-line separator before the image block
  return lines.join('\n');
}

// Asset lines for a clip — shared by formatClipBlock and formatClipDocument.
function assetLines(clip) {
  const assets = Array.isArray(clip.assets) ? clip.assets : [];
  const unavailable = new Set(Array.isArray(clip.unavailableAssets) ? clip.unavailableAssets : []);
  const lines = [];
  for (const url of assets) {
    if (isSvgDataUri(url)) {
      lines.push('_(inline SVG image — not exported)_');
      continue;
    }
    // Keyed on the raw url — unavailableAssets was populated at capture time, pre-sanitization.
    const suffix = unavailable.has(url) ? ' _(image unavailable at capture)_' : '';
    lines.push(`![](${sanitizeAssetUrl(url)})${suffix}`);
  }
  return lines;
}

// One clip as one vault note. Used by Copy MD — the path where a clip becomes a standalone Markdown
// file — so this is where "every clip carries structured bibliographic frontmatter" becomes true in
// the output. Multi-clip exports cannot use it: per-clip YAML inside one document is not frontmatter.
export function formatClipDocument(clip) {
  const r = (clip.reference && typeof clip.reference === 'object') ? clip.reference : {};
  const tags = clipTags(clip);

  const fm = ['---'];
  fm.push(`title: ${yamlEscape(clip.title || getDomain(clip.url))}`);
  fm.push(`source: ${yamlEscape(clip.url ?? '')}`);
  if (tags.length) fm.push(`tags: [${tags.map(yamlEscape).join(', ')}]`);
  if (clip.scrapedAt) fm.push(`saved: ${yamlEscape(clip.scrapedAt)}`);
  if (r.author) fm.push(`author: ${yamlEscape(r.author)}`);
  if (r.publication) fm.push(`publication: ${yamlEscape(r.publication)}`);
  if (r.publishDate) fm.push(`published: ${yamlEscape(r.publishDate)}`);
  fm.push('---', '');

  const body = [`# ${sanitizeTitle(clip.title || getDomain(clip.url))}`, '', clip.text ?? ''];
  const assets = assetLines(clip);
  if (assets.length) body.push('', ...assets);
  return fm.concat(body).join('\n');
}

export function generateMarkdown(category, clips) {
  // Document-level frontmatter. Once it has opened and closed at the top of the file, the `---`
  // separators between clips below are ordinary thematic breaks — unambiguous to CommonMark.
  const parts = [
    '---',
    `tag: ${yamlEscape(category)}`,
    `exported: ${new Date().toISOString().slice(0, 10)}`,
    `clips: ${clips.length}`,
    '---',
    '',
    `# ${category}`,
    ''
  ];
  for (const clip of clips) {
    parts.push('---', '', formatClipBlock(clip), '');
  }
  parts.push('---');
  return parts.join('\n');
}

export function sanitizeFilename(name) {
  return name.replace(/[/\\:*?"<>|]/g, '-').trim() || 'export';
}
