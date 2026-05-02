import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';

/**
 * Dialogue affiché à la place du FeedbackDialog quand la fermeture de l'app
 * a été déclenchée par l'auto-updater (clic sur « Installer maintenant »).
 *
 * Explique à l'utilisateur ce qui va se passer (l'app va se fermer, l'installeur
 * va tourner, l'app va se relancer toute seule), puis appelle `onConfirmClose`
 * pour autoriser la fermeture.
 *
 * Une petite barre de progression visuelle (3 secondes) donne au lecteur le
 * temps de lire avant la fermeture, et un bouton « Continuer » lui permet de
 * raccourcir s'il a déjà compris.
 */
export default function UpdatingDialog({ onConfirmClose }: { onConfirmClose: () => void }) {
  const [progress, setProgress] = useState(0);
  const DURATION_MS = 3000;

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, (elapsed / DURATION_MS) * 100);
      setProgress(p);
      if (p < 100) requestAnimationFrame(tick);
      else onConfirmClose();
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [onConfirmClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(11,11,15,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Installation de la mise à jour en cours"
    >
      <div className="theme-card rounded-2xl shadow-2xl border theme-border w-full max-w-md p-6 text-center">
        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent-bg-soft)' }}
          >
            <Download size={28} className="theme-accent" />
          </div>
        </div>

        <h3 className="text-lg font-semibold theme-text mb-2 flex items-center justify-center gap-2">
          <RefreshCw size={16} className="theme-accent animate-spin" />
          Installation de la mise à jour
        </h3>

        <p className="text-sm theme-muted leading-relaxed mb-5">
          DéliNote va se fermer pour installer la nouvelle version,
          puis se <strong className="theme-text">relancera automatiquement</strong>.
          <br />
          Aucune action de ta part n'est nécessaire.
        </p>

        <div
          className="w-full h-1.5 rounded-full overflow-hidden mb-5"
          style={{ background: 'var(--border)' }}
        >
          <div
            className="h-full transition-[width] ease-linear"
            style={{ background: 'var(--accent)', width: `${progress}%` }}
          />
        </div>

        <button
          onClick={onConfirmClose}
          className="text-sm px-4 py-2 rounded-lg text-white theme-accent-bg hover:opacity-90 font-medium"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}
