function getDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function formatDate(isoString) {
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function generateMarkdown(category, clips) {
  const lines = [`# ${category}`, ''];
  for (const clip of clips) {
    const title = clip.title || getDomain(clip.url);
    lines.push('---', '');
    lines.push(`## ${title}`);
    lines.push(`*Saved: ${formatDate(clip.scrapedAt)}*`);
    lines.push(`[Source](${clip.url})`, '');
    lines.push(clip.text, '');
  }
  lines.push('---');
  return lines.join('\n');
}

export function sanitizeFilename(name) {
  return name.replace(/[/\\:*?"<>|]/g, '-').trim() || 'export';
}
