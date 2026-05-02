import { app, BrowserWindow, ipcMain, shell, Menu, nativeImage, Notification, dialog } from 'electron';
import { existsSync } from 'fs';
import { promises as fsp } from 'fs';
import http from 'http';
import path from 'path';
import * as storage from './storage';
import { initUpdater, checkForUpdates, quitAndInstall, getStatus as getUpdateStatus } from './updater';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

/**
 * Resolve the window icon: prefer the user's lion.png that lives in the
 * renderer's public folder (single source of truth, also used by the in-app
 * Logo component). Falls back to undefined → Electron's default icon.
 */
function resolveIcon() {
  const candidates = isDev
    ? [path.join(__dirname, '../../src/renderer/public/lion.png')]
    : [path.join(__dirname, '../renderer/lion.png')];
  for (const p of candidates) {
    if (existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    }
  }
  return undefined;
}

async function createWindow() {
  const icon = resolveIcon();
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#ffffff',
    title: 'DéliNote',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
      // Local-only app loaded via file:// — relaxed web security keeps ES modules
      // and dynamic chunks loading reliably without CORS hiccups.
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    // DevTools no longer open automatically — press F12 or Ctrl+Shift+I to toggle.
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // F12 / Ctrl+Shift+I to toggle DevTools manually
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      win.webContents.toggleDevTools();
    }
  });

  // If the renderer crashes or fails to load, pop DevTools so the user can see why
  // (otherwise the window stays blank silently in production).
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[DéliNote] renderer gone:', details);
    win.webContents.openDevTools({ mode: 'detach' });
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[DéliNote] did-fail-load:', code, desc, url);
    if (!isDev) win.webContents.openDevTools({ mode: 'detach' });
  });

  // ----- Beta : intercepter la fermeture pour proposer un retour -----
  // Le renderer affiche le FeedbackDialog ; quand l'utilisateur confirme
  // (Envoyer ou Skip), il appelle window.nv.confirmAppClose() → on autorise
  // la vraie fermeture via le flag allowClose.
  // Exception : si la fermeture est déclenchée par l'auto-updater, on
  // affiche le dialogue « mise à jour en cours » à la place du formulaire
  // bêta — l'utilisateur a déjà cliqué « Installer maintenant », pas la
  // peine de lui demander un retour à ce moment-là.
  win.on('close', (event) => {
    if (allowClose) return;             // 2e passage : on laisse fermer
    event.preventDefault();
    if (!feedbackShown) {
      feedbackShown = true;
      if (updaterTriggeredClose) {
        win.webContents.send('app:show-updating-dialog');
      } else {
        win.webContents.send('app:show-feedback-dialog');
      }
    }
    // Si feedbackShown était déjà true (l'utilisateur a re-cliqué X pendant
    // que la modale est ouverte), on l'ignore — la modale gère le close.
  });

  mainWindow = win;
  return win;
}

// État de fermeture (beta feedback) — module-level pour partage entre createWindow et l'IPC handler
let feedbackShown = false;
let allowClose = false;
// Vrai quand l'utilisateur a cliqué « Installer maintenant » dans le bandeau
// de mise à jour : on bascule alors le close-intercept sur le dialogue
// « mise à jour en cours » au lieu du formulaire de retour bêta.
let updaterTriggeredClose = false;

app.whenReady().then(async () => {
  await storage.init();

  // Hide native menu bar on Windows/Linux (we use a custom UI)
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }

  // ----- Auto-updater IPC (init happens after createWindow, see below) -----
  ipcMain.handle('updater:check', () => checkForUpdates());
  ipcMain.handle('updater:install', () => {
    updaterTriggeredClose = true;
    quitAndInstall();
  });
  ipcMain.handle('updater:status', () => getUpdateStatus());

  // ----- IPC handlers -----
  ipcMain.handle('index:list', () => storage.listIndex());
  ipcMain.handle('note:get', (_e, id: string) => storage.getNote(id));
  ipcMain.handle('note:create', (_e, notebookId: string, seed) => storage.createNote(notebookId, seed));
  ipcMain.handle('note:save', (_e, patch, opts) => storage.saveNote(patch, opts));
  ipcMain.handle('note:trash', (_e, id: string, trashed: boolean) => storage.trashNote(id, trashed));
  ipcMain.handle('note:delete', (_e, id: string) => storage.deleteNoteForever(id));
  ipcMain.handle('note:duplicate', (_e, id: string) => storage.duplicateNote(id));
  ipcMain.handle('note:bulkPatch', (_e, ids: string[], patch) => storage.bulkPatch(ids, patch));
  ipcMain.handle('tag:rename', (_e, from: string, to: string) => storage.renameTag(from, to));
  ipcMain.handle('note:move', (_e, ids: string[], notebookId: string) => storage.moveNotes(ids, notebookId));
  ipcMain.handle('note:emptyTrash', () => storage.emptyTrash());

  ipcMain.handle('notebook:create', (_e, name: string, stackId: string | null) => storage.createNotebook(name, stackId));
  ipcMain.handle('notebook:rename', (_e, id: string, name: string) => storage.renameNotebook(id, name));
  ipcMain.handle('notebook:setStack', (_e, id: string, stackId: string | null) => storage.setNotebookStack(id, stackId));
  ipcMain.handle('notebook:delete', (_e, id: string) => storage.deleteNotebook(id));

  ipcMain.handle('stack:create', (_e, name: string) => storage.createStack(name));
  ipcMain.handle('stack:rename', (_e, id: string, name: string) => storage.renameStack(id, name));
  ipcMain.handle('stack:delete', (_e, id: string) => storage.deleteStack(id));

  ipcMain.handle('note:search', (_e, q: string) => storage.searchNotes(q));

  ipcMain.handle('snap:list', (_e, noteId: string) => storage.listSnapshots(noteId));
  ipcMain.handle('snap:restore', (_e, snapId: string, noteId: string) => storage.restoreSnapshot(snapId, noteId));

  ipcMain.handle('tpl:list', () => storage.listTemplates());
  ipcMain.handle('tpl:save', (_e, t) => storage.saveTemplate(t));
  ipcMain.handle('tpl:delete', (_e, id: string) => storage.deleteTemplate(id));
  ipcMain.handle('tpl:create', (_e, notebookId: string, templateId: string) => storage.createNoteFromTemplate(notebookId, templateId));

  ipcMain.handle('export:all', () => storage.exportAll());
  ipcMain.handle('import:all', () => storage.importBundle());
  ipcMain.handle('export:note', (_e, id: string, fmt, body: string) => storage.exportNote(id, fmt, body));
  ipcMain.handle('import:text', (_e, notebookId: string) => storage.importTextFile(notebookId));
  ipcMain.handle('backup:now', () => storage.backupNow());
  ipcMain.handle('app:dataDir', () => storage.getDataDir());
  ipcMain.handle('shell:openPath', (_e, p: string) => shell.openPath(p));

  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximizeToggle', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  // Receive a transparent PNG (data URL) from the renderer and apply it as the window/taskbar icon.
  ipcMain.handle('window:setIcon', (_e, dataUrl: string) => {
    if (!mainWindow || !dataUrl) return;
    try {
      const img = nativeImage.createFromDataURL(dataUrl);
      if (!img.isEmpty()) mainWindow.setIcon(img);
    } catch { /* ignore */ }
  });

  // ----- Attachments -----
  ipcMain.handle('attach:save', async (_e, noteId: string, filename: string, mime: string, bytes: ArrayBuffer) => {
    return storage.saveAttachment(noteId, filename, mime, Buffer.from(bytes));
  });
  ipcMain.handle('attach:open', async (_e, noteId: string, attachmentId: string, filename: string) => {
    const p = await storage.getAttachmentPath(noteId, attachmentId, filename);
    if (existsSync(p)) await shell.openPath(p);
  });
  ipcMain.handle('attach:read', async (_e, noteId: string, attachmentId: string, filename: string) => {
    const buf = await storage.readAttachment(noteId, attachmentId, filename);
    return buf ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : null;
  });
  ipcMain.handle('attach:delete', async (_e, noteId: string, attachmentId: string, filename: string) => {
    await storage.deleteAttachment(noteId, attachmentId, filename);
  });

  // ----- Saved searches -----
  ipcMain.handle('search:list', () => storage.listSavedSearches());
  ipcMain.handle('search:save', (_e, name: string, query: string) => storage.saveSavedSearch(name, query));
  ipcMain.handle('search:delete', (_e, id: string) => storage.deleteSavedSearch(id));

  // ----- Reminders + OS notifications -----
  ipcMain.handle('rem:list', () => storage.listReminders());
  ipcMain.handle('rem:save', async (_e, r) => {
    const saved = await storage.saveReminder(r);
    scheduleReminder(saved);
    return saved;
  });
  ipcMain.handle('rem:delete', (_e, id: string) => storage.deleteReminder(id));
  // Reschedule on launch
  storage.listReminders().then((rs) => rs.forEach(scheduleReminder));

  // ----- ENEX import -----
  ipcMain.handle('enex:import', () => storage.importEnex());
  ipcMain.handle('folder:import', () => storage.importFolder());
  ipcMain.handle('pdf:import', () => storage.importPdfs());

  // Contacts
  ipcMain.handle('contact:list', () => storage.listContacts());
  ipcMain.handle('contact:save', (_e, c) => storage.saveContact(c));
  ipcMain.handle('contact:delete', (_e, id: string) => storage.deleteContact(id));
  ipcMain.handle('contact:deleteMany', (_e, ids: string[]) => storage.deleteContacts(ids));
  ipcMain.handle('cal:list', () => storage.listCalendarEvents());
  ipcMain.handle('cal:save', (_e, e) => storage.saveCalendarEvent(e));
  ipcMain.handle('cal:delete', (_e, id: string) => storage.deleteCalendarEvent(id));
  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));

  // ----- PDF export of current note -----
  ipcMain.handle('pdf:export', async (_e, suggestedName: string) => {
    if (!mainWindow) return { ok: false as const, reason: 'no window' };
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter en PDF',
      defaultPath: `${suggestedName.replace(/[^a-z0-9 _-]/gi, '_').slice(0, 80) || 'Sans titre'}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (res.canceled || !res.filePath) return { ok: false as const, reason: 'cancelled' };
    try {
      const data = await mainWindow.webContents.printToPDF({
        printBackground: true,
        landscape: false,
        pageSize: 'A4',
        margins: { top: 0.5, bottom: 0.5, left: 0.6, right: 0.6 },
      });
      await fsp.writeFile(res.filePath, data);
      return { ok: true as const, path: res.filePath };
    } catch (e: any) {
      return { ok: false as const, reason: e?.message ?? 'error' };
    }
  });

  // ----- Medications -----
  ipcMain.handle('med:list', () => storage.listMedications());
  ipcMain.handle('med:save', (_e, m) => storage.saveMedication(m));
  ipcMain.handle('med:delete', (_e, id: string) => storage.deleteMedication(id));
  ipcMain.handle('intake:list', () => storage.listIntakes());
  ipcMain.handle('intake:mark', (_e, medId: string, scheduledFor: number, taken: boolean, skipped?: boolean) =>
    storage.markIntake(medId, scheduledFor, taken, !!skipped),
  );
  ipcMain.handle('intake:clear', (_e, medId: string, scheduledFor: number) =>
    storage.clearIntake(medId, scheduledFor),
  );
  ipcMain.handle('med:notify', (_e, title: string, body: string) => {
    try {
      new Notification({ title, body, silent: false }).show();
    } catch { /* ignore */ }
  });

  // ----- Generic data-file primitives (CRDT/sync layer) -----
  ipcMain.handle('data:read', (_e, rel: string) => storage.readDataFile(rel));
  ipcMain.handle('data:write', (_e, rel: string, bytes: ArrayBuffer) => storage.writeDataFile(rel, bytes));
  ipcMain.handle('data:list', (_e, relDir: string) => storage.listDataFiles(relDir));
  ipcMain.handle('data:delete', (_e, rel: string) => storage.deleteDataFile(rel));

  // ----- Web Clipper local HTTP server -----
  // Disabled by default. The renderer enables it via IPC when the user opts in
  // (Settings → App features → "Web Clipper local server"). Antivirus software
  // routinely flags listening ports — keeping this OFF avoids false positives.
  ipcMain.handle('clipper:start', () => startClipperServer());
  ipcMain.handle('clipper:stop', () => stopClipperServer());

  // ----- Beta : feedback dialog confirmation -----
  // Appelé par le renderer quand l'utilisateur a fini avec FeedbackDialog
  // (a cliqué Envoyer ou Pas maintenant). On positionne allowClose pour que
  // le prochain win.close() laisse réellement la fenêtre se fermer.
  ipcMain.handle('app:confirm-close', () => {
    allowClose = true;
    mainWindow?.close();
  });

  await createWindow();

  // Now that the main window exists, wire up the auto-updater. The first
  // remote check fires ~4 s later so it doesn't compete with renderer boot.
  if (mainWindow) initUpdater(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- Reminder scheduler ----------
const reminderTimers = new Map<string, NodeJS.Timeout>();
function scheduleReminder(r: storage.Reminder) {
  const existing = reminderTimers.get(r.id);
  if (existing) clearTimeout(existing);
  if (r.done) return;
  const delay = r.due - Date.now();
  if (delay < 0) return; // missed; could fire immediately but we skip
  const tm = setTimeout(() => {
    try {
      new Notification({
        title: 'DéliNote',
        body: r.title || 'Rappel',
        silent: false,
      }).on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
          mainWindow.webContents.send('reminder:fired', r);
        }
      }).show();
    } catch { /* ignore */ }
  }, Math.min(delay, 0x7fffffff));
  reminderTimers.set(r.id, tm);
}

// ---------- Web Clipper local HTTP server ----------
// Listens on http://127.0.0.1:38217 and accepts POST /clip with JSON {title, html, url}.
// A companion Chrome extension (see /clipper-extension/) sends pages here.
// Off by default to avoid antivirus false-positives.
let clipperServer: http.Server | null = null;
function stopClipperServer() {
  if (clipperServer) { clipperServer.close(); clipperServer = null; }
}
function startClipperServer() {
  if (clipperServer) return;
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method === 'GET' && req.url === '/ping') { res.writeHead(200); res.end('DéliNote'); return; }
    if (req.method !== 'POST' || req.url !== '/clip') { res.writeHead(404); res.end(); return; }
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const title: string = (body.title || 'Page web clipée').slice(0, 200);
        const url: string = body.url || '';
        const html: string = body.html || '';
        const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        const idx = await storage.listIndex();
        let nb = idx.notebooks.find((n) => n.name === 'Web Clipper');
        if (!nb) nb = await storage.createNotebook('Web Clipper', null);
        const seedDoc = JSON.stringify({
          type: 'doc',
          content: [
            ...(url ? [{ type: 'paragraph', content: [
              { type: 'text', marks: [{ type: 'link', attrs: { href: url } }], text: url },
            ] }] : []),
            { type: 'paragraph', content: text ? [{ type: 'text', text: text.slice(0, 8000) }] : [] },
          ],
        });
        const note = await storage.createNote(nb.id, { title, content: seedDoc });
        await storage.saveNote({ id: note.id, text });
        if (mainWindow) mainWindow.webContents.send('clipper:received', { id: note.id, title });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: note.id }));
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e?.message ?? 'error' }));
      }
    });
  });
  server.listen(38217, '127.0.0.1', () => { clipperServer = server; });
  server.on('error', () => { clipperServer = null; });
}
