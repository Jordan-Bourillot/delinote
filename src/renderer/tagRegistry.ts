import { create } from 'zustand';

const KEY = 'notevault.knownTags.v1';

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function persist(tags: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(tags)); } catch { /* quota / private mode */ }
}

interface TagRegistry {
  knownTags: string[];
  remember: (tags: string[]) => void;
  forget: (tag: string) => void;
  rename: (from: string, to: string) => void;
}

export const useTagRegistry = create<TagRegistry>((set, get) => ({
  knownTags: load(),
  remember: (tags) => {
    if (!tags || tags.length === 0) return;
    const cur = new Set(get().knownTags);
    let dirty = false;
    for (const raw of tags) {
      const t = (raw || '').trim();
      if (t && !cur.has(t)) { cur.add(t); dirty = true; }
    }
    if (dirty) {
      const next = Array.from(cur).sort((a, b) => a.localeCompare(b));
      persist(next);
      set({ knownTags: next });
    }
  },
  forget: (tag) => {
    const next = get().knownTags.filter((t) => t !== tag);
    if (next.length === get().knownTags.length) return;
    persist(next);
    set({ knownTags: next });
  },
  rename: (from, to) => {
    const target = (to || '').trim();
    const cur = get().knownTags;
    const without = cur.filter((t) => t !== from);
    const next = target && !without.includes(target)
      ? [...without, target].sort((a, b) => a.localeCompare(b))
      : without;
    persist(next);
    set({ knownTags: next });
  },
}));
