import type { NoteMeta } from './types';
import { extractWikiTargets } from './wikiLink';

/**
 * Per-session backlinks cache. Keyed by noteId, stores the list of `[[Target]]`
 * titles found in that note's body. Populated lazily as the right-panel asks
 * for backlinks; entries are invalidated by `updatedAt` on each lookup.
 */
type Entry = { updatedAt: number; targets: string[] };
const cache = new Map<string, Entry>();

/** Clear the whole cache — call on import/restore operations. */
export function resetBacklinkCache() {
  cache.clear();
}

/** Drop a single note from the cache. */
export function invalidateBacklink(noteId: string) {
  cache.delete(noteId);
}

async function loadTargets(meta: NoteMeta): Promise<string[]> {
  const cached = cache.get(meta.id);
  if (cached && cached.updatedAt === meta.updatedAt) return cached.targets;
  const note = await window.nv.getNote(meta.id);
  // text may be empty for encrypted notes; fall back to scanning the JSON
  // content as a string (literal `[[Foo]]` survives JSON.stringify intact).
  const haystack = note?.text || note?.content || '';
  const targets = extractWikiTargets(haystack);
  cache.set(meta.id, { updatedAt: meta.updatedAt, targets });
  return targets;
}

/**
 * Find every note that links to `targetTitle` via `[[…]]`. Skips trashed
 * notes and the note itself. Returns metas in the same order as the index.
 *
 * The scan is incremental: cached entries are returned immediately; only
 * stale or unseen notes hit the disk. Callers can pass an `onProgress`
 * callback to render results as they come in.
 */
export async function findBacklinksAsync(
  targetTitle: string,
  selfId: string,
  notes: NoteMeta[],
  onProgress?: (results: NoteMeta[]) => void,
  signal?: AbortSignal,
): Promise<NoteMeta[]> {
  const target = (targetTitle || '').toLowerCase().trim();
  if (!target) return [];
  const out: NoteMeta[] = [];
  for (const meta of notes) {
    if (signal?.aborted) break;
    if (meta.id === selfId || meta.trashed) continue;
    try {
      const targets = await loadTargets(meta);
      if (targets.some((t) => t.toLowerCase() === target)) {
        out.push(meta);
        onProgress?.(out.slice());
      }
    } catch {
      // ignore unreadable notes
    }
  }
  return out;
}
