import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Index / notes
  listIndex: () => ipcRenderer.invoke('index:list'),
  getNote: (id: string) => ipcRenderer.invoke('note:get', id),
  createNote: (notebookId: string, seed?: { title?: string; content?: string }) =>
    ipcRenderer.invoke('note:create', notebookId, seed),
  saveNote: (patch: unknown, opts?: { snapshot?: boolean; maxSnapshots?: number }) =>
    ipcRenderer.invoke('note:save', patch, opts),
  trashNote: (id: string, trashed: boolean) => ipcRenderer.invoke('note:trash', id, trashed),
  deleteNote: (id: string) => ipcRenderer.invoke('note:delete', id),
  duplicateNote: (id: string) => ipcRenderer.invoke('note:duplicate', id),
  bulkPatch: (ids: string[], patch: unknown) => ipcRenderer.invoke('note:bulkPatch', ids, patch),
  renameTag: (from: string, to: string) => ipcRenderer.invoke('tag:rename', from, to),
  moveNotes: (ids: string[], notebookId: string) => ipcRenderer.invoke('note:move', ids, notebookId),
  emptyTrash: () => ipcRenderer.invoke('note:emptyTrash'),
  searchNotes: (q: string) => ipcRenderer.invoke('note:search', q),

  // Notebooks & stacks
  createNotebook: (name: string, stackId: string | null = null) =>
    ipcRenderer.invoke('notebook:create', name, stackId),
  renameNotebook: (id: string, name: string) => ipcRenderer.invoke('notebook:rename', id, name),
  setNotebookStack: (id: string, stackId: string | null) =>
    ipcRenderer.invoke('notebook:setStack', id, stackId),
  deleteNotebook: (id: string) => ipcRenderer.invoke('notebook:delete', id),
  createStack: (name: string) => ipcRenderer.invoke('stack:create', name),
  renameStack: (id: string, name: string) => ipcRenderer.invoke('stack:rename', id, name),
  deleteStack: (id: string) => ipcRenderer.invoke('stack:delete', id),

  // Snapshots
  listSnapshots: (noteId: string) => ipcRenderer.invoke('snap:list', noteId),
  restoreSnapshot: (snapId: string, noteId: string) =>
    ipcRenderer.invoke('snap:restore', snapId, noteId),

  // Templates
  listTemplates: () => ipcRenderer.invoke('tpl:list'),
  saveTemplate: (t: unknown) => ipcRenderer.invoke('tpl:save', t),
  deleteTemplate: (id: string) => ipcRenderer.invoke('tpl:delete', id),
  createFromTemplate: (notebookId: string, templateId: string) =>
    ipcRenderer.invoke('tpl:create', notebookId, templateId),

  // Export / import / backup
  exportAll: () => ipcRenderer.invoke('export:all'),
  importAll: () => ipcRenderer.invoke('import:all'),
  exportNote: (id: string, fmt: 'md' | 'html' | 'txt' | 'json', body: string) =>
    ipcRenderer.invoke('export:note', id, fmt, body),
  importText: (notebookId: string) => ipcRenderer.invoke('import:text', notebookId),
  backupNow: () => ipcRenderer.invoke('backup:now'),
  dataDir: () => ipcRenderer.invoke('app:dataDir'),
  openPath: (p: string) => ipcRenderer.invoke('shell:openPath', p),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximizeToggle: () => ipcRenderer.invoke('window:maximizeToggle'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  setWindowIcon: (dataUrl: string) => ipcRenderer.invoke('window:setIcon', dataUrl),

  // Attachments
  saveAttachment: (noteId: string, filename: string, mime: string, bytes: ArrayBuffer) =>
    ipcRenderer.invoke('attach:save', noteId, filename, mime, bytes),
  openAttachment: (noteId: string, attachmentId: string, filename: string) =>
    ipcRenderer.invoke('attach:open', noteId, attachmentId, filename),
  readAttachment: (noteId: string, attachmentId: string, filename: string) =>
    ipcRenderer.invoke('attach:read', noteId, attachmentId, filename),
  deleteAttachment: (noteId: string, attachmentId: string, filename: string) =>
    ipcRenderer.invoke('attach:delete', noteId, attachmentId, filename),

  // Saved searches
  listSavedSearches: () => ipcRenderer.invoke('search:list'),
  saveSavedSearch: (name: string, query: string) => ipcRenderer.invoke('search:save', name, query),
  deleteSavedSearch: (id: string) => ipcRenderer.invoke('search:delete', id),

  // Reminders
  listReminders: () => ipcRenderer.invoke('rem:list'),
  saveReminder: (r: unknown) => ipcRenderer.invoke('rem:save', r),
  deleteReminder: (id: string) => ipcRenderer.invoke('rem:delete', id),
  onReminderFired: (cb: (r: unknown) => void) => {
    const handler = (_e: unknown, r: unknown) => cb(r);
    ipcRenderer.on('reminder:fired', handler);
    return () => ipcRenderer.removeListener('reminder:fired', handler);
  },
  onClipperReceived: (cb: (info: { id: string; title: string }) => void) => {
    const handler = (_e: unknown, info: { id: string; title: string }) => cb(info);
    ipcRenderer.on('clipper:received', handler);
    return () => ipcRenderer.removeListener('clipper:received', handler);
  },

  // ENEX + folder + PDF import
  importEnex: () => ipcRenderer.invoke('enex:import'),
  importFolder: () => ipcRenderer.invoke('folder:import'),
  importPdfs: () => ipcRenderer.invoke('pdf:import'),

  // Contacts
  listContacts: () => ipcRenderer.invoke('contact:list'),
  saveContact: (c: unknown) => ipcRenderer.invoke('contact:save', c),
  deleteContact: (id: string) => ipcRenderer.invoke('contact:delete', id),
  deleteContacts: (ids: string[]) => ipcRenderer.invoke('contact:deleteMany', ids),
  // Calendar events
  listCalendarEvents: () => ipcRenderer.invoke('cal:list'),
  saveCalendarEvent: (e: unknown) => ipcRenderer.invoke('cal:save', e),
  deleteCalendarEvent: (id: string) => ipcRenderer.invoke('cal:delete', id),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // PDF
  exportPdf: (suggestedName: string) => ipcRenderer.invoke('pdf:export', suggestedName),

  // Medications
  listMedications: () => ipcRenderer.invoke('med:list'),
  saveMedication: (m: unknown) => ipcRenderer.invoke('med:save', m),
  deleteMedication: (id: string) => ipcRenderer.invoke('med:delete', id),
  listIntakes: () => ipcRenderer.invoke('intake:list'),
  markIntake: (medId: string, scheduledFor: number, taken: boolean, skipped?: boolean) =>
    ipcRenderer.invoke('intake:mark', medId, scheduledFor, taken, skipped),
  clearIntake: (medId: string, scheduledFor: number) =>
    ipcRenderer.invoke('intake:clear', medId, scheduledFor),
  medNotify: (title: string, body: string) => ipcRenderer.invoke('med:notify', title, body),
  startClipperServer: () => ipcRenderer.invoke('clipper:start'),
  stopClipperServer: () => ipcRenderer.invoke('clipper:stop'),

  // LAN share — spins up a one-hour HTTP server serving a single note as
  // an HTML page so a friend on the same Wi-Fi can scan a QR and read it.
  // When `live: true`, the page becomes a contenteditable that two-way syncs
  // with the host via SSE + POST.
  shareStart: (args: { noteId: string; title: string; html: string; text: string; live?: boolean }) =>
    ipcRenderer.invoke('share:start', args),
  shareStop: (key: string) => ipcRenderer.invoke('share:stop', key),
  shareList: () => ipcRenderer.invoke('share:list'),
  shareHostUpdate: (args: { key: string; title: string; text: string }) =>
    ipcRenderer.invoke('share:host-update', args),
  /** Subscribe to peer-originated edits coming from a connected phone client. */
  onSharePeerUpdate: (cb: (info: { key: string; noteId: string; title: string; text: string; version: number }) => void) => {
    const handler = (_e: unknown, info: any) => cb(info);
    ipcRenderer.on('share:peer-update', handler);
    return () => ipcRenderer.removeListener('share:peer-update', handler);
  },

  // Generic data-file primitives (CRDT/sync layer)
  readDataFile: (rel: string) => ipcRenderer.invoke('data:read', rel),
  writeDataFile: (rel: string, bytes: ArrayBuffer) => ipcRenderer.invoke('data:write', rel, bytes),
  listDataFiles: (relDir: string) => ipcRenderer.invoke('data:list', relDir),
  deleteDataFile: (rel: string) => ipcRenderer.invoke('data:delete', rel),

  // Beta : feedback dialog avant fermeture de l'app
  onShowFeedbackDialog: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('app:show-feedback-dialog', handler);
    return () => ipcRenderer.removeListener('app:show-feedback-dialog', handler);
  },
  // Auto-update : dialogue affiché à la place du FeedbackDialog quand la
  // fermeture est déclenchée par l'auto-updater (« Installer maintenant »).
  onShowUpdatingDialog: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('app:show-updating-dialog', handler);
    return () => ipcRenderer.removeListener('app:show-updating-dialog', handler);
  },
  confirmAppClose: () => ipcRenderer.invoke('app:confirm-close'),

  // Auto-updater
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterInstall: () => ipcRenderer.invoke('updater:install'),
  updaterStatus: () => ipcRenderer.invoke('updater:status'),
  onUpdaterStatus: (cb: (status: any) => void) => {
    const handler = (_e: unknown, status: any) => cb(status);
    ipcRenderer.on('updater:status', handler);
    return () => ipcRenderer.removeListener('updater:status', handler);
  },
};

contextBridge.exposeInMainWorld('nv', api);

export type NvApi = typeof api;
