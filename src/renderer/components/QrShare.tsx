import { useEffect, useState } from 'react';
import { QrCode, X, Copy, Download, Eye, EyeOff } from 'lucide-react';
import QRCode from 'qrcode';
import { useStore } from '../store';

/**
 * QR Share — generates a QR code containing the open note's text content,
 * shown in a modal so a friend can scan with their phone camera.
 *
 * Privacy guarantees:
 *   - Everything stays on your machine. No upload, no server, no cloud.
 *   - The QR encodes the raw note text — anyone who scans it sees the text.
 *     If your note has secrets, don't share its QR (a hint reminds the user).
 *
 * Implementation notes:
 *   - QR codes have a hard size limit (~2-3 KB of UTF-8 in error-correction L
 *     mode). Long notes are truncated with a warning + a copy-to-clipboard
 *     fallback so you can paste the full text into another channel.
 *   - The QR is generated client-side via the `qrcode` npm package (pure JS,
 *     no network). The result is a data URL we render in an <img>.
 */

const MAX_QR_BYTES = 2200; // safe ceiling for level-L QR with UTF-8 chars

export default function QrShare({ onClose }: { onClose: () => void }) {
  const current = useStore((s) => s.current);
  const toast = useStore((s) => s.toast);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);

  const fullText = current ? `${current.title || 'Sans titre'}\n\n${current.text || ''}`.trim() : '';
  const bytes = new TextEncoder().encode(fullText).length;
  const truncated = bytes > MAX_QR_BYTES;
  const encoded = truncated
    ? trimToBytes(fullText, MAX_QR_BYTES - 30) + '\n\n[…tronqué pour le QR]'
    : fullText;

  useEffect(() => {
    if (!current || !encoded) return;
    let alive = true;
    QRCode.toDataURL(encoded, {
      errorCorrectionLevel: 'L',
      margin: 2,
      width: 360,
      color: { dark: '#1B2330', light: '#FFFFFF' },
    })
      .then((url) => { if (alive) { setDataUrl(url); setError(null); } })
      .catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [encoded, current?.id]);

  if (!current) {
    return (
      <Panel onClose={onClose}>
        <div className="text-sm theme-muted text-center py-8">
          Ouvre une note avant de la partager.
        </div>
      </Panel>
    );
  }

  function copyText() {
    navigator.clipboard.writeText(fullText)
      .then(() => toast('success', 'Texte de la note copié'))
      .catch(() => toast('error', 'Impossible de copier'));
  }

  function downloadQr() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${(current?.title || 'note').replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png`;
    a.click();
  }

  return (
    <Panel onClose={onClose}>
      <div className="px-4 py-3 border-b theme-border-soft flex items-center gap-2">
        <QrCode size={16} className="theme-accent" />
        <h3 className="text-sm font-semibold theme-text flex-1">Partage QR — {current.title || 'Sans titre'}</h3>
        <button onClick={onClose} className="theme-muted hover:theme-text p-1 rounded">
          <X size={14} />
        </button>
      </div>

      <div className="px-4 py-5 flex flex-col items-center gap-4">
        {error && (
          <div className="text-xs text-red-400 text-center">
            Erreur de génération : {error}
          </div>
        )}

        {dataUrl && (
          <div className="rounded-2xl shadow-lg p-3 bg-white">
            <img src={dataUrl} alt="QR code de la note" className="block w-[280px] h-[280px]" />
          </div>
        )}

        <p className="text-xs theme-muted text-center max-w-sm leading-relaxed">
          Demande à ton ami de scanner ce QR avec son téléphone (appareil photo,
          ou n&apos;importe quel scanner QR). Le texte s&apos;affichera directement —
          aucun compte, aucun serveur, aucun cloud n&apos;est impliqué.
        </p>

        {truncated && (
          <div className="text-xs px-3 py-2 rounded theme-card-soft border theme-border-soft text-center max-w-sm">
            ⚠️ Cette note dépasse la limite d&apos;un QR ({(bytes / 1024).toFixed(1)} ko).
            Le QR contient le début ; utilise « Copier tout le texte » pour le reste.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={copyText}
            className="text-xs px-3 py-1.5 rounded-lg theme-input hover:theme-hover inline-flex items-center gap-1.5"
          >
            <Copy size={12} /> Copier tout le texte
          </button>
          <button
            onClick={downloadQr}
            disabled={!dataUrl}
            className="text-xs px-3 py-1.5 rounded-lg theme-input hover:theme-hover inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download size={12} /> Télécharger le QR
          </button>
          <button
            onClick={() => setShowText(!showText)}
            className="text-xs px-3 py-1.5 rounded-lg theme-input hover:theme-hover inline-flex items-center gap-1.5"
          >
            {showText ? <><EyeOff size={12} /> Cacher le texte</> : <><Eye size={12} /> Voir le texte</>}
          </button>
        </div>

        {showText && (
          <pre className="text-[11px] theme-muted whitespace-pre-wrap bg-black/5 dark:bg-white/5 rounded p-3 max-h-40 overflow-y-auto w-full">
            {encoded}
          </pre>
        )}
      </div>

      <div className="px-4 py-3 border-t theme-border-soft text-[11px] theme-muted">
        🔒 Confidentialité : la note est encodée dans le QR ci-dessus. N&apos;importe qui qui le scanne pourra lire le contenu.
        Ne partage pas ce QR si la note contient des secrets.
      </div>
    </Panel>
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

/** Trim a UTF-8 string so its byte length stays ≤ max (without breaking chars). */
function trimToBytes(s: string, max: number): string {
  const enc = new TextEncoder();
  if (enc.encode(s).length <= max) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (enc.encode(s.slice(0, mid)).length <= max) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo);
}
