import { useEffect, useRef, useState } from 'react';
import { Mail, X, Send, Copy, Check } from 'lucide-react';
import { useSettings } from '../settings';
import { CURRENT_VERSION } from './WhatsNew';

const FEEDBACK_EMAIL = 'contact@triskell-studio.fr';
const APP_VERSION = CURRENT_VERSION;

/**
 * Many Windows mail handlers (Outlook, Mail, Thunderbird in some configs)
 * decode `mailto:` bodies as Windows-1252, which mangles UTF-8 accents
 * (« é » becomes « Ã© », « — » becomes « â€" »). To prevent that we ASCII-fold
 * the body before percent-encoding it. The original UTF-8 version is offered
 * via the "Copy" button so the user can paste it without loss if they want.
 */
function asciiFold(s: string): string {
  return s
    .replace(/[—–]/g, '-')
    .replace(/[«»]/g, '"')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/**
 * Dialog de feedback affiché à la fermeture de l'app pendant la phase bêta.
 * - L'utilisateur tape ses retours dans la textarea
 * - Bouton "Envoyer" → ouvre le client mail par défaut, pré-rempli vers contact@triskell-studio.fr
 * - Bouton "Pas maintenant" → ferme directement sans envoyer
 *
 * Dans tous les cas (Envoyer ou Skip), `onConfirmClose()` est appelée pour
 * laisser l'app se fermer pour de bon (le main process intercepte le close
 * la première fois et déclenche ce dialog).
 */
export default function FeedbackDialog({ onConfirmClose }: { onConfirmClose: () => void }) {
  const { settings } = useSettings();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  function buildBody(safe: boolean): string {
    const who = settings.firstName?.trim() || 'utilisateur beta';
    const lang = (typeof navigator !== 'undefined' ? navigator.language : 'fr');
    const raw =
      `${text.trim()}\n\n` +
      `— ${who}\n` +
      `\n` +
      `--- (techniques, ne pas effacer si possible) ---\n` +
      `Version : DéliNote v${APP_VERSION}\n` +
      `OS : ${navigator.platform || 'inconnu'}\n` +
      `Langue : ${lang}\n` +
      `Date : ${new Date().toLocaleString(lang)}\n`;
    return safe ? asciiFold(raw) : raw;
  }
  function buildSubject(safe: boolean): string {
    const who = settings.firstName?.trim() || 'utilisateur beta';
    const raw = `DéliNote v${APP_VERSION} — Retour de ${who}`;
    return safe ? asciiFold(raw) : raw;
  }
  async function copyAll() {
    try {
      await navigator.clipboard.writeText(`À : ${FEEDBACK_EMAIL}\nSujet : ${buildSubject(false)}\n\n${buildBody(false)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    // Focus discret après que la modal apparaisse
    const tm = setTimeout(() => textRef.current?.focus(), 80);
    return () => clearTimeout(tm);
  }, []);

  // Esc pour annuler / Cmd+Enter pour envoyer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onConfirmClose(); }
      else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && text.trim()) {
        e.preventDefault();
        send();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    // Use ASCII-folded body in the mailto URL so accents survive Windows mail
    // handlers that decode as Latin-1. Also stash the rich UTF-8 version in
    // the clipboard so the user can paste it if their client supports it.
    const subject = encodeURIComponent(buildSubject(true));
    const body = encodeURIComponent(buildBody(true));
    void navigator.clipboard.writeText(buildBody(false)).catch(() => { /* ignore */ });
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    try { (window as any).nv?.openExternal?.(url); } catch { /* ignore */ }
    setTimeout(onConfirmClose, 300);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(11,11,15,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Donner un retour avant de fermer DéliNote"
    >
      <div className="theme-card rounded-2xl shadow-2xl border theme-border w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold theme-text">Avant de partir…</h3>
            <p className="text-sm theme-muted mt-1">
              DéliNote est en bêta — un mot, un bug, une idée à partager&nbsp;?
            </p>
          </div>
          <button
            onClick={onConfirmClose}
            className="theme-muted hover:theme-text p-1 -mt-1 -mr-1"
            aria-label="Fermer sans envoyer"
            title="Fermer sans envoyer (Échap)"
          >
            <X size={18} />
          </button>
        </div>

        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ce qui marche, ce qui bug, ce qui manque, une idée, un mot d'encouragement… Tout est utile."
          rows={6}
          maxLength={4000}
          className="w-full theme-input rounded-lg p-3 text-sm outline-none resize-none leading-relaxed"
          style={{ minHeight: 130 }}
        />

        <div className="flex items-center justify-between gap-2 mt-4">
          <button
            onClick={onConfirmClose}
            className="text-sm theme-muted hover:theme-text px-3 py-2"
            disabled={sending}
          >
            Pas maintenant
          </button>
          <div className="flex gap-2">
            <button
              onClick={copyAll}
              disabled={!text.trim()}
              className="text-sm px-3 py-2 rounded-lg theme-card border theme-border-soft hover:theme-hover theme-text disabled:opacity-40 inline-flex items-center gap-1.5"
              title="Copier le message complet (avec accents) dans le presse-papier"
            >
              {copied ? <><Check size={14} className="text-green-500" /> Copié</> : <><Copy size={14} /> Copier</>}
            </button>
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="text-sm px-4 py-2 rounded-lg text-white theme-accent-bg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 font-medium"
            >
              {sending ? <>Envoi…</> : <><Send size={14} /> Envoyer</>}
            </button>
          </div>
        </div>

        <p className="text-[11px] theme-muted mt-3 text-center leading-snug">
          Votre client mail s'ouvrira pré-rempli vers <span className="theme-text font-medium">{FEEDBACK_EMAIL}</span>.
          Si les accents s'affichent mal, cliquez « Copier » et collez le contenu — la version riche est dans votre presse-papier.
          <br />Astuce&nbsp;: <kbd className="font-mono">Ctrl</kbd>+<kbd className="font-mono">Entrée</kbd> pour envoyer · <kbd className="font-mono">Échap</kbd> pour passer.
        </p>
      </div>
    </div>
  );
}
