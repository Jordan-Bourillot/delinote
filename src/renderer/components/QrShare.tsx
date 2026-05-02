import { useEffect, useMemo, useRef, useState } from 'react';
import { QrCode, X, Copy, Loader2, ExternalLink, Wifi, ShieldAlert, Power, Eye, Edit3 } from 'lucide-react';
import QRCode from 'qrcode';
import { useStore } from '../store';
import { generateHTML } from '@tiptap/html';
import { buildExtensions } from '../editorExtensions';
import { useSettings } from '../settings';

/**
 * QR Share — local-network sharing.
 *
 * Two flavours:
 *   1. Lecture seule  : the page is fully rendered HTML. Phone reads, can't write.
 *   2. Mode live      : the page is a `contenteditable` that bidirectionally
 *      syncs with the host via SSE (peer ⇐ host) and POST (peer ⇒ host).
 *      Host edits in DéliNote → SSE pushes to phone(s). Phone edits → IPC
 *      'share:peer-update' → applied to the open note via patchCurrent.
 *
 * Caveats kept honest in the UI:
 *   - Both devices must be on the same Wi-Fi
 *   - A firewall may block the port — we surface the failure case
 *   - Live mode syncs PLAIN TEXT only — rich formatting from Tiptap isn't
 *     transmitted over the live channel (the host editor still keeps its
 *     formatting locally; peers see/edit a flattened view).
 */

type ShareStatus =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; url: string; urls: string[]; key: string; port: number; expiresAt: number; qr: string; live: boolean }
  | { kind: 'error'; message: string };

export default function QrShare({ onClose }: { onClose: () => void }) {
  const current = useStore((s) => s.current);
  const patchCurrent = useStore((s) => s.patchCurrent);
  const flushSave = useStore((s) => s.flushSave);
  const toast = useStore((s) => s.toast);
  const settings = useSettings((s) => s.settings);
  const [status, setStatus] = useState<ShareStatus>({ kind: 'idle' });
  const [mode, setMode] = useState<'readonly' | 'live'>('readonly');

  const extensions = useMemo(() => buildExtensions(settings), [settings]);

  // Track the latest version we know about (per-session) to ignore stale echoes.
  const lastVersionRef = useRef(0);
  // Suppress the next host→peer push when we know the change came FROM the peer.
  const suppressNextPushRef = useRef(false);

  async function startShare(live: boolean) {
    if (!current) return;
    setStatus({ kind: 'starting' });
    try {
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
        live,
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
      lastVersionRef.current = 1;
      setStatus({ kind: 'running', ...r, qr, live });
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

  // === LIVE MODE ===
  // Listen for peer updates → apply to the current note.
  useEffect(() => {
    if (status.kind !== 'running' || !status.live) return;
    const off = (window as any).nv.onSharePeerUpdate((info: any) => {
      if (info.key !== status.key) return;
      if (info.version <= lastVersionRef.current) return;
      lastVersionRef.current = info.version;
      // Apply title + text to the current note. We don't touch `content`
      // (Tiptap JSON) directly because plain-text sync would otherwise wipe
      // formatting; instead we update title + text (search index) only.
      // The user can still edit the rich content normally; live sync only
      // covers raw text.
      suppressNextPushRef.current = true;
      patchCurrent({ title: info.title, text: info.text });
    });
    return () => { try { off?.(); } catch { /* ignore */ } };
  }, [status, patchCurrent]);

  // Push host-side title/text changes to peers (debounced).
  useEffect(() => {
    if (status.kind !== 'running' || !status.live || !current) return;
    if (suppressNextPushRef.current) {
      suppressNextPushRef.current = false;
      return;
    }
    const id = setTimeout(() => {
      void (window as any).nv.shareHostUpdate({
        key: status.key,
        title: current.title || 'Sans titre',
        text: current.text || '',
      }).then((v: number | null) => {
        if (typeof v === 'number') lastVersionRef.current = v;
      }).catch(() => { /* ignore */ });
    }, 350);
    return () => clearTimeout(id);
  }, [status, current?.title, current?.text]);

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
      <Header
        onClose={onClose}
        title={`Partage QR — ${current.title || 'Sans titre'}`}
      />

      {status.kind === 'idle' && (
        <div className="px-5 py-5 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full theme-accent-bg-soft flex items-center justify-center">
            <Wifi size={28} className="theme-accent" />
          </div>

          <div className="w-full theme-input rounded-lg p-1 grid grid-cols-2 gap-1">
            <ModeButton
              active={mode === 'readonly'}
              onClick={() => setMode('readonly')}
              icon={<Eye size={14} />}
              label="Lecture seule"
              hint="Le téléphone affiche, ne modifie pas"
            />
            <ModeButton
              active={mode === 'live'}
              onClick={() => setMode('live')}
              icon={<Edit3 size={14} />}
              label="Mode live"
              hint="Édition synchronisée des deux côtés"
            />
          </div>

          <p className="text-sm theme-text text-center max-w-sm leading-relaxed">
            {mode === 'live' ? (
              <>Le téléphone et ton ordi <strong>partagent la même note en direct</strong>.
              Tape ici → ton ami voit. Il tape là-bas → tu vois.</>
            ) : (
              <>Ton ami voit la note dans son navigateur, version figée et formatée.
              Aucune modif possible côté téléphone.</>
            )}
          </p>
          <p className="text-xs theme-muted text-center max-w-sm leading-relaxed">
            🔒 Tout reste sur ton réseau Wi-Fi local. Aucun cloud, aucun compte.
          </p>

          <button
            onClick={() => void startShare(mode === 'live')}
            className="text-sm px-4 py-2 rounded-lg theme-accent-bg text-white hover:opacity-90 inline-flex items-center gap-2 mt-1"
          >
            <Power size={14} /> Lancer le partage
          </button>
          <p className="text-[11px] theme-muted text-center max-w-sm">
            ⚠️ Si Windows demande l&apos;autorisation pare-feu, choisis « Réseau privé ».
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
            onClick={() => void startShare(mode === 'live')}
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
          live={status.live}
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
        {status.kind === 'running' && status.live ? (
          <>🔄 <strong>Mode live</strong> · Le texte se synchronise des deux côtés. Le formatage Tiptap reste local — seuls le titre et le texte brut sont partagés.</>
        ) : status.kind === 'running' ? (
          <>👁 Mode lecture seule. Pour synchroniser dans les deux sens, arrête et relance en « Mode live ».</>
        ) : (
          <>Le mode live partage le texte brut + le titre. Pour de l&apos;édition collaborative riche (formatage), reste à venir.</>
        )}
      </div>
    </Panel>
  );
}

function ModeButton({
  active, onClick, icon, label, hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-2.5 py-2 rounded-md transition ${active ? 'theme-card shadow-sm' : 'theme-muted hover:theme-text'}`}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold theme-text">
        {icon} {label}
      </div>
      <div className="text-[10px] theme-muted mt-0.5 leading-tight">{hint}</div>
    </button>
  );
}

function RunningView({
  url, urls, expiresAt, qr, live, onCopy, onOpen, onStop,
}: {
  url: string;
  urls: string[];
  expiresAt: number;
  qr: string;
  live: boolean;
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
      <div className="rounded-2xl shadow-lg p-3 bg-white relative">
        <img src={qr} alt="QR code de partage" className="block w-[260px] h-[260px]" />
        {live && (
          <span
            className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow"
            style={{ background: '#22c55e' }}
          >
            ● LIVE
          </span>
        )}
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
