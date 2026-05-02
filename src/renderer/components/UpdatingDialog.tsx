import { useEffect, useState } from 'react';
import { Download, RefreshCw, CheckCircle2, Power } from 'lucide-react';

/**
 * Dialogue affiché à la place du FeedbackDialog quand la fermeture de l'app
 * a été déclenchée par l'auto-updater (clic sur « Installer maintenant »).
 *
 * Étapes visibles :
 *   1. "Préparation"      (~1 s)  — on lit le message et le contexte
 *   2. "Fermeture en cours" — on appelle `onConfirmClose()` qui demande à
 *      Electron de fermer l'app. La fenêtre disparaît à ce moment.
 *
 * NB : la dialog ne s'auto-ferme JAMAIS — c'est Electron qui la tue en
 * fermant la fenêtre. Tant qu'elle est visible, l'utilisateur sait que
 * quelque chose se passe (vs. un trou noir entre clic et installeur).
 */
export default function UpdatingDialog({ onConfirmClose }: { onConfirmClose: () => void }) {
  const [phase, setPhase] = useState<'reading' | 'closing'>('reading');

  // Brief 1.2 s "reading" phase to give time to absorb the message,
  // then trigger the actual close. The dialog stays mounted afterwards
  // and is killed naturally when Electron tears down the renderer.
  useEffect(() => {
    const id = setTimeout(() => {
      setPhase('closing');
      onConfirmClose();
    }, 1200);
    return () => clearTimeout(id);
  }, [onConfirmClose]);

  const isClosing = phase === 'closing';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(11,11,15,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Installation de la mise à jour en cours"
    >
      <div className="theme-card rounded-2xl shadow-2xl border theme-border w-full max-w-md p-7 text-center">
        <div className="flex justify-center mb-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center relative"
            style={{ background: 'var(--accent-bg-soft)' }}
          >
            <Download size={30} className="theme-accent" />
            <span
              aria-hidden
              className="absolute inset-0 rounded-full ring-4 animate-pulse"
              style={{ borderColor: 'var(--accent)', borderWidth: 2, borderStyle: 'solid', opacity: 0.4 }}
            />
          </div>
        </div>

        <h3 className="text-xl font-semibold theme-text mb-2 flex items-center justify-center gap-2">
          <RefreshCw size={18} className="theme-accent animate-spin" />
          Installation de la mise à jour
        </h3>

        <p className="text-sm theme-muted leading-relaxed mb-5 max-w-sm mx-auto">
          DéliNote va se fermer brièvement pour installer la nouvelle version,
          puis <strong className="theme-text">se relancera automatiquement</strong>.
          {' '}Aucune action de ta part n&apos;est nécessaire.
        </p>

        <ol className="text-left text-sm theme-text space-y-2.5 mb-5 max-w-sm mx-auto">
          <Step
            icon={isClosing ? <CheckCircle2 size={16} className="text-green-500" /> : <RefreshCw size={16} className="theme-accent animate-spin" />}
            label="Préparation"
            sub={isClosing ? 'OK' : 'En cours…'}
            done={isClosing}
          />
          <Step
            icon={isClosing ? <Power size={16} className="theme-accent animate-pulse" /> : <span className="w-4 h-4 inline-block rounded-full theme-input border theme-border-soft" />}
            label="Fermeture de DéliNote"
            sub={isClosing ? 'L\'app va disparaître maintenant…' : 'Suivante'}
            active={isClosing}
          />
          <Step
            icon={<span className="w-4 h-4 inline-block rounded-full theme-input border theme-border-soft" />}
            label="Installation des nouveaux fichiers"
            sub="Une fenêtre Windows va s'afficher pendant ~10 sec."
          />
          <Step
            icon={<span className="w-4 h-4 inline-block rounded-full theme-input border theme-border-soft" />}
            label="Relance avec la nouvelle version"
            sub="Tes notes et tes paramètres restent intacts."
          />
        </ol>

        <p className="text-[11px] theme-muted">
          🔒 Ne ferme pas Windows pendant l&apos;installation.
        </p>
      </div>
    </div>
  );
}

function Step({
  icon, label, sub, done, active,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <li className={`flex items-start gap-2.5 ${done ? 'opacity-70' : active ? '' : 'opacity-60'}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1">
        <div className={`font-medium ${active ? 'theme-accent' : ''}`}>{label}</div>
        <div className="text-[11px] theme-muted leading-snug">{sub}</div>
      </div>
    </li>
  );
}
