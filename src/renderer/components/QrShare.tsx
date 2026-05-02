import { useEffect, useMemo, useState } from 'react';
import { QrCode, X, Copy, Loader2, ExternalLink, Wifi, ShieldAlert, Power } from 'lucide-react';
import QRCode from 'qrcode';
import { useStore } from '../store';
import { generateHTML } from '@tiptap/html';
import { buildExtensions } from '../editorExtensions';
import { useSettings } from '../settings';

/**
 * QR Share — local-network sharing.
 *
 * Spins up an HTTP server in the main process bound to 0.0.0.0:<random>,
 * then encodes a URL like `http://<your-LAN-ip>:<port>/s/<key>` into a QR.
 * Anyone on the same Wi-Fi who scans the QR opens the note in their phone
 * browser instantly — no app, no account, no cloud round-trip.
 *
 * The server auto-stops after 1 hour, or when the user clicks « Arrêter
 * le partage » in this dialog. The render layer renders the note to HTML
 * locally before sending it over IPC, so the main process never has to
 * touch Tiptap.
 *
 * Caveats kept honest in the UI:
 *   - Both devices must be on the same Wi-Fi
 *   - A firewall may block the port — we surface the failure case
 *   - Read-only for now: edits made on the phone don't sync back
 */

type ShareStatus =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; url: string; urls: string[]; key: string; port: number; expiresAt: number; qr: string }
  | { kind: 'error'; message: string };

export default function QrShare({ onClose }: { onClose: () => void }) {
  const current = useStore((s) => s.current);
  const toast = useStore((s) => s.toast);
  const settings = useSettings((s) => s.settings);
  const [status, setStatus] = useState<ShareStatus>({ kind: 'idle' });

  const extensions = useMemo(() => buildExtensions(settings), [settings]);

  async function startShare() {
    if (!current) return;
    setStatus({ kind: 'starting' });
    try {
      // Render the note to standalone HTML in the renderer (where we have
      // the Tiptap extensions) before handing it to the main process.
      let html = '';
      try {
        const json = JSON.parse(current.content || '{"type":"doc","content":[]}');
        html = generateHTML(json, extensions);
      } catch {
        html = `<pre>${(current.text || '').replace(/[<>&]/g, (c) =>
          ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' } as any)[c])}</pre>`;
      }
      const r = await (window as any).nv.shareStart({
        noteId: current.id,
        title: current.title || 'Sans titre',
        html,
        text: current.text || '',
      });
      if (!r) {
        setStatus({ kind: 'error', message: 'Impossible de démarrer le serveur (port occupé ou réseau indisponible).' });
        return;
      }
      const qr = await QRCode.toDataURL(r.url, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 360,
        color: { dark: '#1B2330', light: '#FFFFFF' },
      });
      setStatus({ kind: 'running', ...r, qr });
    } catch (e: any) {
      setStatus({ kind: 'error', message: String(e?.message ?? e) });
    }
  }

  async function stopShare() {
    if (status.kind !== 'running') return;
    try { await (window as any).nv.shareStop(status.key); } catch { /* ignore */ }
    setStatus({ kind: 'idle' });
  }

  // Stop the share when the dialog closes (don't leave a server running).
  useEffect(() => {
    return () => {
      if (status.kind === 'running') {
        void (window as any).nv.shareStop(status.key);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!current) {
    return (
      <Panel onClose={onClose}>
        <Header onClose={onClose} title="Partage QR" />
        <div className="text-sm theme-muted text-center py-8 px-6">
          Ouvre une note avant de la partager.
        </div>
      </Panel>
    );
  }

  return (
    <Panel onClose={onClose}>
      <Header onClose={onClose} title={`Partage QR — ${current.title || 'Sans titre'}`} />

      {status.kind === 'idle' && (
        <div className="px-5 py-6 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full theme-accent-bg-soft flex items-center justify-center">
            <Wifi size={28} className="theme-accent" />
          </div>
          <p className="text-sm theme-text text-center max-w-sm leading-relaxed">
            Ton téléphone (ou celui d&apos;un ami) doit être sur le <strong>même réseau Wi-Fi</strong> que ton ordi.
            Un mini-serveur va se lancer sur ton ordi, qui servira cette note pendant <strong>1 heure</strong>.
          </p>
          <p className="text-xs theme-muted text-center max-w-sm leading-relaxed">
            🔒 Aucun cloud, aucun compte. Le contenu reste sur ton réseau local.
          </p>
          <button
            onClick={() => void startShare()}
            className="text-sm px-4 py-2 rounded-lg theme-accent-bg text-white hover:opacity-90 inline-flex items-center gap-2 mt-2"
          >
            <Power size={14} /> Lancer le partage
          </button>
          <p className="text-[11px] theme-muted text-center max-w-sm">
            ⚠️ Si Windows demande l&apos;autorisation pare-feu, choisis « Réseau privé ». Sans ça, tes appareils ne pourront pas joindre le serveur.
          </p>
        </div>
      )}

      {status.kind === 'starting' && (
        <div className="px-5 py-12 flex flex-col items-center gap-3 text-sm theme-muted">
          <Loader2 size={20} className="animate-spin theme-accent" />
          Démarrage du serveur local…
        </div>
      )}

      {status.kind === 'error' && (
        <div className="px-5 py-6 text-sm">
          <div className="flex items-center gap-2 text-red-500 font-semibold mb-2">
            <ShieldAlert size={16} /> Échec
          </div>
          <p className="theme-muted text-xs leading-relaxed">{status.message}</p>
          <button
            onClick={() => void startShare()}
            className="mt-4 text-xs px-3 py-1.5 rounded theme-input hover:theme-hover"
          >
            Réessayer
          </button>
        </div>
      )}

      {status.kind === 'running' && (
        <RunningView
          url={status.url}
          urls={status.urls}
          expiresAt={status.expiresAt}
          qr={status.qr}
          onCopy={() => {
            navigator.clipboard.writeText(status.url)
              .then(() => toast('success', 'URL copiée'))
              .catch(() => toast('error', 'Impossible de copier'));
          }}
          onOpen={() => (window as any).nv?.openExternal?.(status.url)}
          onStop={() => void stopShare()}
        />
      )}

      <div className="px-4 py-3 border-t theme-border-soft text-[11px] theme-muted">
        Lecture seule : pour l&apos;instant, les modifs faites sur le téléphone ne reviennent pas vers ta note.
        La collaboration en temps réel est dans la roadmap.
      </div>
    </Panel>
  );
}

function RunningView({
  url, urls, expiresAt, qr, onCopy, onOpen, onStop,
}: {
  url: string;
  urls: string[];
  expiresAt: number;
  qr: string;
  onCopy: () => void;
  onOpen: () => void;
  onStop: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remainingMs = Math.max(0, expiresAt - now);
  const min = Math.floor(remainingMs / 60000);
  const sec = Math.floor((remainingMs % 60000) / 1000);

  return (
    <div className="px-5 py-5 flex flex-col items-center gap-3">
      <div className="rounded-2xl shadow-lg p-3 bg-white">
        <img src={qr} alt="QR code de partage" className="block w-[260px] h-[260px]" />
      </div>
      <p className="text-sm theme-text text-center max-w-sm leading-relaxed">
        Scanne avec ton téléphone (appareil photo).
      </p>
      <div className="text-[10px] theme-muted font-mono text-center break-all px-4">{url}</div>
      {urls.length > 1 && (
        <details className="text-[11px] theme-muted">
          <summary className="cursor-pointer hover:theme-text">Autres adresses ({urls.length - 1})</summary>
          <ul className="mt-1 space-y-0.5">
            {urls.filter((u) => u !== url).map((u) => (
              <li key={u} className="font-mono">{u}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
        <button
          onClick={onCopy}
          className="text-xs px-3 py-1.5 rounded-lg theme-input hover:theme-hover inline-flex items-center gap-1.5"
        >
          <Copy size={12} /> Copier le lien
        </button>
        <button
          onClick={onOpen}
          className="text-xs px-3 py-1.5 rounded-lg theme-input hover:theme-hover inline-flex items-center gap-1.5"
        >
          <ExternalLink size={12} /> Ouvrir ici
        </button>
        <button
          onClick={onStop}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 inline-flex items-center gap-1.5"
        >
          <Power size={12} /> Arrêter
        </button>
      </div>

      <div className="text-[11px] theme-muted tabular-nums mt-1">
        Expire dans <span className="font-bold theme-text">{String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}</span>
      </div>
    </div>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="px-4 py-3 border-b theme-border-soft flex items-center gap-2">
      <QrCode size={16} className="theme-accent" />
      <h3 className="text-sm font-semibold theme-text flex-1 truncate">{title}</h3>
      <button onClick={onClose} className="theme-muted hover:theme-text p-1 rounded">
        <X size={14} />
      </button>
    </div>
  );
}

function Panel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(11,11,15,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="theme-card rounded-2xl shadow-2xl border theme-border w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
