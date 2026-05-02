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
  content: string;
  text: string;
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
  due: number;
  done: boolean;
  createdAt: number;
};

export type Medication = {
  id: string;
  name: string;
  dosage: string;
  notes: string;
  color: string;
  schedule: string[];     // "HH:MM" times each day
  daysOfWeek: number[];   // 0 = Sun .. 6 = Sat ; empty = every day
  stock: number | null;
  refillThreshold: number;
  active: boolean;
  createdAt: number;
};

export type Intake = {
  id: string;
  medId: string;
  scheduledFor: number;
  takenAt: number | null;
  skipped: boolean;
};

export type ContactEvent = {
  id: string;
  kind: 'birthday' | 'anniversary' | 'custom';
  label: string;
  date: string;       // YYYY-MM-DD
  yearly: boolean;
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
  color: string;
  events: ContactEvent[];
  createdAt: number;
  updatedAt: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  notes: string;
  color: string;
  remindBeforeDays: number[];
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
};

export type View =
  | { kind: 'all' }
  | { kind: 'recent' }
  | { kind: 'pinned' }
  | { kind: 'notebook'; id: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'color'; color: ColorLabel }
  | { kind: 'trash' }
  | { kind: 'search'; query: string }
  | { kind: 'meds' }
  | { kind: 'calendar' }
  | { kind: 'tasks' }
  | { kind: 'files' }
  | { kind: 'contacts' }
  | { kind: 'help' };

export type AppNotification = {
  id: string;
  kind: 'reminder' | 'med' | 'clip' | 'system';
  title: string;
  body?: string;
  at: number;
  read: boolean;
  link?: { kind: 'note'; id: string };
};

export type ExportResult =
  | { ok: true; path: string }
  | { ok: false; reason: string };

export type ImportResult =
  | { ok: true; imported: number }
  | { ok: false; reason: string };

declare global {
  const __APP_VERSION__: string;
  interface Window {
    nv: {
      listIndex: () => Promise<Index>;
      getNote: (id: string) => Promise<Note | null>;
      createNote: (notebookId: string, seed?: { title?: string; content?: string }) => Promise<Note>;
      saveNote: (
        patch: Partial<Note> & { id: string },
        opts?: { snapshot?: boolean; maxSnapshots?: number },
      ) => Promise<NoteMeta | null>;
      trashNote: (id: string, trashed: boolean) => Promise<void>;
      deleteNote: (id: string) => Promise<void>;
      duplicateNote: (id: string) => Promise<Note | null>;
      bulkPatch: (ids: string[], patch: Partial<NoteMeta>) => Promise<void>;
      renameTag: (from: string, to: string) => Promise<{ ok: true; affected: number }>;
      moveNotes: (ids: string[], notebookId: string) => Promise<void>;
      emptyTrash: () => Promise<number>;
      searchNotes: (q: string) => Promise<NoteMeta[]>;
      createNotebook: (name: string, stackId?: string | null) => Promise<Notebook>;
      renameNotebook: (id: string, name: string) => Promise<void>;
      setNotebookStack: (id: string, stackId: string | null) => Promise<void>;
      deleteNotebook: (id: string) => Promise<void>;
      createStack: (name: string) => Promise<Stack>;
      renameStack: (id: string, name: string) => Promise<void>;
      deleteStack: (id: string) => Promise<void>;
      listSnapshots: (noteId: string) => Promise<Snapshot[]>;
      restoreSnapshot: (snapId: string, noteId: string) => Promise<NoteMeta | null>;
      listTemplates: () => Promise<Template[]>;
      saveTemplate: (t: Partial<Template>) => Promise<Template>;
      deleteTemplate: (id: string) => Promise<void>;
      createFromTemplate: (notebookId: string, templateId: string) => Promise<Note | null>;
      exportAll: () => Promise<ExportResult>;
      importAll: () => Promise<ImportResult>;
      exportNote: (id: string, fmt: 'md' | 'html' | 'txt' | 'json', body: string) => Promise<ExportResult>;
      importText: (notebookId: string) => Promise<Note | null>;
      backupNow: () => Promise<ExportResult>;
      dataDir: () => Promise<string>;
      openPath: (p: string) => Promise<string>;
      windowMinimize: () => Promise<void>;
      windowMaximizeToggle: () => Promise<void>;
      windowClose: () => Promise<void>;
      windowIsMaximized: () => Promise<boolean>;
      setWindowIcon: (dataUrl: string) => Promise<void>;
      saveAttachment: (noteId: string, filename: string, mime: string, bytes: ArrayBuffer) => Promise<Attachment>;
      openAttachment: (noteId: string, attachmentId: string, filename: string) => Promise<void>;
      readAttachment: (noteId: string, attachmentId: string, filename: string) => Promise<ArrayBuffer | null>;
      deleteAttachment: (noteId: string, attachmentId: string, filename: string) => Promise<void>;
      listSavedSearches: () => Promise<SavedSearch[]>;
      saveSavedSearch: (name: string, query: string) => Promise<SavedSearch>;
      deleteSavedSearch: (id: string) => Promise<void>;
      listReminders: () => Promise<Reminder[]>;
      saveReminder: (r: Partial<Reminder> & { noteId: string; title: string; due: number }) => Promise<Reminder>;
      deleteReminder: (id: string) => Promise<void>;
      onReminderFired: (cb: (r: Reminder) => void) => () => void;
      onClipperReceived: (cb: (info: { id: string; title: string }) => void) => () => void;
      importEnex: () => Promise<{ ok: true; imported: number } | { ok: false; reason: string }>;
      importFolder: () => Promise<{ ok: true; imported: number; notebookId: string } | { ok: false; reason: string }>;
      importPdfs: () => Promise<{ ok: true; imported: number } | { ok: false; reason: string }>;
      listContacts: () => Promise<Contact[]>;
      saveContact: (c: Partial<Contact> & { firstName: string }) => Promise<Contact>;
      deleteContact: (id: string) => Promise<void>;
      deleteContacts: (ids: string[]) => Promise<void>;
      listCalendarEvents: () => Promise<CalendarEvent[]>;
      saveCalendarEvent: (e: Partial<CalendarEvent> & { title: string; date: string }) => Promise<CalendarEvent>;
      deleteCalendarEvent: (id: string) => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      exportPdf: (suggestedName: string) => Promise<ExportResult>;
      listMedications: () => Promise<Medication[]>;
      saveMedication: (m: Partial<Medication> & { name: string }) => Promise<Medication>;
      deleteMedication: (id: string) => Promise<void>;
      listIntakes: () => Promise<Intake[]>;
      markIntake: (medId: string, scheduledFor: number, taken: boolean, skipped?: boolean) => Promise<Intake>;
      clearIntake: (medId: string, scheduledFor: number) => Promise<void>;
      medNotify: (title: string, body: string) => Promise<void>;
      startClipperServer: () => Promise<void>;
      stopClipperServer: () => Promise<void>;
      // Generic data-file primitives (used by the CRDT/sync layer)
      readDataFile: (rel: string) => Promise<ArrayBuffer | null>;
      writeDataFile: (rel: string, bytes: ArrayBuffer) => Promise<boolean>;
      listDataFiles: (relDir: string) => Promise<string[]>;
      deleteDataFile: (rel: string) => Promise<void>;

      // Auto-updater (electron-updater)
      updaterCheck: () => Promise<void>;
      updaterInstall: () => Promise<void>;
      updaterStatus: () => Promise<UpdateStatus>;
      onUpdaterStatus: (cb: (status: UpdateStatus) => void) => () => void;
    };
  }
}

export type UpdateStatus =
  | { phase: 'idle'; currentVersion: string }
  | { phase: 'checking'; currentVersion: string }
  | { phase: 'available'; currentVersion: string; nextVersion: string; releaseNotes?: string }
  | { phase: 'not-available'; currentVersion: string }
  | { phase: 'downloading'; currentVersion: string; nextVersion: string; percent: number; bytesPerSecond: number }
  | { phase: 'ready'; currentVersion: string; nextVersion: string }
  | { phase: 'error'; currentVersion: string; message: string };
