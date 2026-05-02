import { app, dialog } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

export type Notebook = {
  id: string;
  name: string;
  stackId: string | null;
  icon?: string;
  createdAt: number;
};

export type Stack = {
  id: string;
  name: string;
};

export type ColorLabel = '' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink';

export type NoteMeta = {
  id: string;
  title: string;
  notebookId: string;
  tags: string[];
  pinned: boolean;
  color: ColorLabel;
  important: boolean;
  urgent: boolean;
  createdAt: number;
  updatedAt: number;
  trashed: boolean;
  excerpt: string;
  wordCount: number;
};

export type Note = NoteMeta & {
  content: string; // Tiptap JSON serialized
  text: string; // plain text for search
};

export type Snapshot = {
  id: string;
  noteId: string;
  takenAt: number;
  title: string;
  content: string;
  text: string;
};

export type Template = {
  id: string;
  name: string;
  title: string;
  content: string;
};

export type Attachment = {
  id: string;
  noteId: string;
  filename: string;
  mime: string;
  size: number;
  addedAt: number;
};

export type SavedSearch = {
  id: string;
  name: string;
  query: string;
  createdAt: number;
};

export type Reminder = {
  id: string;
  noteId: string;
  title: string;
  due: number; // ms epoch
  done: boolean;
  createdAt: number;
};

export type Medication = {
  id: string;
  name: string;
  dosage: string;       // "500mg", "1 comprimé", "10 gouttes"
  notes: string;
  color: string;        // hex for the visual chip
  schedule: string[];   // ["08:00", "13:00", "20:00"]
  daysOfWeek: number[]; // [] = every day, otherwise 0=Sun..6=Sat
  stock: number | null; // remaining doses (optional tracking)
  refillThreshold: number; // notify when stock <= threshold
  active: boolean;
  createdAt: number;
};

export type Intake = {
  id: string;
  medId: string;
  scheduledFor: number; // ms epoch — exact moment it was scheduled
  takenAt: number | null;
  skipped: boolean;
};

export type ContactEvent = {
  id: string;
  /** "birthday" | "anniversary" | "custom" */
  kind: 'birthday' | 'anniversary' | 'custom';
  label: string;
  /** ISO date YYYY-MM-DD (recurring yearly), or YYYY-MM-DD (one-shot) */
  date: string;
  yearly: boolean;
  /** Reminders to fire (in days before). [] = no reminder. 0 = on the day. */
  remindBeforeDays: number[];
};

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  organization: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  avatarDataUrl: string;
  color: string; // for the avatar fallback
  events: ContactEvent[];
  createdAt: number;
  updatedAt: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  time: string | null; // HH:MM, null = all-day
  notes: string;
  color: string;
  /** Days before to fire reminders. e.g. [7, 1, 0] = 1 week, day before, day-of */
  remindBeforeDays: number[];
  /** Optional link to a contact (for birthdays) */
  contactId: string | null;
  createdAt: number;
};

export type Index = {
  notebooks: Notebook[];
  stacks: Stack[];
  notes: NoteMeta[];
  templates: Template[];
  savedSearches: SavedSearch[];
  reminders: Reminder[];
  medications: Medication[];
  intakes: Intake[];
  contacts: Contact[];
  calendarEvents: CalendarEvent[];
};

const dataDir = path.join(app.getPath('userData'), 'DeliNoteData');
const notesDir = path.join(dataDir, 'notes');
const snapshotsDir = path.join(dataDir, 'snapshots');
const attachDir = path.join(dataDir, 'attachments');
const indexPath = path.join(dataDir, 'index.json');

async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else if (e.isFile()) await fs.copyFile(s, d);
  }
}

/** One-time migration from earlier app names (FeverNote, NoteVault). */
async function migrateLegacyDataIfAny() {
  try {
    try { await fs.access(indexPath); return; } catch { /* fall through */ }
    const candidates = [
      path.join(app.getPath('userData'), 'FeverNoteData'),
      path.join(app.getPath('appData'), 'fevernote', 'FeverNoteData'),
      path.join(app.getPath('appData'), 'notevault', 'NoteVaultData'),
    ];
    for (const legacy of candidates) {
      try {
        await fs.access(path.join(legacy, 'index.json'));
        await copyDir(legacy, dataDir);
        return;
      } catch { /* not this one */ }
    }
  } catch { /* ignore */ }
}

async function ensureDirs() {
  await migrateLegacyDataIfAny();
  await fs.mkdir(notesDir, { recursive: true });
  await fs.mkdir(snapshotsDir, { recursive: true });
  await fs.mkdir(attachDir, { recursive: true });
}

async function readIndex(): Promise<Index> {
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    const idx = JSON.parse(raw) as Partial<Index>;
    // Migrate the inbox notebook to the canonical English label so the
    // renderer's i18n helper can re-translate it (e.g. legacy installs that
    // were seeded with "Boîte de réception" → become "Notes rapides").
    const notebooks = (idx.notebooks ?? []).map((n: any) =>
      n.id === 'inbox' && (n.name === 'Boîte de réception' || n.name === 'Boîte de réception')
        ? { ...n, name: 'Inbox' }
        : n,
    );
    return {
      notebooks,
      stacks: idx.stacks ?? [],
      notes: (idx.notes ?? []).map(normalizeMeta),
      templates: idx.templates ?? defaultTemplates(),
      savedSearches: idx.savedSearches ?? [],
      reminders: idx.reminders ?? [],
      medications: idx.medications ?? [],
      intakes: idx.intakes ?? [],
      contacts: (idx.contacts ?? []).map((c: any) => ({ ...c, events: c.events ?? [] })),
      calendarEvents: idx.calendarEvents ?? [],
    };
  } catch {
    const seed: Index = {
      notebooks: [
        // Canonical name "Inbox" — the renderer (labels.ts) translates it to
        // the localized display name ("Notes rapides" in French).
        { id: 'inbox', name: 'Inbox', stackId: null, createdAt: Date.now() },
      ],
      stacks: [],
      notes: [],
      templates: defaultTemplates(),
      savedSearches: [],
      reminders: [],
      medications: [],
      intakes: [],
      contacts: [],
      calendarEvents: [],
    };
    await writeIndex(seed);
    return seed;
  }
}

function normalizeMeta(m: any): NoteMeta {
  return {
    id: m.id,
    title: m.title ?? 'Untitled',
    notebookId: m.notebookId ?? 'inbox',
    tags: m.tags ?? [],
    pinned: !!m.pinned,
    color: (m.color ?? '') as ColorLabel,
    important: !!m.important,
    urgent: !!m.urgent,
    createdAt: m.createdAt ?? Date.now(),
    updatedAt: m.updatedAt ?? Date.now(),
    trashed: !!m.trashed,
    excerpt: m.excerpt ?? '',
    wordCount: m.wordCount ?? 0,
  };
}

// New notes: empty title so the editor shows the localized placeholder.
// Display layers fall back to the localized "Sans titre / Untitled" string.
const NEW_NOTE_TITLE = '';

function defaultTemplates(): Template[] {
  return [
    {
      id: 'tpl-meeting',
      name: 'Meeting notes',
      title: 'Meeting — {{date}}',
      content: JSON.stringify({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Attendees' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Agenda' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Action items' }] },
          { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
        ],
      }),
    },
    {
      id: 'tpl-daily',
      name: 'Daily journal',
      title: '{{date}}',
      content: JSON.stringify({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Today' }] },
          { type: 'paragraph' },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Highlights' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Tomorrow' }] },
          { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
        ],
      }),
    },
    {
      id: 'tpl-blank',
      name: 'Blank note',
      title: 'Untitled',
      content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
    },
  ];
}

async function writeIndex(idx: Index) {
  await ensureDirs();
  await fs.writeFile(indexPath, JSON.stringify(idx, null, 2), 'utf8');
}

function notePath(id: string) {
  return path.join(notesDir, `${id}.json`);
}

function snapshotsForNoteDir(id: string) {
  return path.join(snapshotsDir, id);
}

export async function init() {
  await ensureDirs();
  await readIndex();
}

export async function listIndex(): Promise<Index> {
  return readIndex();
}

export async function getNote(id: string): Promise<Note | null> {
  try {
    const raw = await fs.readFile(notePath(id), 'utf8');
    return JSON.parse(raw) as Note;
  } catch {
    return null;
  }
}

export async function createNote(notebookId: string, seed?: { title?: string; content?: string }): Promise<Note> {
  const idx = await readIndex();
  const id = randomId();
  const now = Date.now();
  const note: Note = {
    id,
    title: seed?.title ?? NEW_NOTE_TITLE,
    notebookId,
    tags: [],
    pinned: false,
    color: '',
    important: false,
    urgent: false,
    createdAt: now,
    updatedAt: now,
    trashed: false,
    excerpt: '',
    wordCount: 0,
    content: seed?.content ?? JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
    text: '',
  };
  await fs.writeFile(notePath(id), JSON.stringify(note, null, 2), 'utf8');
  idx.notes.unshift(metaOf(note));
  await writeIndex(idx);
  return note;
}

export async function saveNote(
  patch: Partial<Note> & { id: string },
  opts?: { snapshot?: boolean; maxSnapshots?: number },
): Promise<NoteMeta | null> {
  const existing = await getNote(patch.id);
  if (!existing) return null;
  if (opts?.snapshot) {
    await writeSnapshot(existing, opts.maxSnapshots ?? 25);
  }
  const text = patch.text ?? existing.text;
  const merged: Note = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
    excerpt: text.slice(0, 200).replace(/\s+/g, ' ').trim(),
    wordCount: countWords(text),
  };
  await fs.writeFile(notePath(merged.id), JSON.stringify(merged, null, 2), 'utf8');
  const idx = await readIndex();
  const i = idx.notes.findIndex((n) => n.id === merged.id);
  if (i >= 0) idx.notes[i] = metaOf(merged);
  await writeIndex(idx);
  return metaOf(merged);
}

export async function trashNote(id: string, trashed: boolean): Promise<void> {
  const n = await getNote(id);
  if (!n) return;
  await saveNote({ id, trashed });
}

function ydocPath(id: string) {
  return path.join(notesDir, `${id}.ydoc.bin`);
}

export async function emptyTrash(): Promise<number> {
  const idx = await readIndex();
  const trashed = idx.notes.filter((n) => n.trashed);
  for (const n of trashed) {
    try { await fs.unlink(notePath(n.id)); } catch { /* ignore */ }
    try { await fs.unlink(ydocPath(n.id)); } catch { /* ignore */ }
    try { await fs.rm(snapshotsForNoteDir(n.id), { recursive: true, force: true }); } catch { /* ignore */ }
  }
  idx.notes = idx.notes.filter((n) => !n.trashed);
  await writeIndex(idx);
  return trashed.length;
}

export async function deleteNoteForever(id: string): Promise<void> {
  const idx = await readIndex();
  idx.notes = idx.notes.filter((n) => n.id !== id);
  await writeIndex(idx);
  try { await fs.unlink(notePath(id)); } catch { /* ignore */ }
  try { await fs.unlink(ydocPath(id)); } catch { /* ignore */ }
  try { await fs.rm(snapshotsForNoteDir(id), { recursive: true, force: true }); } catch { /* ignore */ }
}

export async function duplicateNote(id: string): Promise<Note | null> {
  const src = await getNote(id);
  if (!src) return null;
  const dup = await createNote(src.notebookId, {
    title: `${src.title} (copy)`,
    content: src.content,
  });
  await saveNote({ id: dup.id, tags: src.tags, color: src.color, text: src.text });
  return getNote(dup.id);
}

export async function moveNotes(ids: string[], notebookId: string): Promise<void> {
  for (const id of ids) {
    const n = await getNote(id);
    if (n) await saveNote({ id, notebookId });
  }
}

export async function bulkPatch(ids: string[], patch: Partial<NoteMeta>): Promise<void> {
  for (const id of ids) {
    await saveNote({ id, ...patch });
  }
}

/**
 * Rename a tag everywhere it occurs. If `to` is empty or null, the tag is
 * removed instead. Idempotent: if `to` already exists on a note, duplicates
 * are deduped. Touches updatedAt only on notes that actually changed.
 */
export async function renameTag(from: string, to: string): Promise<{ ok: true; affected: number }> {
  const idx = await readIndex();
  const target = (to ?? '').trim().replace(/^#+/, '');
  let affected = 0;
  for (const meta of idx.notes) {
    if (!meta.tags.includes(from)) continue;
    const next = meta.tags.filter((t) => t !== from);
    if (target && !next.includes(target)) next.push(target);
    // Persist via the full note (so updatedAt is updated)
    const full = await getNote(meta.id);
    if (!full) continue;
    full.tags = next;
    full.updatedAt = Date.now();
    await fs.writeFile(notePath(meta.id), JSON.stringify(full, null, 2), 'utf8');
    meta.tags = next;
    meta.updatedAt = full.updatedAt;
    affected++;
  }
  await writeIndex(idx);
  return { ok: true, affected };
}

// ---------- Notebooks & stacks ----------

export async function createNotebook(name: string, stackId: string | null = null): Promise<Notebook> {
  const idx = await readIndex();
  const nb: Notebook = {
    id: randomId(),
    name: name.trim() || 'Untitled',
    stackId,
    createdAt: Date.now(),
  };
  idx.notebooks.push(nb);
  await writeIndex(idx);
  return nb;
}

export async function renameNotebook(id: string, name: string): Promise<void> {
  const idx = await readIndex();
  const nb = idx.notebooks.find((n) => n.id === id);
  if (nb) {
    nb.name = name.trim() || nb.name;
    await writeIndex(idx);
  }
}

export async function setNotebookStack(id: string, stackId: string | null): Promise<void> {
  const idx = await readIndex();
  const nb = idx.notebooks.find((n) => n.id === id);
  if (nb) {
    nb.stackId = stackId;
    await writeIndex(idx);
  }
}

export async function deleteNotebook(id: string): Promise<void> {
  const idx = await readIndex();
  if (idx.notebooks.length <= 1) return;
  idx.notebooks = idx.notebooks.filter((n) => n.id !== id);
  const fallback = idx.notebooks[0]?.id ?? 'inbox';
  for (const n of idx.notes) {
    if (n.notebookId === id) {
      n.notebookId = fallback;
      const full = await getNote(n.id);
      if (full) {
        full.notebookId = fallback;
        await fs.writeFile(notePath(full.id), JSON.stringify(full, null, 2), 'utf8');
      }
    }
  }
  await writeIndex(idx);
}

export async function createStack(name: string): Promise<Stack> {
  const idx = await readIndex();
  const stack: Stack = { id: randomId(), name: name.trim() || 'Stack' };
  idx.stacks.push(stack);
  await writeIndex(idx);
  return stack;
}

export async function renameStack(id: string, name: string): Promise<void> {
  const idx = await readIndex();
  const s = idx.stacks.find((x) => x.id === id);
  if (s) {
    s.name = name.trim() || s.name;
    await writeIndex(idx);
  }
}

export async function deleteStack(id: string): Promise<void> {
  const idx = await readIndex();
  idx.stacks = idx.stacks.filter((s) => s.id !== id);
  for (const nb of idx.notebooks) {
    if (nb.stackId === id) nb.stackId = null;
  }
  await writeIndex(idx);
}

// ---------- Search ----------

export async function searchNotes(query: string): Promise<NoteMeta[]> {
  const idx = await readIndex();
  const q = query.trim().toLowerCase();
  if (!q) return idx.notes.filter((n) => !n.trashed);
  const results: NoteMeta[] = [];
  for (const meta of idx.notes) {
    if (meta.trashed) continue;
    const haystack = `${meta.title} ${meta.excerpt} ${meta.tags.join(' ')}`.toLowerCase();
    if (haystack.includes(q)) {
      results.push(meta);
      continue;
    }
    const full = await getNote(meta.id);
    if (full && full.text.toLowerCase().includes(q)) {
      results.push(meta);
    }
  }
  return results;
}

// ---------- Snapshots ----------

async function writeSnapshot(note: Note, maxSnapshots: number): Promise<void> {
  const dir = snapshotsForNoteDir(note.id);
  await fs.mkdir(dir, { recursive: true });
  const snap: Snapshot = {
    id: randomId(),
    noteId: note.id,
    takenAt: Date.now(),
    title: note.title,
    content: note.content,
    text: note.text,
  };
  await fs.writeFile(path.join(dir, `${snap.id}.json`), JSON.stringify(snap, null, 2), 'utf8');
  const files = await fs.readdir(dir);
  if (files.length > maxSnapshots) {
    const all: Snapshot[] = [];
    for (const f of files) {
      try {
        const raw = await fs.readFile(path.join(dir, f), 'utf8');
        all.push(JSON.parse(raw) as Snapshot);
      } catch { /* ignore */ }
    }
    all.sort((a, b) => a.takenAt - b.takenAt);
    const toDelete = all.slice(0, all.length - maxSnapshots);
    for (const s of toDelete) {
      try { await fs.unlink(path.join(dir, `${s.id}.json`)); } catch { /* ignore */ }
    }
  }
}

export async function listSnapshots(noteId: string): Promise<Snapshot[]> {
  try {
    const dir = snapshotsForNoteDir(noteId);
    const files = await fs.readdir(dir);
    const all: Snapshot[] = [];
    for (const f of files) {
      try {
        const raw = await fs.readFile(path.join(dir, f), 'utf8');
        all.push(JSON.parse(raw) as Snapshot);
      } catch { /* ignore */ }
    }
    return all.sort((a, b) => b.takenAt - a.takenAt);
  } catch {
    return [];
  }
}

export async function restoreSnapshot(snapshotId: string, noteId: string): Promise<NoteMeta | null> {
  const dir = snapshotsForNoteDir(noteId);
  try {
    const raw = await fs.readFile(path.join(dir, `${snapshotId}.json`), 'utf8');
    const snap = JSON.parse(raw) as Snapshot;
    return saveNote({ id: noteId, title: snap.title, content: snap.content, text: snap.text }, { snapshot: true });
  } catch {
    return null;
  }
}

// ---------- Templates ----------

export async function listTemplates(): Promise<Template[]> {
  const idx = await readIndex();
  return idx.templates;
}

export async function saveTemplate(t: Omit<Template, 'id'> & { id?: string }): Promise<Template> {
  const idx = await readIndex();
  const id = t.id ?? randomId();
  const tpl: Template = { id, name: t.name, title: t.title, content: t.content };
  const i = idx.templates.findIndex((x) => x.id === id);
  if (i >= 0) idx.templates[i] = tpl;
  else idx.templates.push(tpl);
  await writeIndex(idx);
  return tpl;
}

export async function deleteTemplate(id: string): Promise<void> {
  const idx = await readIndex();
  idx.templates = idx.templates.filter((t) => t.id !== id);
  await writeIndex(idx);
}

export async function createNoteFromTemplate(notebookId: string, templateId: string): Promise<Note | null> {
  const idx = await readIndex();
  const tpl = idx.templates.find((t) => t.id === templateId);
  if (!tpl) return null;
  const today = new Date();
  const dateStr = today.toLocaleDateString();
  const title = tpl.title.replace(/\{\{date\}\}/g, dateStr);
  return createNote(notebookId, { title, content: tpl.content });
}

// ---------- Export / Import / Backup ----------

export async function exportAll(): Promise<{ ok: true; path: string } | { ok: false; reason: string }> {
  const res = await dialog.showSaveDialog({
    title: 'Export NoteVault backup',
    defaultPath: `notevault-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, reason: 'cancelled' };
  const idx = await readIndex();
  const fullNotes: Note[] = [];
  for (const meta of idx.notes) {
    const full = await getNote(meta.id);
    if (full) fullNotes.push(full);
  }
  const bundle = { version: 1, exportedAt: Date.now(), index: idx, notes: fullNotes };
  await fs.writeFile(res.filePath, JSON.stringify(bundle, null, 2), 'utf8');
  return { ok: true, path: res.filePath };
}

export async function importBundle(): Promise<{ ok: true; imported: number } | { ok: false; reason: string }> {
  const res = await dialog.showOpenDialog({
    title: 'Import NoteVault backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, reason: 'cancelled' };
  try {
    const raw = await fs.readFile(res.filePaths[0], 'utf8');
    const bundle = JSON.parse(raw) as { index?: Index; notes?: Note[] };
    if (!bundle.index || !bundle.notes) return { ok: false, reason: 'invalid' };
    await writeIndex(bundle.index);
    for (const n of bundle.notes) {
      await fs.writeFile(notePath(n.id), JSON.stringify(n, null, 2), 'utf8');
    }
    return { ok: true, imported: bundle.notes.length };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? 'error' };
  }
}

export async function exportNote(id: string, fmt: 'md' | 'html' | 'txt' | 'json', body: string): Promise<{ ok: true; path: string } | { ok: false; reason: string }> {
  const note = await getNote(id);
  if (!note) return { ok: false, reason: 'not found' };
  const safe = note.title.replace(/[^a-z0-9 _-]/gi, '_').slice(0, 80) || 'Untitled';
  const res = await dialog.showSaveDialog({
    title: `Export ${fmt.toUpperCase()}`,
    defaultPath: `${safe}.${fmt}`,
    filters: [{ name: fmt.toUpperCase(), extensions: [fmt] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, reason: 'cancelled' };
  const out = fmt === 'json' ? JSON.stringify(note, null, 2) : body;
  await fs.writeFile(res.filePath, out, 'utf8');
  return { ok: true, path: res.filePath };
}

/**
 * Bulk import: pick a folder, walk recursively, import every .md/.markdown/.txt
 * file as a separate note. Subfolders become tags (so the structure is preserved
 * without duplicating the notebook tree). Useful for Obsidian vaults, Notion
 * export ZIPs (after unzip), Bear/Joplin exports, plain Apple Notes dumps.
 */
export async function importFolder(): Promise<{ ok: true; imported: number; notebookId: string } | { ok: false; reason: string }> {
  const res = await dialog.showOpenDialog({
    title: 'Import folder of notes',
    properties: ['openDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, reason: 'cancelled' };
  const root = res.filePaths[0];
  const idx = await readIndex();

  // Create or reuse a destination notebook named after the imported folder
  const folderName = path.basename(root);
  const nbName = `Importé — ${folderName}`.slice(0, 60);
  let nb = idx.notebooks.find((n) => n.name === nbName);
  if (!nb) {
    nb = { id: randomId(), name: nbName, stackId: null, createdAt: Date.now() };
    idx.notebooks.push(nb);
    await writeIndex(idx);
  }
  const nbId = nb.id;

  let imported = 0;
  async function walk(dir: string, parentTags: string[]): Promise<void> {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip hidden and system folders
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        await walk(full, [...parentTags, entry.name]);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.md', '.markdown', '.txt', '.text'].includes(ext)) continue;
      try {
        const raw = await fs.readFile(full, 'utf8');
        const title = path.basename(entry.name, ext).trim() || 'Sans titre';
        // Convert into a simple Tiptap doc preserving paragraphs.
        const paragraphs = raw.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
        const content = JSON.stringify({
          type: 'doc',
          content: paragraphs.length === 0
            ? [{ type: 'paragraph' }]
            : paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
        });
        const id = randomId();
        const note: Note = {
          id,
          title,
          notebookId: nbId,
          tags: parentTags.slice(0, 5).map((t) => t.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 24)).filter(Boolean),
          pinned: false,
          color: '',
          important: false,
          urgent: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          trashed: false,
          excerpt: raw.slice(0, 200).replace(/\s+/g, ' ').trim(),
          wordCount: raw.trim() ? raw.trim().split(/\s+/).length : 0,
          content,
          text: raw,
        };
        await fs.writeFile(notePath(id), JSON.stringify(note, null, 2), 'utf8');
        const idx2 = await readIndex();
        idx2.notes.unshift(metaOf(note));
        await writeIndex(idx2);
        imported++;
      } catch { /* skip unreadable files */ }
    }
  }
  await walk(root, []);
  return { ok: true, imported, notebookId: nbId };
}

export async function importTextFile(notebookId: string): Promise<Note | null> {
  const res = await dialog.showOpenDialog({
    title: 'Import text or markdown',
    filters: [{ name: 'Text', extensions: ['md', 'markdown', 'txt'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const filePath = res.filePaths[0];
  const raw = await fs.readFile(filePath, 'utf8');
  const title = path.basename(filePath, path.extname(filePath));
  const content = JSON.stringify({
    type: 'doc',
    content: raw
      .split(/\n\n+/)
      .map((para) => ({ type: 'paragraph', content: para.trim() ? [{ type: 'text', text: para }] : [] })),
  });
  const note = await createNote(notebookId, { title, content });
  await saveNote({ id: note.id, text: raw });
  return getNote(note.id);
}

export async function backupNow(): Promise<{ ok: true; path: string } | { ok: false; reason: string }> {
  const res = await dialog.showOpenDialog({
    title: 'Choose backup folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, reason: 'cancelled' };
  const dest = path.join(res.filePaths[0], `notevault-${Date.now()}`);
  await fs.mkdir(dest, { recursive: true });
  const idx = await readIndex();
  await fs.writeFile(path.join(dest, 'index.json'), JSON.stringify(idx, null, 2), 'utf8');
  await fs.mkdir(path.join(dest, 'notes'), { recursive: true });
  for (const meta of idx.notes) {
    const full = await getNote(meta.id);
    if (full) {
      await fs.writeFile(path.join(dest, 'notes', `${meta.id}.json`), JSON.stringify(full, null, 2), 'utf8');
    }
  }
  return { ok: true, path: dest };
}

export async function getDataDir(): Promise<string> {
  return dataDir;
}

// ---------- Attachments ----------

export async function saveAttachment(
  noteId: string,
  filename: string,
  mime: string,
  bytes: ArrayBuffer | Buffer,
): Promise<Attachment> {
  await ensureDirs();
  const id = randomId();
  const dir = path.join(attachDir, noteId);
  await fs.mkdir(dir, { recursive: true });
  const safeName = filename.replace(/[^a-z0-9._-]/gi, '_');
  const target = path.join(dir, `${id}_${safeName}`);
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  await fs.writeFile(target, buf);
  return {
    id,
    noteId,
    filename,
    mime,
    size: buf.length,
    addedAt: Date.now(),
  };
}

export async function readAttachment(noteId: string, attachmentId: string, filename: string): Promise<Buffer | null> {
  try {
    const safeName = filename.replace(/[^a-z0-9._-]/gi, '_');
    return await fs.readFile(path.join(attachDir, noteId, `${attachmentId}_${safeName}`));
  } catch {
    return null;
  }
}

export async function getAttachmentPath(noteId: string, attachmentId: string, filename: string): Promise<string> {
  const safeName = filename.replace(/[^a-z0-9._-]/gi, '_');
  return path.join(attachDir, noteId, `${attachmentId}_${safeName}`);
}

export async function deleteAttachment(noteId: string, attachmentId: string, filename: string): Promise<void> {
  try {
    const safeName = filename.replace(/[^a-z0-9._-]/gi, '_');
    await fs.unlink(path.join(attachDir, noteId, `${attachmentId}_${safeName}`));
  } catch { /* ignore */ }
}

// ---------- Saved searches ----------

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const idx = await readIndex();
  return idx.savedSearches;
}

export async function saveSavedSearch(name: string, query: string): Promise<SavedSearch> {
  const idx = await readIndex();
  const s: SavedSearch = { id: randomId(), name: name.trim() || query, query, createdAt: Date.now() };
  idx.savedSearches.push(s);
  await writeIndex(idx);
  return s;
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const idx = await readIndex();
  idx.savedSearches = idx.savedSearches.filter((s) => s.id !== id);
  await writeIndex(idx);
}

// ---------- Reminders ----------

export async function listReminders(): Promise<Reminder[]> {
  const idx = await readIndex();
  return idx.reminders;
}

export async function saveReminder(r: Omit<Reminder, 'id' | 'createdAt'> & { id?: string }): Promise<Reminder> {
  const idx = await readIndex();
  const id = r.id ?? randomId();
  const rec: Reminder = {
    id,
    noteId: r.noteId,
    title: r.title,
    due: r.due,
    done: r.done ?? false,
    createdAt: Date.now(),
  };
  const i = idx.reminders.findIndex((x) => x.id === id);
  if (i >= 0) idx.reminders[i] = rec;
  else idx.reminders.push(rec);
  await writeIndex(idx);
  return rec;
}

export async function deleteReminder(id: string): Promise<void> {
  const idx = await readIndex();
  idx.reminders = idx.reminders.filter((r) => r.id !== id);
  await writeIndex(idx);
}

// ---------- Import ENEX (Evernote XML) ----------

export async function importEnex(): Promise<{ ok: true; imported: number } | { ok: false; reason: string }> {
  const res = await dialog.showOpenDialog({
    title: 'Import Evernote .enex',
    filters: [{ name: 'Evernote export', extensions: ['enex'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, reason: 'cancelled' };
  try {
    const raw = await fs.readFile(res.filePaths[0], 'utf8');
    // Parse with fast-xml-parser. ENEX is `<en-export><note>…</note>…</en-export>`.
    const { XMLParser } = await import('fast-xml-parser');
    const parser = new XMLParser({
      ignoreAttributes: false,
      cdataPropName: '__cdata',
      preserveOrder: false,
      allowBooleanAttributes: true,
    });
    const parsed = parser.parse(raw);
    const root = parsed['en-export'];
    if (!root) return { ok: false, reason: 'Not a valid ENEX file' };
    const notes = Array.isArray(root.note) ? root.note : root.note ? [root.note] : [];
    const idx = await readIndex();
    let imported = 0;
    // Get or create an "Importé d'Evernote" notebook
    let importNb = idx.notebooks.find((n) => n.name === "Importé d'Evernote");
    if (!importNb) {
      importNb = { id: randomId(), name: "Importé d'Evernote", stackId: null, createdAt: Date.now() };
      idx.notebooks.push(importNb);
    }
    const crypto = await import('crypto');
    for (const n of notes) {
      const title: string = (typeof n.title === 'string' ? n.title : (n.title?.__cdata ?? 'Sans titre')).trim() || 'Sans titre';
      const enml: string = typeof n.content === 'string' ? n.content : (n.content?.__cdata ?? '');
      const tags: string[] = Array.isArray(n.tag) ? n.tag : n.tag ? [n.tag] : [];
      const created = parseEnTime(n.created) ?? Date.now();
      const updated = parseEnTime(n.updated) ?? created;

      // Build a map of resource hash → { mime, dataUrl } so en-media tags
      // referencing them can be inlined as real Tiptap images / attachments.
      const resources = Array.isArray(n.resource) ? n.resource : n.resource ? [n.resource] : [];
      const mediaMap: Record<string, { mime: string; dataUrl: string; filename: string; size: number }> = {};
      for (const r of resources) {
        try {
          const dataNode = r?.data;
          const base64Raw: string = typeof dataNode === 'string'
            ? dataNode
            : (dataNode?.__cdata ?? dataNode?.['#text'] ?? '');
          const base64 = base64Raw.replace(/\s+/g, '');
          if (!base64) continue;
          const mime: string = (typeof r?.mime === 'string' ? r.mime : (r?.mime?.__cdata ?? 'application/octet-stream'));
          const filename: string = (r?.['resource-attributes']?.['file-name'] ?? r?.['resource-attributes']?.['file-name']?.__cdata
            ?? `attachment.${(mime.split('/')[1] ?? 'bin').slice(0, 6)}`);
          const buf = Buffer.from(base64, 'base64');
          const hash = crypto.createHash('md5').update(buf).digest('hex');
          mediaMap[hash] = {
            mime,
            dataUrl: `data:${mime};base64,${base64}`,
            filename: String(filename),
            size: buf.length,
          };
        } catch { /* skip bad resource */ }
      }

      const text = stripEnml(enml);
      const id = randomId();
      const note: Note = {
        id,
        title,
        notebookId: importNb.id,
        tags,
        pinned: false,
        color: '',
        important: false,
        urgent: false,
        createdAt: created,
        updatedAt: updated,
        trashed: false,
        excerpt: text.slice(0, 200).replace(/\s+/g, ' ').trim(),
        wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
        content: enmlToTiptap(enml, mediaMap),
        text,
      };
      await fs.writeFile(notePath(id), JSON.stringify(note, null, 2), 'utf8');
      idx.notes.unshift(metaOf(note));
      imported++;
    }
    await writeIndex(idx);
    return { ok: true, imported };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? 'parse error' };
  }
}

function parseEnTime(s: any): number | null {
  if (typeof s !== 'string') return null;
  // ENEX uses YYYYMMDDTHHMMSSZ
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function stripEnml(enml: string): string {
  return enml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

// ---------- Medications ----------

export async function listMedications(): Promise<Medication[]> {
  const idx = await readIndex();
  return idx.medications;
}

export async function saveMedication(m: Partial<Medication> & { id?: string; name: string }): Promise<Medication> {
  const idx = await readIndex();
  const id = m.id ?? randomId();
  const existing = idx.medications.find((x) => x.id === id);
  const med: Medication = {
    id,
    name: m.name.trim(),
    dosage: (m.dosage ?? existing?.dosage ?? '').trim(),
    notes: (m.notes ?? existing?.notes ?? '').trim(),
    color: m.color ?? existing?.color ?? '#0d9488',
    schedule: m.schedule ?? existing?.schedule ?? ['08:00'],
    daysOfWeek: m.daysOfWeek ?? existing?.daysOfWeek ?? [],
    stock: m.stock ?? existing?.stock ?? null,
    refillThreshold: m.refillThreshold ?? existing?.refillThreshold ?? 5,
    active: m.active ?? existing?.active ?? true,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  if (existing) {
    idx.medications = idx.medications.map((x) => x.id === id ? med : x);
  } else {
    idx.medications.push(med);
  }
  await writeIndex(idx);
  return med;
}

export async function deleteMedication(id: string): Promise<void> {
  const idx = await readIndex();
  idx.medications = idx.medications.filter((m) => m.id !== id);
  // also drop intakes for this med
  idx.intakes = idx.intakes.filter((i) => i.medId !== id);
  await writeIndex(idx);
}

export async function listIntakes(): Promise<Intake[]> {
  const idx = await readIndex();
  return idx.intakes;
}

/**
 * Mark a scheduled intake as taken (creates the Intake record if it didn't
 * exist yet — intakes are generated lazily from the schedule).
 * Decrements stock if tracked.
 */
export async function markIntake(medId: string, scheduledFor: number, taken: boolean, skipped = false): Promise<Intake> {
  const idx = await readIndex();
  let intake = idx.intakes.find((i) => i.medId === medId && i.scheduledFor === scheduledFor);
  if (!intake) {
    intake = {
      id: randomId(),
      medId,
      scheduledFor,
      takenAt: taken ? Date.now() : null,
      skipped,
    };
    idx.intakes.push(intake);
  } else {
    intake.takenAt = taken ? Date.now() : null;
    intake.skipped = skipped;
  }
  // Stock decrement (only on a fresh "taken")
  if (taken && !skipped) {
    const med = idx.medications.find((m) => m.id === medId);
    if (med && typeof med.stock === 'number') {
      med.stock = Math.max(0, med.stock - 1);
    }
  }
  await writeIndex(idx);
  return intake;
}

export async function clearIntake(medId: string, scheduledFor: number): Promise<void> {
  const idx = await readIndex();
  idx.intakes = idx.intakes.filter((i) => !(i.medId === medId && i.scheduledFor === scheduledFor));
  await writeIndex(idx);
}

// ---------- Contacts ----------

const CONTACT_COLORS = ['#0d9488', '#F37223', '#3b82f6', '#a855f7', '#ec4899', '#22c55e', '#f59e0b', '#ef4444'];

export async function listContacts(): Promise<Contact[]> {
  const idx = await readIndex();
  return idx.contacts;
}

export async function saveContact(c: Partial<Contact> & { id?: string }): Promise<Contact> {
  const idx = await readIndex();
  const id = c.id ?? randomId();
  const existing = idx.contacts.find((x) => x.id === id);
  const contact: Contact = {
    id,
    firstName: (c.firstName ?? existing?.firstName ?? '').trim(),
    lastName: (c.lastName ?? existing?.lastName ?? '').trim(),
    organization: (c.organization ?? existing?.organization ?? '').trim(),
    phone: (c.phone ?? existing?.phone ?? '').trim(),
    email: (c.email ?? existing?.email ?? '').trim(),
    address: (c.address ?? existing?.address ?? '').trim(),
    notes: (c.notes ?? existing?.notes ?? ''),
    avatarDataUrl: c.avatarDataUrl ?? existing?.avatarDataUrl ?? '',
    color: c.color ?? existing?.color ?? CONTACT_COLORS[Math.floor(Math.random() * CONTACT_COLORS.length)],
    events: c.events ?? existing?.events ?? [],
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
  if (existing) {
    idx.contacts = idx.contacts.map((x) => (x.id === id ? contact : x));
  } else {
    idx.contacts.push(contact);
  }
  await writeIndex(idx);
  return contact;
}

export async function deleteContact(id: string): Promise<void> {
  const idx = await readIndex();
  idx.contacts = idx.contacts.filter((c) => c.id !== id);
  await writeIndex(idx);
}

export async function deleteContacts(ids: string[]): Promise<void> {
  const idx = await readIndex();
  const set = new Set(ids);
  idx.contacts = idx.contacts.filter((c) => !set.has(c.id));
  await writeIndex(idx);
}

// ---------- Calendar events ----------

export async function listCalendarEvents(): Promise<CalendarEvent[]> {
  const idx = await readIndex();
  return idx.calendarEvents;
}

export async function saveCalendarEvent(e: Partial<CalendarEvent> & { id?: string; title: string; date: string }): Promise<CalendarEvent> {
  const idx = await readIndex();
  const id = e.id ?? randomId();
  const existing = idx.calendarEvents.find((x) => x.id === id);
  const ev: CalendarEvent = {
    id,
    title: (e.title ?? existing?.title ?? '').trim() || 'Sans titre',
    date: e.date ?? existing?.date ?? new Date().toISOString().slice(0, 10),
    time: e.time !== undefined ? e.time : existing?.time ?? null,
    notes: (e.notes ?? existing?.notes ?? ''),
    color: e.color ?? existing?.color ?? '#3b82f6',
    remindBeforeDays: e.remindBeforeDays ?? existing?.remindBeforeDays ?? [0],
    contactId: e.contactId !== undefined ? e.contactId : existing?.contactId ?? null,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  if (existing) {
    idx.calendarEvents = idx.calendarEvents.map((x) => (x.id === id ? ev : x));
  } else {
    idx.calendarEvents.push(ev);
  }
  await writeIndex(idx);
  return ev;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const idx = await readIndex();
  idx.calendarEvents = idx.calendarEvents.filter((x) => x.id !== id);
  await writeIndex(idx);
}

// ---------- PDF import ----------

/** Picks one or more PDFs, extracts text, creates one note per PDF. */
export async function importPdfs(): Promise<{ ok: true; imported: number } | { ok: false; reason: string }> {
  const res = await dialog.showOpenDialog({
    title: 'Import PDF notes',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (res.canceled || res.filePaths.length === 0) return { ok: false, reason: 'cancelled' };
  try {
    // pdf-parse is loaded lazily so it doesn't slow down app startup.
    const pdfParseModule: any = await import('pdf-parse');
    const pdfParse: (b: Buffer) => Promise<{ text: string }> = pdfParseModule.default ?? pdfParseModule;
    const idx = await readIndex();
    let imported = 0;
    let nb = idx.notebooks.find((n) => n.name === 'Importé — PDF');
    if (!nb) {
      nb = { id: randomId(), name: 'Importé — PDF', stackId: null, createdAt: Date.now() };
      idx.notebooks.push(nb);
      await writeIndex(idx);
    }
    for (const filePath of res.filePaths) {
      try {
        const buf = await fs.readFile(filePath);
        const out = await pdfParse(buf);
        const text = (out.text ?? '').trim();
        const title = path.basename(filePath, '.pdf').trim() || 'PDF';
        const paragraphs = text.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean);
        const content = JSON.stringify({
          type: 'doc',
          content: paragraphs.length === 0
            ? [{ type: 'paragraph' }]
            : paragraphs.map((p: string) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
        });
        const id = randomId();
        const note: Note = {
          id,
          title,
          notebookId: nb.id,
          tags: ['pdf'],
          pinned: false,
          color: '',
          important: false,
          urgent: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          trashed: false,
          excerpt: text.slice(0, 200).replace(/\s+/g, ' ').trim(),
          wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
          content,
          text,
        };
        await fs.writeFile(notePath(id), JSON.stringify(note, null, 2), 'utf8');
        const idx2 = await readIndex();
        idx2.notes.unshift(metaOf(note));
        await writeIndex(idx2);
        imported++;
      } catch { /* skip unreadable PDFs */ }
    }
    return { ok: true, imported };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? 'parse error' };
  }
}

/**
 * Convert ENML (Evernote's XHTML dialect) to a Tiptap JSON document, preserving
 * the structural formatting: headings, paragraphs, lists, blockquotes, links,
 * inline marks (bold/italic/underline/strike/code), tables, code blocks, and
 * task items (en-todo). Raw HTML attributes and unknown elements are skipped.
 *
 * Hand-rolled mini-parser — no DOM dep needed (we run in Node main process).
 */
function enmlToTiptap(enml: string, mediaMap: Record<string, { mime: string; dataUrl: string; filename: string; size: number }> = {}): string {
  // Strip ENML wrapper / XML declaration / DOCTYPE
  let html = enml
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?en-note[^>]*>/gi, '')
    // Replace <en-media> with a real <img> if image, else with a marker comment
    // we'll then turn into an attachment chip during parsing.
    .replace(/<en-media\b([^>]*)\/?>(?:<\/en-media>)?/gi, (_m, attrs: string) => {
      const a = parseAttrsString(attrs);
      const hash = a.hash;
      if (!hash) return '';
      const res = mediaMap[hash];
      if (!res) return '';
      if (res.mime.startsWith('image/')) {
        return `<img src="${res.dataUrl}" alt="${escapeAttr(res.filename)}" />`;
      }
      // Non-image: keep as a placeholder paragraph (we don't have a way to
      // create attachments in main process from here without extra plumbing).
      return `<p>📎 ${escapeAttr(res.filename)}</p>`;
    })
    .trim();

  const tokens = tokenize(html);
  const doc = parseBlocks(tokens);
  return JSON.stringify({
    type: 'doc',
    content: doc.length > 0 ? doc : [{ type: 'paragraph' }],
  });
}

type Tok =
  | { kind: 'open'; tag: string; attrs: Record<string, string> }
  | { kind: 'close'; tag: string }
  | { kind: 'self'; tag: string; attrs: Record<string, string> }
  | { kind: 'text'; value: string };

function tokenize(html: string): Tok[] {
  const out: Tok[] = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)\/?>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[3] !== undefined) {
      const text = decodeEntities(m[3]);
      if (text) out.push({ kind: 'text', value: text });
      continue;
    }
    const full = m[0];
    const tag = (m[1] || '').toLowerCase();
    const attrs = parseAttrs(m[2] || '');
    if (full.startsWith('</')) {
      out.push({ kind: 'close', tag });
    } else if (full.endsWith('/>') || ['br', 'hr', 'img', 'en-todo'].includes(tag)) {
      out.push({ kind: 'self', tag, attrs });
    } else {
      out.push({ kind: 'open', tag, attrs });
    }
  }
  return out;
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z-][a-zA-Z0-9-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out[m[1].toLowerCase()] = m[2];
  return out;
}

/** Same as parseAttrs but used at the pre-tokenization stage. */
function parseAttrsString(s: string): Record<string, string> {
  return parseAttrs(s ?? '');
}

function escapeAttr(s: string): string {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x?([0-9a-fA-F]+);/g, (_, code) => {
      const n = code.startsWith('x') || code.startsWith('X') ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : '';
    });
}

const BLOCK_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr']);
const INLINE_MARK = {
  b: 'bold', strong: 'bold',
  i: 'italic', em: 'italic',
  u: 'underline',
  s: 'strike', strike: 'strike', del: 'strike',
  code: 'code',
} as const;

function parseBlocks(tokens: Tok[]): any[] {
  const out: any[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.kind === 'open') {
      const tag = t.tag;
      // Find matching close
      const end = findClose(tokens, i);
      const inner = tokens.slice(i + 1, end);
      i = end + 1;
      if (/^h[1-6]$/.test(tag)) {
        const lvl = Math.min(3, Number(tag[1])); // Tiptap h1..h3
        out.push({ type: 'heading', attrs: { level: lvl }, content: parseInline(inner) });
      } else if (tag === 'p' || tag === 'div') {
        const content = parseInline(inner);
        if (content.length > 0) out.push({ type: 'paragraph', content });
        else out.push({ type: 'paragraph' });
      } else if (tag === 'ul' || tag === 'ol') {
        const items = parseListItems(inner);
        if (items.length > 0) {
          // Detect taskList (Evernote en-todo) and wrap accordingly
          const wrapper = items[0].type === 'taskItem'
            ? 'taskList'
            : (tag === 'ul' ? 'bulletList' : 'orderedList');
          out.push({ type: wrapper, content: items });
        }
      } else if (tag === 'blockquote') {
        out.push({ type: 'blockquote', content: parseBlocks(inner) });
      } else if (tag === 'pre') {
        const text = inlineText(inner);
        out.push({ type: 'codeBlock', content: text ? [{ type: 'text', text }] : [] });
      } else if (tag === 'table') {
        const rows = parseTableRows(inner);
        if (rows.length > 0) out.push({ type: 'table', content: rows });
      } else {
        // Unknown wrapper — recurse into it
        const sub = parseBlocks(inner);
        out.push(...sub);
      }
    } else if (t.kind === 'self') {
      if (t.tag === 'hr') out.push({ type: 'horizontalRule' });
      else if (t.tag === 'br') out.push({ type: 'paragraph' });
      else if (t.tag === 'img' && t.attrs.src) {
        out.push({ type: 'image', attrs: { src: t.attrs.src, alt: t.attrs.alt ?? '', title: t.attrs.title ?? null } });
      }
      i++;
    } else if (t.kind === 'text') {
      const text = t.value.trim();
      if (text) out.push({ type: 'paragraph', content: [{ type: 'text', text }] });
      i++;
    } else {
      i++;
    }
  }
  return out;
}

function findClose(tokens: Tok[], openIdx: number): number {
  const tag = (tokens[openIdx] as any).tag;
  let depth = 1;
  for (let j = openIdx + 1; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.kind === 'open' && t.tag === tag) depth++;
    else if (t.kind === 'close' && t.tag === tag) {
      depth--;
      if (depth === 0) return j;
    }
  }
  return tokens.length;
}

function parseListItems(tokens: Tok[]): any[] {
  const items: any[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.kind === 'open' && t.tag === 'li') {
      const end = findClose(tokens, i);
      const inner = tokens.slice(i + 1, end);
      // Detect en-todo (Evernote checklist)
      const todo = inner.find((x) => x.kind === 'self' && x.tag === 'en-todo');
      if (todo) {
        const checked = todo.kind === 'self' && (todo.attrs.checked === 'true' || todo.attrs.checked === 'checked');
        const filtered = inner.filter((x) => !(x.kind === 'self' && x.tag === 'en-todo'));
        items.push({
          type: 'taskItem',
          attrs: { checked },
          content: [{ type: 'paragraph', content: parseInline(filtered) }],
        });
      } else {
        const blocks = parseBlocks(inner);
        const content = blocks.length > 0 ? blocks : [{ type: 'paragraph' }];
        items.push({ type: 'listItem', content });
      }
      i = end + 1;
    } else {
      i++;
    }
  }
  // If any taskItems detected, wrap differently
  if (items.length > 0 && items[0].type === 'taskItem') {
    return items;
  }
  return items;
}

function parseTableRows(tokens: Tok[]): any[] {
  const rows: any[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.kind === 'open' && (t.tag === 'tr')) {
      const end = findClose(tokens, i);
      const inner = tokens.slice(i + 1, end);
      const cells: any[] = [];
      let j = 0;
      while (j < inner.length) {
        const ct = inner[j];
        if (ct.kind === 'open' && (ct.tag === 'td' || ct.tag === 'th')) {
          const cellEnd = findClose(inner, j);
          const cellInner = inner.slice(j + 1, cellEnd);
          const cellBlocks = parseBlocks(cellInner);
          cells.push({
            type: ct.tag === 'th' ? 'tableHeader' : 'tableCell',
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: cellBlocks.length > 0 ? cellBlocks : [{ type: 'paragraph' }],
          });
          j = cellEnd + 1;
        } else {
          j++;
        }
      }
      if (cells.length > 0) rows.push({ type: 'tableRow', content: cells });
      i = end + 1;
    } else if (t.kind === 'open' && (t.tag === 'thead' || t.tag === 'tbody')) {
      const end = findClose(tokens, i);
      rows.push(...parseTableRows(tokens.slice(i + 1, end)));
      i = end + 1;
    } else {
      i++;
    }
  }
  return rows;
}

/**
 * Extrait les marks typographiques depuis les attributs d'un <span>/<font> Evernote.
 * Préserve à l'import : couleur de texte, surlignage, taille de police, famille de police.
 * Géré : style="color | background-color | font-size | font-family : ..."
 *        + attributs historiques <font color="..." size="..." face="...">.
 *
 * NB : font-size et font-family sont fusionnés sur un mark `textStyle` unique
 * (l'extension Tiptap autorise plusieurs attributs sur le même mark) pour ne
 * pas créer de marks redondants.
 */
function extractColorMarks(attrs: Record<string, string>): any[] {
  const out: any[] = [];
  const style = attrs.style || '';
  const textStyleAttrs: Record<string, string> = {};

  // Foreground color
  let fg: string | null = null;
  const fgMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  if (fgMatch) fg = fgMatch[1].trim();
  else if (attrs.color) fg = attrs.color.trim();
  if (fg) textStyleAttrs.color = fg;

  // Font size — style="font-size: 14px|14pt|1.2em|..." OU <font size="3"> (HTML legacy)
  const sizeMatch = style.match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/i);
  if (sizeMatch) {
    const raw = sizeMatch[1].trim();
    if (raw && raw.toLowerCase() !== 'inherit' && raw.toLowerCase() !== 'initial') {
      textStyleAttrs.fontSize = raw;
    }
  } else if (attrs.size) {
    // Mapping HTML <font size="1..7"> → px
    const legacy = parseInt(attrs.size, 10);
    const map: Record<number, string> = { 1: '10px', 2: '13px', 3: '16px', 4: '18px', 5: '24px', 6: '32px', 7: '48px' };
    if (legacy && map[legacy]) textStyleAttrs.fontSize = map[legacy];
  }

  // Font family — style="font-family: ..." OU <font face="...">
  const famMatch = style.match(/(?:^|;)\s*font-family\s*:\s*([^;]+)/i);
  if (famMatch) {
    const fam = famMatch[1].trim().replace(/['"]/g, '');
    if (fam) textStyleAttrs.fontFamily = fam;
  } else if (attrs.face) {
    textStyleAttrs.fontFamily = attrs.face.trim().replace(/['"]/g, '');
  }

  if (Object.keys(textStyleAttrs).length > 0) {
    out.push({ type: 'textStyle', attrs: textStyleAttrs });
  }

  // Background / highlight
  const bgMatch = style.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i);
  if (bgMatch) {
    const bg = bgMatch[1].trim();
    // Ignorer les valeurs transparentes / vides
    if (bg && bg !== 'transparent' && bg !== 'none') {
      out.push({ type: 'highlight', attrs: { color: bg } });
    }
  }

  return out;
}

function parseInline(tokens: Tok[], marks: any[] = []): any[] {
  const out: any[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.kind === 'text') {
      if (t.value) out.push({ type: 'text', text: t.value, ...(marks.length ? { marks } : {}) });
      i++;
    } else if (t.kind === 'self') {
      if (t.tag === 'br') out.push({ type: 'hardBreak' });
      i++;
    } else if (t.kind === 'open') {
      const tag = t.tag;
      const end = findClose(tokens, i);
      const inner = tokens.slice(i + 1, end);
      if (tag === 'a') {
        const href = t.attrs.href || '';
        const linkMark = href ? [{ type: 'link', attrs: { href, target: '_blank' } }] : [];
        out.push(...parseInline(inner, [...marks, ...linkMark]));
      } else if ((INLINE_MARK as any)[tag]) {
        const mk = [{ type: (INLINE_MARK as any)[tag] }];
        out.push(...parseInline(inner, [...marks, ...mk]));
      } else if (tag === 'span' || tag === 'font') {
        // Préserver les couleurs Evernote (texte + surlignage) à l'import.
        // - <span style="color: #ff00aa">    → { type: 'textStyle', attrs: { color } }
        // - <span style="background-color">  → { type: 'highlight', attrs: { color } }
        // - <font color="#ff00aa">           → idem (vieille syntaxe Evernote)
        const styleMarks = extractColorMarks(t.attrs);
        out.push(...parseInline(inner, [...marks, ...styleMarks]));
      } else if (BLOCK_TAGS.has(tag)) {
        // Block element nested inside inline — flatten its text only
        const text = inlineText(inner);
        if (text) out.push({ type: 'text', text, ...(marks.length ? { marks } : {}) });
      } else {
        // Unknown inline tag — keep its content
        out.push(...parseInline(inner, marks));
      }
      i = end + 1;
    } else {
      i++;
    }
  }
  return out;
}

function inlineText(tokens: Tok[]): string {
  let s = '';
  for (const t of tokens) {
    if (t.kind === 'text') s += t.value;
    else if (t.kind === 'self' && t.tag === 'br') s += '\n';
    else if (t.kind === 'open' || t.kind === 'close') { /* skip */ }
  }
  return s.trim();
}

// ---------- Generic data-file primitives (used by the CRDT/sync layer) ----------
//
// Lets the renderer read/write arbitrary binary blobs under the data dir — the
// Yjs sync layer persists binary update files (`notes/{id}.ydoc.bin`) next to
// the existing JSON notes. Paths are resolved relative to dataDir and rejected
// if they escape it.

function resolveDataPath(rel: string): string | null {
  if (typeof rel !== 'string' || rel.length === 0) return null;
  const abs = path.resolve(dataDir, rel);
  const norm = path.normalize(abs);
  const root = path.normalize(dataDir + path.sep);
  if (norm !== path.normalize(dataDir) && !norm.startsWith(root)) return null;
  return norm;
}

export async function readDataFile(rel: string): Promise<ArrayBuffer | null> {
  const abs = resolveDataPath(rel);
  if (!abs) return null;
  try {
    const buf = await fs.readFile(abs);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch { return null; }
}

export async function writeDataFile(rel: string, bytes: ArrayBuffer): Promise<boolean> {
  const abs = resolveDataPath(rel);
  if (!abs) return false;
  await ensureDirs();
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(bytes));
  return true;
}

export async function listDataFiles(relDir: string): Promise<string[]> {
  const abs = resolveDataPath(relDir);
  if (!abs) return [];
  try {
    return await fs.readdir(abs);
  } catch { return []; }
}

export async function deleteDataFile(rel: string): Promise<void> {
  const abs = resolveDataPath(rel);
  if (!abs) return;
  try { await fs.unlink(abs); } catch { /* ignore */ }
}

// ---------- Helpers ----------

function metaOf(n: Note): NoteMeta {
  return {
    id: n.id,
    title: n.title,
    notebookId: n.notebookId,
    tags: n.tags,
    pinned: n.pinned,
    color: n.color,
    important: !!n.important,
    urgent: !!n.urgent,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    trashed: n.trashed,
    excerpt: n.excerpt,
    wordCount: n.wordCount,
  };
}

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
