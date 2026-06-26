function getDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function formatDate(isoString) {
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

export function formatClipBlock(clip) {
  const title = clip.title || getDomain(clip.url);
  const lines = [
    `## ${title}`,
    `*Saved: ${formatDate(clip.scrapedAt)}*`,
    `[Source](${clip.url})`,
    '',
    clip.text ?? '',
  ];
  const assets = Array.isArray(clip.assets) ? clip.assets : [];
  if (assets.length) {
    lines.push(''); // blank-line separator before the image block
    for (const url of assets) lines.push(`![](${url})`);
  }
  return lines.join('\n');
}

export function generateMarkdown(category, clips) {
  const parts = [`# ${category}`, ''];
  for (const clip of clips) {
    parts.push('---', '', formatClipBlock(clip), '');
  }
  parts.push('---');
  return parts.join('\n');
}

export function sanitizeFilename(name) {
  return name.replace(/[/\\:*?"<>|]/g, '-').trim() || 'export';
}
