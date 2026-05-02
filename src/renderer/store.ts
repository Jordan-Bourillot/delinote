import { create } from 'zustand';
import type { AppNotification, ColorLabel, Index, Note, NoteMeta, Snapshot, Template, View } from './types';
import { useSettings } from './settings';
import { t } from './i18n';
import { encryptString } from './crypto';
import { getCachedPassword } from './components/NoteLock';
import { ensureNoteCrdtExists, evictNoteCrdt, persistNoteCrdt, refreshNoteCrdt } from './sync/crdt';
import { useTagRegistry } from './tagRegistry';

/** Notes that were unlocked this session and must be re-encrypted on save. */
const encryptedNotesSession = new Set<string>();
export function markNoteAsEncrypted(noteId: string) { encryptedNotesSession.add(noteId); }
export function unmarkNoteAsEncrypted(noteId: string) { encryptedNotesSession.delete(noteId); }
export function isNoteSessionEncrypted(noteId: string): boolean { return encryptedNotesSession.has(noteId); }

type Toast = { id: string; kind: 'info' | 'success' | 'error'; message: string; action?: { label: string; run: () => void } };

type State = {
  index: Index;
  templates: Template[];
  view: View;
  selectedId: string | null;
  selectedIds: Set<string>;
  current: Note | null;
  searchQuery: string;
  searchResults: NoteMeta[] | null;
  loading: boolean;
  saving: 'idle' | 'pending' | 'saved';
  lastSavedAt: number | null;
  snapshots: Snapshot[];
  modal: null | 'settings' | 'quick-switcher' | 'find' | 'shortcuts' | 'templates' | 'export' | 'about';
  toasts: Toast[];
  collapsedStacks: Set<string>;
  collapsedSidebar: boolean;

  refresh: () => Promise<void>;
  setView: (v: View) => void;
  selectNote: (id: string | null) => Promise<void>;
  toggleSelectMulti: (id: string) => void;
  clearSelection: () => void;
  selectAllVisible: (ids: string[]) => void;
  newNote: (notebookId?: string) => Promise<void>;
  newFromTemplate: (templateId: string, notebookId?: string) => Promise<void>;
  openDailyNote: () => Promise<void>;
  patchCurrent: (patch: Partial<Note>) => void;
  flushSave: (opts?: { snapshot?: boolean }) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  setColor: (id: string, color: ColorLabel) => Promise<void>;
  trash: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  deleteForever: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  duplicate: (id: string, count?: number) => Promise<void>;
  moveNotes: (ids: string[], notebookId: string) => Promise<void>;

  newNotebook: (name: string, stackId?: string | null) => Promise<void>;
  renameNotebook: (id: string, name: string) => Promise<void>;
  deleteNotebook: (id: string) => Promise<void>;
  setNotebookStack: (id: string, stackId: string | null) => Promise<void>;
  newStack: (name: string) => Promise<void>;
  renameStack: (id: string, name: string) => Promise<void>;
  deleteStack: (id: string) => Promise<void>;
  toggleStackCollapsed: (id: string) => void;

  setSearch: (q: string) => Promise<void>;
  loadSnapshots: () => Promise<void>;
  restoreSnapshot: (snapId: string) => Promise<void>;
  loadTemplates: () => Promise<void>;
  saveTemplate: (t: Partial<Template>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  openModal: (m: State['modal']) => void;
  closeModal: () => void;
  toast: (kind: Toast['kind'], message: string, action?: Toast['action']) => void;
  dismissToast: (id: string) => void;

  toggleSidebar: () => void;

  // Tabs
  openTabs: string[]; // ordered noteIds
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;

  // Notifications
  notifications: AppNotification[];
  pushNotification: (n: Omit<AppNotification, 'id' | 'at' | 'read'>) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPatch: Partial<Note> | null = null;
let snapshotTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<State>((set, get) => ({
  index: { notebooks: [], stacks: [], notes: [], templates: [], savedSearches: [], reminders: [] },
  templates: [],
  view: { kind: 'all' },
  selectedId: null,
  selectedIds: new Set(),
  current: null,
  searchQuery: '',
  searchResults: null,
  loading: true,
  saving: 'idle',
  lastSavedAt: null,
  snapshots: [],
  modal: null,
  toasts: [],
  collapsedStacks: new Set(),
  collapsedSidebar: false,
  openTabs: loadTabs(),
  notifications: loadNotifications(),

  async refresh() {
    const index = await window.nv.listIndex();
    set({ index, loading: false });
    // Memorise every tag we encounter so it stays visible in the sidebar
    // even after the last note carrying it is deleted.
    const allTags: string[] = [];
    for (const n of index.notes) if (!n.trashed) for (const tg of n.tags) allTags.push(tg);
    useTagRegistry.getState().remember(allTags);
  },

  setView(v) {
    set({ view: v, selectedIds: new Set() });
    if (v.kind !== 'search') set({ searchQuery: '', searchResults: null });
  },

  async selectNote(id) {
    if (!id) {
      set({ selectedId: null, current: null, snapshots: [] });
      return;
    }
    const note = await window.nv.getNote(id);
    set({ selectedId: id, current: note });
    if (note) {
      // Lazy CRDT migration: seed a Y.Doc shadow on first open if missing.
      void ensureNoteCrdtExists(note).catch((e) => console.warn('[crdt] ensure failed', e));
      void get().loadSnapshots();
      // Auto-open in tabs (skip trashed notes — they shouldn't pollute tabs)
      if (!note.trashed) get().openTab(id);
    }
  },

  toggleSelectMulti(id) {
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    });
  },

  clearSelection() {
    set({ selectedIds: new Set() });
  },

  selectAllVisible(ids: string[]) {
    set({ selectedIds: new Set(ids) });
  },

  async newNote(notebookId) {
    const view = get().view;
    let nbId = notebookId;
    if (!nbId) {
      if (view.kind === 'notebook') nbId = view.id;
      else nbId = get().index.notebooks[0]?.id ?? 'inbox';
    }
    const note = await window.nv.createNote(nbId);
    await get().refresh();
    set({ selectedId: note.id, current: note, view: { kind: 'notebook', id: nbId } });
    void ensureNoteCrdtExists(note).catch((e) => console.warn('[crdt] ensure failed', e));
  },

  async newFromTemplate(templateId, notebookId) {
    const view = get().view;
    let nbId = notebookId;
    if (!nbId) {
      if (view.kind === 'notebook') nbId = view.id;
      else nbId = get().index.notebooks[0]?.id ?? 'inbox';
    }
    const note = await window.nv.createFromTemplate(nbId, templateId);
    if (!note) return;
    await get().refresh();
    set({ selectedId: note.id, current: note, view: { kind: 'notebook', id: nbId } });
    void ensureNoteCrdtExists(note).catch((e) => console.warn('[crdt] ensure failed', e));
  },

  /**
   * Open today's daily note. Strategy:
   *  - Look up an existing non-trashed note titled YYYY-MM-DD; if found, open it.
   *  - Otherwise, find or create a "Journal" notebook and seed today's note from
   *    the seeded `tpl-daily` template (or a blank doc as a fallback).
   * This is intentionally implemented entirely on the renderer side so it
   * doesn't require a main-process schema change.
   */
  async openDailyNote() {
    const idx = get().index;
    const today = new Date();
    const isoTitle = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const existing = idx.notes.find((n) => !n.trashed && n.title === isoTitle);
    if (existing) {
      await get().selectNote(existing.id);
      get().openTab(existing.id);
      return;
    }

    // Find or create the "Journal" notebook (localized via translations seed).
    const journalName = useSettings.getState().settings.language === 'fr' ? 'Journal' : 'Journal';
    let journalNb = idx.notebooks.find((n) => n.name.toLowerCase() === journalName.toLowerCase());
    if (!journalNb) {
      journalNb = await window.nv.createNotebook(journalName, null);
    }

    // Try to use the seeded daily template; if absent, fall back to a blank doc.
    const tpl = get().templates.find((x) => x.id === 'tpl-daily')
      ?? (await window.nv.listTemplates()).find((x) => x.id === 'tpl-daily');

    const content = tpl?.content
      ?? JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });

    const note = await window.nv.createNote(journalNb.id, { title: isoTitle, content });
    await get().refresh();
    set({ selectedId: note.id, current: note, view: { kind: 'notebook', id: journalNb.id } });
    get().openTab(note.id);
    void ensureNoteCrdtExists(note).catch((e) => console.warn('[crdt] ensure failed', e));
    get().toast('success', t('toast.dailyOpened'));
  },

  patchCurrent(patch) {
    const cur = get().current;
    if (!cur) return;
    // Dedup no-op patches. The Tiptap editor re-fires onUpdate on initial mount
    // (extension config + content normalization), so we'd otherwise save and
    // bump updatedAt every time the user just *clicks* on a note. We compare
    // each key against the current value and bail if nothing actually changed.
    let changed = false;
    for (const k of Object.keys(patch) as (keyof Note)[]) {
      if ((patch as any)[k] !== (cur as any)[k]) { changed = true; break; }
    }
    if (!changed) return;
    const merged: Note = { ...cur, ...patch };
    set({ current: merged, saving: 'pending' });
    pendingPatch = { ...(pendingPatch ?? {}), ...patch };
    const settings = useSettings.getState().settings;
    if (!settings.autoSave) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void get().flushSave();
    }, settings.autoSaveDebounceMs);
  },

  async flushSave(opts) {
    const cur = get().current;
    if (!cur || !pendingPatch) return;
    let patch: any = { id: cur.id, ...pendingPatch };
    pendingPatch = null;

    // Re-encrypt before persisting if this note is locked.
    if (encryptedNotesSession.has(cur.id)) {
      const pwd = getCachedPassword(cur.id);
      if (pwd) {
        try {
          const content = patch.content ?? cur.content;
          const text = patch.text ?? cur.text;
          const env = await encryptString(JSON.stringify({ content, text }), pwd);
          patch = { ...patch, content: env, text: '' };
        } catch (e) {
          // If encryption fails, abort save to avoid leaking plaintext
          get().toast('error', String(e));
          return;
        }
      }
    }

    const settings = useSettings.getState().settings;
    let snapshot = opts?.snapshot ?? false;
    // Throttled snapshot: at most one every 2 minutes per note while editing
    if (settings.enableNoteHistory && !snapshot) {
      if (!snapshotTimer) {
        snapshot = true;
        snapshotTimer = setTimeout(() => {
          snapshotTimer = null;
        }, 2 * 60 * 1000);
      }
    }
    const saved = await window.nv.saveNote(patch, { snapshot, maxSnapshots: settings.historyMaxSnapshots });
    set({ saving: 'saved', lastSavedAt: Date.now() });
    // Mirror to the CRDT sync layer (write-side). Failures here must NOT
    // break the user's save — JSON storage is authoritative locally.
    try {
      await persistNoteCrdt({
        ...patch,
        updatedAt: saved?.updatedAt ?? Date.now(),
      });
    } catch (e) {
      console.warn('[crdt] persist failed', e);
    }
    await get().refresh();
  },

  async togglePin(id) {
    const meta = get().index.notes.find((n) => n.id === id);
    if (!meta) return;
    await window.nv.saveNote({ id, pinned: !meta.pinned });
    void refreshNoteCrdt(id);
    await get().refresh();
    if (get().current?.id === id) await get().selectNote(id);
  },

  async setColor(id, color) {
    await window.nv.saveNote({ id, color });
    void refreshNoteCrdt(id);
    await get().refresh();
    if (get().current?.id === id) await get().selectNote(id);
  },

  async trash(id) {
    await window.nv.trashNote(id, true);
    void refreshNoteCrdt(id);
    if (get().selectedId === id) set({ selectedId: null, current: null });
    get().closeTab(id);
    await get().refresh();
    get().toast('info', t('toast.movedToTrash'), {
      label: 'Annuler',
      run: () => void get().restore(id),
    });
  },

  async restore(id) {
    await window.nv.trashNote(id, false);
    void refreshNoteCrdt(id);
    await get().refresh();
    get().toast('success', t('toast.restored'));
  },

  async deleteForever(id) {
    await window.nv.deleteNote(id);
    evictNoteCrdt(id);
    if (get().selectedId === id) set({ selectedId: null, current: null });
    await get().refresh();
    get().toast('info', t('toast.deletedForever'));
  },

  async emptyTrash() {
    const n = await window.nv.emptyTrash();
    await get().refresh();
    get().toast('success', t('toast.emptyTrash', { n }));
  },

  async duplicate(id, count = 1) {
    const n = Math.max(1, Math.min(50, Math.round(count)));
    let last: Note | null = null;
    for (let i = 0; i < n; i++) {
      const dup = await window.nv.duplicateNote(id);
      if (dup) {
        last = dup;
        void ensureNoteCrdtExists(dup).catch((e) => console.warn('[crdt] ensure failed', e));
      }
    }
    await get().refresh();
    if (last) {
      set({ selectedId: last.id, current: last });
      get().toast('success', n > 1 ? `${n} ${t('toast.duplicated').toLowerCase()}` : t('toast.duplicated'));
    }
  },

  async moveNotes(ids, notebookId) {
    await window.nv.moveNotes(ids, notebookId);
    void refreshNoteCrdt(ids);
    await get().refresh();
    get().toast('success', t(ids.length > 1 ? 'toast.movedNs' : 'toast.movedN', { n: ids.length }));
  },

  async newNotebook(name, stackId = null) {
    const nb = await window.nv.createNotebook(name, stackId);
    await get().refresh();
    set({ view: { kind: 'notebook', id: nb.id } });
  },

  async renameNotebook(id, name) {
    await window.nv.renameNotebook(id, name);
    await get().refresh();
  },

  async deleteNotebook(id) {
    await window.nv.deleteNotebook(id);
    set({ view: { kind: 'all' }, selectedId: null, current: null });
    await get().refresh();
  },

  async setNotebookStack(id, stackId) {
    await window.nv.setNotebookStack(id, stackId);
    await get().refresh();
  },

  async newStack(name) {
    await window.nv.createStack(name);
    await get().refresh();
  },

  async renameStack(id, name) {
    await window.nv.renameStack(id, name);
    await get().refresh();
  },

  async deleteStack(id) {
    await window.nv.deleteStack(id);
    await get().refresh();
  },

  toggleStackCollapsed(id) {
    set((s) => {
      const next = new Set(s.collapsedStacks);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { collapsedStacks: next };
    });
  },

  async setSearch(q) {
    set({ searchQuery: q });
    if (!q.trim()) {
      set({ searchResults: null });
      if (get().view.kind === 'search') set({ view: { kind: 'all' } });
      return;
    }
    const results = await window.nv.searchNotes(q);
    set({ searchResults: results, view: { kind: 'search', query: q } });
  },

  async loadSnapshots() {
    const cur = get().current;
    if (!cur) return;
    const snaps = await window.nv.listSnapshots(cur.id);
    set({ snapshots: snaps });
  },

  async restoreSnapshot(snapId) {
    const cur = get().current;
    if (!cur) return;
    await window.nv.restoreSnapshot(snapId, cur.id);
    void refreshNoteCrdt(cur.id);
    await get().selectNote(cur.id);
    await get().refresh();
    get().toast('success', t('toast.restoredSnap'));
  },

  async loadTemplates() {
    const t = await window.nv.listTemplates();
    set({ templates: t });
  },

  async saveTemplate(t) {
    await window.nv.saveTemplate(t);
    await get().loadTemplates();
  },

  async deleteTemplate(id) {
    await window.nv.deleteTemplate(id);
    await get().loadTemplates();
  },

  openModal(m) {
    set({ modal: m });
  },
  closeModal() {
    set({ modal: null });
  },
  toast(kind, message, action) {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, action }] }));
    setTimeout(() => get().dismissToast(id), action ? 6000 : 3500);
  },
  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  toggleSidebar() {
    set((s) => ({ collapsedSidebar: !s.collapsedSidebar }));
  },

  // ----- Tabs -----
  openTab(id) {
    set((s) => {
      if (s.openTabs.includes(id)) return {};
      const next = [...s.openTabs, id].slice(-12); // hard cap of 12
      saveTabs(next);
      return { openTabs: next };
    });
  },
  closeTab(id) {
    set((s) => {
      const idx = s.openTabs.indexOf(id);
      const next = s.openTabs.filter((x) => x !== id);
      saveTabs(next);
      // If we closed the currently-selected tab, fall through to a neighbour
      const patch: Partial<State> = { openTabs: next };
      if (s.selectedId === id) {
        const fallback = next[idx] ?? next[idx - 1] ?? null;
        if (fallback) {
          // async-load the fallback note in the background
          window.nv.getNote(fallback).then((n) => set({ selectedId: fallback, current: n }));
        } else {
          patch.selectedId = null;
          patch.current = null;
        }
      }
      return patch;
    });
  },
  closeOtherTabs(id) {
    set(() => { saveTabs([id]); return { openTabs: [id] }; });
  },
  closeAllTabs() {
    set(() => { saveTabs([]); return { openTabs: [] }; });
  },

  // ----- Notifications -----
  pushNotification(n) {
    set((s) => {
      const item: AppNotification = { ...n, id: Math.random().toString(36).slice(2), at: Date.now(), read: false };
      const next = [item, ...s.notifications].slice(0, 50);
      saveNotifications(next);
      return { notifications: next };
    });
  },
  markAllRead() {
    set((s) => {
      const next = s.notifications.map((n) => ({ ...n, read: true }));
      saveNotifications(next);
      return { notifications: next };
    });
  },
  clearNotifications() {
    saveNotifications([]);
    set({ notifications: [] });
  },
}));

// ----- Tabs/notifications persistence (localStorage) -----
const TABS_KEY = 'delinote.tabs.v1';
const NOTIF_KEY = 'delinote.notifications.v1';
function loadTabs(): string[] {
  try { return JSON.parse(localStorage.getItem(TABS_KEY) || '[]'); } catch { return []; }
}
function saveTabs(tabs: string[]) {
  try { localStorage.setItem(TABS_KEY, JSON.stringify(tabs)); } catch { /* ignore */ }
}
function loadNotifications(): AppNotification[] {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch { return []; }
}
function saveNotifications(arr: AppNotification[]) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
}
