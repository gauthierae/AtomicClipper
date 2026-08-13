export const SCHEMA_VERSION = 3;
export const CLIP_KEY_PREFIX = 'clip:';

const LEGACY_KEY = 'clips';
const MIGRATION_BATCH_SIZE = 25;

function isClipObject(v) {
  return !!v && typeof v === 'object' && typeof v.id === 'string';
}

// Two legacy clip shapes exist in the wild: shipped 2.2.1 wrote seven fields, and builds from Sprint
// 20 on also carry `unavailableAssets`. Both pass through here. Idempotent on an already-v3 object.
function toV3(clip, index) {
  // Deterministic, not random: a random fallback would mint a new key on every run and duplicate the
  // clip instead of converging. The source array is not mutated until the migration's final step, so
  // `index` is stable across retries.
  const id = (typeof clip.id === 'string' && clip.id.trim())
    ? clip.id
    : `legacy-${index}-${clip.scrapedAt ?? 'unknown'}`;

  const category = typeof clip.category === 'string' ? clip.category.trim() : '';

  return {
    id,
    url: clip.url ?? '',
    title: clip.title ?? '',
    text: clip.text ?? '',
    assets: Array.isArray(clip.assets) ? clip.assets : [],
    unavailableAssets: Array.isArray(clip.unavailableAssets) ? clip.unavailableAssets : [],
    scrapedAt: clip.scrapedAt ?? '',
    tags: Array.isArray(clip.tags) ? clip.tags : (category ? [category] : []),
    reference: clip.reference ?? {
      author: null,
      title: null,
      publication: null,
      publishDate: null,
      sourceUrl: clip.url ?? '',
      accessDate: clip.scrapedAt ?? ''
    },
    provenance: Array.isArray(clip.provenance) ? clip.provenance : []
  };
}

export async function saveClip(clip) {
  await chrome.storage.local.set({ [CLIP_KEY_PREFIX + clip.id]: clip });
}

export async function getAllClips() {
  const all = await chrome.storage.local.get(null);
  const clips = Object.entries(all)
    .filter(([k]) => k.startsWith(CLIP_KEY_PREFIX))
    .map(([, v]) => v)
    .filter(isClipObject);

  // Fallback for the window before migration succeeds — including the case where it failed outright.
  // Without this the library renders empty beside a banner promising the clips are safe, which reads
  // as data loss however the banner is worded. Normalized in memory only; never written back.
  if (clips.length === 0 && Array.isArray(all[LEGACY_KEY])) {
    return all[LEGACY_KEY].filter(c => c && typeof c === 'object').map(toV3);
  }
  return clips;
}

export async function deleteClip(id) {
  await chrome.storage.local.remove(CLIP_KEY_PREFIX + id);

  // Also delete from the legacy array when one is still present — i.e. when the migration has not
  // succeeded and getAllClips is serving the fallback. Without this, delete silently no-ops in exactly
  // the state where the user most needs it: a migration that failed on quota can only be unblocked by
  // freeing space, and this is the lever that does it. Deliberately the one remaining legacy write.
  const { [LEGACY_KEY]: legacy } = await chrome.storage.local.get(LEGACY_KEY);
  if (Array.isArray(legacy)) {
    await chrome.storage.local.set({ [LEGACY_KEY]: legacy.filter(c => c && c.id !== id) });
  }
}

export async function getTags() {
  const clips = await getAllClips();
  const seen = new Set();
  for (const clip of clips) {
    if (!Array.isArray(clip.tags)) continue;
    for (const tag of clip.tags) if (typeof tag === 'string' && tag) seen.add(tag);
  }
  return [...seen].sort();
}

export async function migrateIfNeeded() {
  const { schemaVersion, [LEGACY_KEY]: legacy } =
    await chrome.storage.local.get(['schemaVersion', LEGACY_KEY]);

  if (schemaVersion === SCHEMA_VERSION) {
    // Sweep a legacy key stranded by a crash between the stamp and the drop.
    if (legacy !== undefined) await chrome.storage.local.remove(LEGACY_KEY);
    return { migrated: false, count: 0 };
  }

  if (legacy === undefined) {                       // fresh install
    await chrome.storage.local.set({ schemaVersion: SCHEMA_VERSION });
    return { migrated: false, count: 0 };
  }

  if (!Array.isArray(legacy)) {
    throw new Error('legacy `clips` key is not an array');
  }

  // Write every clip before stamping, and stamp before dropping the legacy key. A crash mid-batch
  // leaves `clips` intact and rewrites the same keys from the same ids on retry, so the migration
  // converges rather than duplicating.
  for (let i = 0; i < legacy.length; i += MIGRATION_BATCH_SIZE) {
    const batch = {};
    legacy.slice(i, i + MIGRATION_BATCH_SIZE).forEach((clip, n) => {
      if (!clip || typeof clip !== 'object') return;
      const v3 = toV3(clip, i + n);
      batch[CLIP_KEY_PREFIX + v3.id] = v3;
    });
    if (Object.keys(batch).length) await chrome.storage.local.set(batch);
  }

  await chrome.storage.local.set({ schemaVersion: SCHEMA_VERSION });
  await chrome.storage.local.remove(LEGACY_KEY);
  return { migrated: true, count: legacy.length };
}
