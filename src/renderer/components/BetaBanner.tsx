import { useState } from 'react';
import { X, Mail, FlaskConical } from 'lucide-react';
import { TRISKELL_URL } from './TriskellMark';

const SESSION_DISMISS_KEY = 'delinote.beta-banner.dismissed-this-session';
const FEEDBACK_EMAIL = 'contact@triskell-studio.fr';

/**
 * Bandeau "DéliNote est en bêta" affiché en haut de l'app à chaque ouverture.
 * Contient l'email cliquable pour faire des retours. Dismissable pour la
 * session courante (pas de persistance localStorage : on veut le rappel à
 * chaque relance pendant la phase de bêta-test).
 */
export default function BetaBanner() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'; } catch { return false; }
  });

  if (dismissed) return null;

  function dismiss() {
    try { sessionStorage.setItem(SESSION_DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  }

  function openMail(e: React.MouseEvent) {
    e.preventDefault();
    const subject = encodeURIComponent('DéliNote bêta — Mon retour');
    const body = encodeURIComponent(
      'Bonjour Triskell Studio,\n\n' +
      'Mon retour sur la bêta de DéliNote :\n\n' +
      '— \n\n' +
      '(Version, OS et description du contexte si pertinent)\n'
    );
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    try { (window as any).nv?.openExternal?.(url); } catch { /* ignore */ }
  }

  return (
    <div
      role="status"
      aria-label="DéliNote est en version bêta"
      className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs theme-bg-soft border-b theme-border-soft"
      style={{ flexShrink: 0 }}
    >
      <FlaskConical size={13} className="theme-accent shrink-0" />
      <span className="font-semibold theme-accent tracking-wide">BÊTA</span>
      <span className="theme-muted">·  Vos retours sont précieux :</span>
      <button
        onClick={openMail}
        className="theme-accent hover:underline font-medium inline-flex items-center gap-1"
        title={`Écrire à ${FEEDBACK_EMAIL}`}
      >
        <Mail size={12} /> {FEEDBACK_EMAIL}
      </button>
      <button
        onClick={dismiss}
        className="ml-3 theme-muted hover:theme-text"
        title="Masquer pour cette session"
        aria-label="Masquer le bandeau bêta"
      >
        <X size={14} />
      </button>
    </div>
  );
}
