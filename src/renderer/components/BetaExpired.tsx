import { AlertOctagon, Download, Folder, Sparkles } from 'lucide-react';
import { Logo } from './Logo';
import { TriskellMark } from './TriskellMark';
import type { BetaStatus } from '../betaGuard';

/**
 * Full-screen blocking view shown when the current beta has expired.
 * The app is unusable until the user installs a fresher build.
 */
export default function BetaExpired({ status }: { status: BetaStatus }) {
  const expiredOn = new Date(status.expiresAt);
  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center p-8 text-center"
      style={{
        background: 'linear-gradient(135deg, #1B2330 0%, #0d1419 100%)',
        color: '#f1f5f9',
      }}
    >
      <Logo size={96} className="mb-6 drop-shadow-lg" />

      <div className="max-w-md">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}
        >
          <AlertOctagon size={14} />
          <span className="text-xs font-bold uppercase tracking-wider">Bêta expirée</span>
        </div>

        <h1 className="text-3xl font-bold mb-3">Cette version a expiré</h1>
        <p className="text-base text-slate-300 leading-relaxed">
          Tu utilises <strong className="text-white">DéliNote v{status.version}</strong> — une version <strong>bêta</strong> qui est limitée à <strong>{7} jours d'utilisation</strong> pour garantir que tu testes toujours la dernière version stable.
        </p>
        <p className="text-sm text-slate-400 mt-3">
          Période d'essai terminée le {expiredOn.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>

        <div
          className="mt-8 rounded-xl p-5 text-left"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-2 mb-3 text-amber-300 font-semibold">
            <Sparkles size={16} /> Pour continuer
          </div>
          <ol className="space-y-2.5 text-sm text-slate-200">
            <li className="flex gap-2">
              <span className="text-amber-300 font-bold">1.</span>
              <span>Récupère la <strong>nouvelle version</strong> auprès de Triskell Studio.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-300 font-bold">2.</span>
              <span>Lance le nouvel exécutable — tes notes restent intactes (stockées séparément).</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-300 font-bold">3.</span>
              <span>Tu repars pour 7 jours d'utilisation.</span>
            </li>
          </ol>
        </div>

        <div className="mt-6 rounded-lg p-3 text-left text-xs text-slate-400 flex items-start gap-2"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Folder size={12} className="shrink-0 mt-0.5" />
          <div>
            Tes données sont en sécurité dans <code className="text-slate-200">%APPDATA%\delinote\DeliNoteData\</code> — la nouvelle version les retrouvera automatiquement.
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 opacity-80">
          <TriskellMark size={11} />
          <span>par Triskell Studio</span>
        </div>
      </div>
    </div>
  );
}

/** Small inline countdown badge for the sidebar footer. */
export function BetaBadge({ status, onClick }: { status: BetaStatus; onClick?: () => void }) {
  if (!status.isBeta) return null;
  const danger = status.daysLeft <= 1;
  const warning = status.daysLeft <= 3;
  const label = status.daysLeft <= 0
    ? 'Expirée'
    : status.daysLeft === 1
      ? `Bêta · ${status.hoursLeft}h restantes`
      : `Bêta · ${status.daysLeft}j restants`;

  return (
    <button
      onClick={onClick}
      title={`Cette version expire le ${new Date(status.expiresAt).toLocaleString('fr-FR')}`}
      className="w-full mt-1 flex items-center justify-center gap-1 rounded text-[10px] font-medium px-2 py-1 transition"
      style={{
        background: danger ? 'rgba(239,68,68,0.15)' : warning ? 'rgba(251,191,36,0.15)' : 'rgba(99,102,241,0.12)',
        color: danger ? '#ef4444' : warning ? '#d97706' : '#6366f1',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full"
        style={{ background: danger ? '#ef4444' : warning ? '#f59e0b' : '#6366f1' }}
      />
      <span>{label}</span>
    </button>
  );
}
