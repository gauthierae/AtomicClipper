export async function saveClip(clip) {
  const { clips = [] } = await chrome.storage.local.get('clips');
  clips.push(clip);
  await chrome.storage.local.set({ clips });
}

export async function getAllClips() {
  const { clips = [] } = await chrome.storage.local.get('clips');
  return clips;
}

export async function deleteClip(id) {
  const { clips = [] } = await chrome.storage.local.get('clips');
  await chrome.storage.local.set({ clips: clips.filter(c => c.id !== id) });
}

export async function getCategories() {
  const clips = await getAllClips();
  return [...new Set(clips.map(c => c.category).filter(Boolean))].sort();
}

export async function getClipByUrl(url) {
  const clips = await getAllClips();
  const normalized = normalizeUrl(url);
  return clips.find(c => normalizeUrl(c.url) === normalized) ?? null;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}
