import { getAllClips, deleteClip } from '../shared/storage.js';
import { generateMarkdown, sanitizeFilename } from '../shared/markdown.js';

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function formatDate(isoString) {
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function downloadMarkdown(category, clips) {
  const content = generateMarkdown(category, clips);
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilename(category) + '.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildClipEl(clip, catClips) {
  const article = document.createElement('article');
  article.className = 'clip-item';

  // Header: title + delete button
  const header = document.createElement('div');
  header.className = 'clip-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'clip-title';
  titleEl.textContent = clip.title || getDomain(clip.url);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = 'Delete';

  header.appendChild(titleEl);
  header.appendChild(deleteBtn);

  // Meta: saved date + domain
  const metaEl = document.createElement('div');
  metaEl.className = 'clip-meta';
  metaEl.textContent = `Saved: ${formatDate(clip.scrapedAt)} · ${getDomain(clip.url)}`;

  // Category badge
  const badgeEl = document.createElement('span');
  badgeEl.className = 'category-badge';
  badgeEl.textContent = clip.category || 'Uncategorized';

  // Excerpt — null-safe: corrupted clip with text: null renders blank rather than crashing
  const text = clip.text ?? '';
  const excerpt = text.length > 150 ? text.slice(0, 150) + '…' : text;
  const excerptEl = document.createElement('p');
  excerptEl.className = 'clip-excerpt';
  excerptEl.textContent = excerpt;

  // Full text (hidden by default)
  const fullEl = document.createElement('p');
  fullEl.className = 'clip-full';
  fullEl.hidden = true;
  fullEl.textContent = text;

  // Actions
  const actionsEl = document.createElement('div');
  actionsEl.className = 'clip-actions';

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'toggle-btn';
  toggleBtn.textContent = 'Show full text';

  actionsEl.appendChild(toggleBtn);

  // Source link (hidden by default — shown only in expanded view)
  const sourceLink = document.createElement('a');
  sourceLink.className = 'source-link';
  sourceLink.href = clip.url;
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener';
  sourceLink.textContent = getDomain(clip.url);
  sourceLink.hidden = true;

  article.appendChild(header);
  article.appendChild(metaEl);
  article.appendChild(badgeEl);
  article.appendChild(excerptEl);
  article.appendChild(fullEl);
  article.appendChild(actionsEl);
  article.appendChild(sourceLink);

  // Toggle event
  toggleBtn.addEventListener('click', () => {
    const expanded = !fullEl.hidden;
    if (expanded) {
      // Collapse
      excerptEl.hidden = false;
      fullEl.hidden = true;
      sourceLink.hidden = true;
      toggleBtn.textContent = 'Show full text';
    } else {
      // Expand
      excerptEl.hidden = true;
      fullEl.hidden = false;
      sourceLink.hidden = false;
      toggleBtn.textContent = 'Hide full text';
    }
  });

  // Delete event
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Delete this clip?')) return;
    try {
      await deleteClip(clip.id);
    } catch (err) {
      console.error(err);
      alert('Failed to delete clip. Please try again.');
      return;
    }
    const idx = catClips.indexOf(clip);
    if (idx !== -1) catClips.splice(idx, 1);
    const section = article.closest('.category-section');
    article.remove();
    if (section && section.querySelectorAll('.clip-item').length === 0) {
      section.remove();
    }
    if (document.querySelectorAll('.clip-item').length === 0) {
      document.getElementById('empty-msg').hidden = false;
    }
  });

  return article;
}

async function render() {
  const library = document.getElementById('library');
  const emptyMsg = document.getElementById('empty-msg');
  const clips = await getAllClips();

  if (clips.length === 0) {
    emptyMsg.hidden = false;
    return;
  }

  // Group by category
  const groups = {};
  for (const clip of clips) {
    const cat = clip.category || 'Uncategorized';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(clip);
  }

  // Categories alphabetically; clips newest-first within each category
  for (const cat of Object.keys(groups).sort()) {
    const catClips = groups[cat].sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));

    const section = document.createElement('section');
    section.className = 'category-section';

    const catHeader = document.createElement('div');
    catHeader.className = 'category-header';

    const h2 = document.createElement('h2');
    h2.textContent = cat;

    const exportBtn = document.createElement('button');
    exportBtn.className = 'export-btn';
    exportBtn.textContent = 'Export .md';
    exportBtn.addEventListener('click', () => downloadMarkdown(cat, catClips));

    catHeader.appendChild(h2);
    catHeader.appendChild(exportBtn);
    section.appendChild(catHeader);

    for (const clip of catClips) {
      section.appendChild(buildClipEl(clip, catClips));
    }

    library.appendChild(section);
  }

  // Storage quota check — non-fatal; show warning if ≥ 80%
  try {
    const bytesUsed = await chrome.storage.local.getBytesInUse(null);
    const quota = chrome.storage.local.QUOTA_BYTES || 10485760;
    const pct = Math.round((bytesUsed / quota) * 100);
    if (pct >= 80) {
      document.getElementById('storage-pct').textContent = pct;
      document.getElementById('storage-warning').hidden = false;
    }
  } catch {
    // Non-fatal — storage meter is best-effort
  }
}

render().catch(err => {
  console.error(err);
  const emptyMsg = document.getElementById('empty-msg');
  emptyMsg.textContent = 'Failed to load library. Please try again.';
  emptyMsg.hidden = false;
});
