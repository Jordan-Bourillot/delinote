import { useEffect, useState } from 'react';
import { Download, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { UpdateStatus } from '../types';

const SESSION_DISMISS_KEY = 'delinote.update-banner.dismissed';

/**
 * Top-of-app banner that surfaces auto-update events to the user.
 *
 * Shown when:
 *   - phase === 'available'    : "Mise à jour 0.9.1 disponible — téléchargement en cours"
 *   - phase === 'downloading'  : progress bar, KB/s, percent
 *   - phase === 'ready'        : "Mise à jour téléchargée — Installer maintenant"
 *
 * Hidden when:
 *   - phase === 'idle' / 'checking' / 'not-available' / 'error' (silent — only
 *     visible from the Settings panel, where the user explicitly asked).
 *   - User dismissed for the session (state stored in sessionStorage so it
 *     comes back at next launch if still pending).
 */
export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({
    phase: 'idle',
    currentVersion: '0.0.0',
  });

  useEffect(() => {
    let off: (() => void) | undefined;
    (async () => {
      try {
        const initial = await window.nv.updaterStatus();
        if (initial) setStatus(initial);
      } catch { /* ignore */ }
      off = window.nv.onUpdaterStatus?.((s) => setStatus(s));
    })();
    return () => { try { off?.(); } catch { /* ignore */ } };
  }, []);

  return status;
}

export default function UpdateBanner() {
  const status = useUpdateStatus();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'; } catch { return false; }
  });

  // Re-show the banner if a new phase fires after a previous dismissal.
  useEffect(() => {
    if (status.phase === 'available' || status.phase === 'downloading' || status.phase === 'ready') {
      // OK, keep dismissed state — user already chose
    }
  }, [status.phase]);

  if (dismissed) return null;
  if (status.phase !== 'available' && status.phase !== 'downloading' && status.phase !== 'ready') {
    return null;
  }

  function dismiss() {
    try { sessionStorage.setItem(SESSION_DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  }

  function install() {
    void window.nv.updaterInstall();
  }

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 px-3 py-1.5 text-xs border-b theme-border-soft"
      style={{ background: 'var(--accent-bg-soft)', flexShrink: 0 }}
    >
      {status.phase === 'available' && (
        <>
          <Download size={13} className="theme-accent shrink-0 animate-pulse" />
          <span className="theme-text font-medium">
            Mise à jour <span className="font-bold">{status.nextVersion}</span> disponible
          </span>
          <span className="theme-muted">— téléchargement en cours…</span>
        </>
      )}

      {status.phase === 'downloading' && (
        <>
          <RefreshCw size={13} className="theme-accent shrink-0 animate-spin" />
          <span className="theme-text font-medium">
            Téléchargement {status.nextVersion}…
          </span>
          <div className="w-32 h-1.5 rounded-full bg-black/10 overflow-hidden">
            <div
              className="h-full transition-all"
              style={{ background: 'var(--accent)', width: `${status.percent}%` }}
            />
          </div>
          <span className="theme-muted text-[11px] tabular-nums">
            {status.percent}% · {formatBytes(status.bytesPerSecond)}/s
          </span>
        </>
      )}

      {status.phase === 'ready' && (
        <>
          <CheckCircle2 size={13} className="theme-accent shrink-0" />
          <span className="theme-text font-medium">
            Mise à jour <span className="font-bold">{status.nextVersion}</span> prête à installer
          </span>
          <button
            onClick={install}
            className="ml-1 px-2.5 py-0.5 rounded-md text-white text-[11px] font-semibold hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            Installer maintenant
          </button>
        </>
      )}

      <button
        onClick={dismiss}
        className="ml-2 theme-muted hover:theme-text shrink-0"
        title="Masquer pour cette session"
        aria-label="Masquer le bandeau"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function formatBytes(bps: number): string {
  if (bps < 1024) return `${bps} o`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} ko`;
  return `${(bps / 1024 / 1024).toFixed(2)} Mo`;
}
