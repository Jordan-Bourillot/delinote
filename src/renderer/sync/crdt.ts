// Yjs CRDT shadow layer.
//
// Every note has a JSON file (notes/{id}.json — the existing storage,
// authoritative for the local app) AND a Yjs binary update file
// (notes/{id}.ydoc.bin — the sync layer). Saves write both. The Y.Doc lets
// concurrent edits across devices merge cleanly when the data folder is
// replicated (Phase 2 — BYO sync).
//
// Phase 1 scope: write-side only — every save also produces a fresh .ydoc.bin
// snapshot. Read-side merge (when a remote update arrives) lands in Phase 2
// with the folder watcher.

import * as Y from 'yjs';
import type { ColorLabel, Note } from '../types';

const docCache = new Map<string, Y.Doc>();

function relPath(noteId: string): string {
  return `notes/${noteId}.ydoc.bin`;
}

/** Load the Y.Doc for a note from disk if present, else create a fresh one. */
export async function loadOrCreateDoc(noteId: string): Promise<Y.Doc> {
  const cached = docCache.get(noteId);
  if (cached) return cached;
  const doc = new Y.Doc();
  const bin = await window.nv.readDataFile(relPath(noteId));
  if (bin && bin.byteLength > 0) {
    try {
      Y.applyUpdate(doc, new Uint8Array(bin));
    } catch {
      // Corrupted .ydoc.bin — start fresh. The JSON file is still
      // authoritative locally; we just lose merge history for this note.
    }
  }
  docCache.set(noteId, doc);
  return doc;
}

/** Mirror the note's fields into the Y.Doc's "note" map. */
export function syncDocFromNote(doc: Y.Doc, note: Partial<Note> & { id: string }): void {
  doc.transact(() => {
    const m = doc.getMap<unknown>('note');
    if (note.title !== undefined) m.set('title', note.title);
    if (note.content !== undefined) m.set('content', note.content);
    if (note.text !== undefined) m.set('text', note.text);
    if (note.notebookId !== undefined) m.set('notebookId', note.notebookId);
    if (note.tags !== undefined) m.set('tags', note.tags);
    if (note.pinned !== undefined) m.set('pinned', note.pinned);
    if (note.color !== undefined) m.set('color', note.color);
    if (note.important !== undefined) m.set('important', note.important);
    if (note.urgent !== undefined) m.set('urgent', note.urgent);
    if (note.trashed !== undefined) m.set('trashed', note.trashed);
    if (note.updatedAt !== undefined) m.set('updatedAt', note.updatedAt);
    if (note.createdAt !== undefined) m.set('createdAt', note.createdAt);
  });
}

/** Read the note fields back out of a Y.Doc. */
export function readNoteFromDoc(doc: Y.Doc): Partial<Note> {
  const m = doc.getMap<unknown>('note');
  return {
    title: m.get('title') as string | undefined,
    content: m.get('content') as string | undefined,
    text: m.get('text') as string | undefined,
    notebookId: m.get('notebookId') as string | undefined,
    tags: m.get('tags') as string[] | undefined,
    pinned: m.get('pinned') as boolean | undefined,
    color: m.get('color') as ColorLabel | undefined,
    important: m.get('important') as boolean | undefined,
    urgent: m.get('urgent') as boolean | undefined,
    trashed: m.get('trashed') as boolean | undefined,
    updatedAt: m.get('updatedAt') as number | undefined,
    createdAt: m.get('createdAt') as number | undefined,
  };
}

/** Encode the Y.Doc state and write it to disk. */
async function persistDoc(noteId: string, doc: Y.Doc): Promise<void> {
  const update = Y.encodeStateAsUpdate(doc);
  // Detach the bytes from any underlying buffer so the IPC postMessage can
  // structured-clone them (Electron rejects SharedArrayBuffer-backed views).
  const ab = new ArrayBuffer(update.byteLength);
  new Uint8Array(ab).set(update);
  await window.nv.writeDataFile(relPath(noteId), ab);
}

/** Public: sync the note's current fields into its Y.Doc and persist. */
export async function persistNoteCrdt(note: Partial<Note> & { id: string }): Promise<void> {
  const doc = await loadOrCreateDoc(note.id);
  syncDocFromNote(doc, note);
  await persistDoc(note.id, doc);
}

/**
 * Lazy migration entry point: if the note doesn't have a .ydoc.bin yet, seed
 * one from its current fields. No-op if the binary already exists. Called
 * when a note is opened or freshly created.
 */
export async function ensureNoteCrdtExists(note: Note): Promise<void> {
  const existing = await window.nv.readDataFile(relPath(note.id));
  if (existing && existing.byteLength > 0) {
    // Make sure the cache reflects what's on disk.
    if (!docCache.has(note.id)) {
      const doc = new Y.Doc();
      try { Y.applyUpdate(doc, new Uint8Array(existing)); } catch { /* ignore */ }
      docCache.set(note.id, doc);
    }
    return;
  }
  await persistNoteCrdt(note);
}

/** Drop a note's Y.Doc from the in-memory cache (e.g. after delete). */
export function evictNoteCrdt(noteId: string): void {
  docCache.delete(noteId);
}

/**
 * Re-read a note's JSON from disk and re-persist its Y.Doc. Used after
 * metadata-only mutations (pin / color / trash / move) so the CRDT shadow
 * doesn't lag behind the JSON. Failures are logged and swallowed.
 */
export async function refreshNoteCrdt(noteIds: string | string[]): Promise<void> {
  const ids = Array.isArray(noteIds) ? noteIds : [noteIds];
  for (const id of ids) {
    try {
      const note = await window.nv.getNote(id);
      if (note) await persistNoteCrdt(note);
    } catch (e) {
      console.warn('[crdt] refresh failed', id, e);
    }
  }
}
