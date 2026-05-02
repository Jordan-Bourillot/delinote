// Auto-update layer using electron-updater.
//
// Flow:
//   1. App starts → renderer calls `updater:check` (or auto on launch).
//   2. updater pings GitHub Releases for the latest published version.
//   3. If a newer version exists → it's downloaded silently in the background.
//   4. When the download completes, renderer is notified ('updater:status').
//   5. User clicks "Install now" → app quits and the new version starts.
//
// Notes:
//   - The publish target is configured in package.json (build.publish[0]).
//   - electron-updater reads the same config at runtime via app-update.yml,
//     which electron-builder bakes into the asar at build time.
//   - In dev mode (`npm run dev`) the updater is a no-op — it only runs in
//     packaged builds. We log instead.

import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

export type UpdateStatus =
  | { phase: 'idle'; currentVersion: string }
  | { phase: 'checking'; currentVersion: string }
  | { phase: 'available'; currentVersion: string; nextVersion: string; releaseNotes?: string }
  | { phase: 'not-available'; currentVersion: string }
  | { phase: 'downloading'; currentVersion: string; nextVersion: string; percent: number; bytesPerSecond: number }
  | { phase: 'ready'; currentVersion: string; nextVersion: string }
  | { phase: 'error'; currentVersion: string; message: string };

let lastStatus: UpdateStatus = { phase: 'idle', currentVersion: app.getVersion() };
let mainWindowRef: BrowserWindow | null = null;

function broadcast(status: UpdateStatus) {
  lastStatus = status;
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('updater:status', status);
  }
}

/**
 * Wire electron-updater event listeners. Call once during app startup, after
 * the main window has been created. Renderer subscribes via `updater:status`.
 */
export function initUpdater(mainWindow: BrowserWindow) {
  mainWindowRef = mainWindow;

  // We control the install ourselves (don't auto-quit & install on download —
  // give the user a chance to finish what they're doing).
  autoUpdater.autoDownload = true;            // download silently in the background
  autoUpdater.autoInstallOnAppQuit = true;    // install at next normal quit too
  autoUpdater.allowDowngrade = false;
  // Forward electron-log-style messages to console for debugging.
  autoUpdater.logger = {
    info: (m: any) => console.log('[updater]', m),
    warn: (m: any) => console.warn('[updater]', m),
    error: (m: any) => console.error('[updater]', m),
    debug: (m: any) => console.debug('[updater]', m),
  } as any;

  autoUpdater.on('checking-for-update', () => {
    broadcast({ phase: 'checking', currentVersion: app.getVersion() });
  });

  autoUpdater.on('update-available', (info) => {
    broadcast({
      phase: 'available',
      currentVersion: app.getVersion(),
      nextVersion: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    });
  });

  autoUpdater.on('update-not-available', () => {
    broadcast({ phase: 'not-available', currentVersion: app.getVersion() });
  });

  autoUpdater.on('download-progress', (p) => {
    broadcast({
      phase: 'downloading',
      currentVersion: app.getVersion(),
      nextVersion: lastStatus.phase === 'available' || lastStatus.phase === 'downloading' ? (lastStatus as any).nextVersion : '',
      percent: Math.round(p.percent),
      bytesPerSecond: Math.round(p.bytesPerSecond),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    broadcast({
      phase: 'ready',
      currentVersion: app.getVersion(),
      nextVersion: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    broadcast({
      phase: 'error',
      currentVersion: app.getVersion(),
      message: err?.message || String(err),
    });
  });

  // First check, slightly delayed so it doesn't block app startup.
  if (app.isPackaged) {
    setTimeout(() => {
      checkForUpdates().catch(() => { /* swallowed — error broadcast above */ });
    }, 4000);
  } else {
    console.log('[updater] dev mode — auto-update disabled');
  }
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    broadcast({ phase: 'not-available', currentVersion: app.getVersion() });
    return;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (e: any) {
    broadcast({
      phase: 'error',
      currentVersion: app.getVersion(),
      message: e?.message || String(e),
    });
  }
}

/**
 * Quit the app and install the downloaded update. Only valid when status is
 * 'ready' — no-op otherwise.
 */
export function quitAndInstall(): void {
  if (lastStatus.phase !== 'ready') return;
  // isSilent=false → show NSIS progress bar so the user sees what's happening
  //   during the ~10 s the .exe is replaced (instead of a black gap).
  // isForceRunAfter=true → relaunch DéliNote automatically once installed.
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
}

export function getStatus(): UpdateStatus {
  return lastStatus;
}
