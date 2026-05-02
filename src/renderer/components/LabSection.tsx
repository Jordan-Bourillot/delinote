import { useState } from 'react';
import { useSettings } from '../settings';
import type { Settings } from '../settings';
import {
  Sparkles, Zap, Mic, Layout, BatteryCharging, QrCode, History, Archive,
  ThumbsUp, Wrench, ThumbsDown, Send, FlaskConical,
} from 'lucide-react';
import { useStore } from '../store';
import { CURRENT_VERSION } from './WhatsNew';

/**
 * "Labo" / Lab settings section — 8 disruptive features the user can toggle.
 * Each shows a feedback widget (j'aime / à améliorer / pas d'intérêt) so the
 * user can tell us what to invest in. Feedback is stored locally and can be
 * exported via mailto.
 */

type Verdict = 'love' | 'improve' | 'meh' | null;
type FeatureKey =
  | 'labMurmure' | 'labFlux' | 'labVocalSpatial' | 'labMoodboard'
  | 'labEnergyCalendar' | 'labQrShare' | 'labTimeTravel' | 'labAutoArchive';

const FEEDBACK_KEY = 'delinote.lab.feedback.v1';

export function loadFeedback(): Record<string, Verdict> {
  try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}'); } catch { return {}; }
}
function saveFeedback(map: Record<string, Verdict>) {
  try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

type FeatureDef = {
  key: FeatureKey;
  icon: React.ReactNode;
  title: string;
  pitch: string;
  status: 'live' | 'preview';
  longDescription: string;
};

const FEATURES: FeatureDef[] = [
  {
    key: 'labAutoArchive',
    icon: <Archive size={16} />,
    title: 'Auto-archive — laisse ton cerveau respirer',
    pitch: 'Les notes oubliées disparaissent doucement de la liste après X jours d\'inactivité. Pas supprimées — juste cachées.',
    status: 'live',
    longDescription: 'Les notes que tu n\'as pas touchées depuis le délai choisi sont masquées des vues par défaut. Tu peux toujours les retrouver via la recherche ou en cochant « Afficher archivées ». Aucune note n\'est jamais supprimée — elles attendent juste sagement.',
  },
  {
    key: 'labTimeTravel',
    icon: <History size={16} />,
    title: 'Retour dans le temps — un slider sur ton historique',
    pitch: 'Curseur en bas de l\'éditeur : fais glisser pour voir ta note telle qu\'elle était à n\'importe quel moment des 30 derniers jours.',
    status: 'live',
    longDescription: 'Utilise les instantanés que DéliNote prend déjà automatiquement. Glisse le curseur pour parcourir les versions. Bouton « Restaurer cette version » d\'un clic.',
  },
  {
    key: 'labMurmure',
    icon: <Sparkles size={16} />,
    title: 'Murmure — l\'IA souffle des liens à voix basse',
    pitch: 'Une bulle discrète : « Tu as parlé de Marie il y a 2 semaines, lien vers son contact ? » Local-only, jamais d\'envoi vers le cloud.',
    status: 'live',
    longDescription: 'Utiliserait des embeddings 100% locaux pour suggérer des liens pertinents (notes similaires, contacts mentionnés, anciennes notes oubliées qui parlent du même sujet). Aucune donnée n\'est envoyée hors de ton ordinateur.',
  },
  {
    key: 'labFlux',
    icon: <Zap size={16} />,
    title: 'Flux — fini d\'organiser, écris',
    pitch: 'Un bouton « Flux 25 min » : tu écris en continu, l\'app découpe automatiquement en notes thématiques à la fin.',
    status: 'live',
    longDescription: 'Mode brain-dump façon Pomodoro. Pendant 25 minutes tu écris sans réfléchir à l\'organisation. À la fin, l\'app utilise des embeddings pour détecter les changements de sujet et propose un découpage en notes distinctes que tu valides en un clic.',
  },
  {
    key: 'labVocalSpatial',
    icon: <Mic size={16} />,
    title: 'Notes vocales spatiales',
    pitch: 'Tu parles → l\'app transcrit + capture l\'heure, le lieu, ton agenda du jour. Tu retrouves « ce que je pensais en sortant du dentiste mardi soir ».',
    status: 'live',
    longDescription: 'Étend l\'enregistreur audio existant pour attacher : timestamp précis, événement de calendrier en cours, météo (optionnel via API locale), géolocalisation approximative (optionnel). Recherche par contexte plutôt que par mot-clé.',
  },
  {
    key: 'labMoodboard',
    icon: <Layout size={16} />,
    title: 'Mood-boards — la note devient toile libre',
    pitch: 'Pinterest + Notion sans grille : colle images, captures, mots-clés, sons sur un canvas que tu organises à la souris.',
    status: 'live',
    longDescription: 'Nouveau type de note où chaque élément (texte, image, audio, lien) est positionnable librement. Idéal pour brainstorming visuel, références, projets créatifs. Coexiste avec les notes texte classiques.',
  },
  {
    key: 'labEnergyCalendar',
    icon: <BatteryCharging size={16} />,
    title: 'Anti-calendrier « Énergie »',
    pitch: 'Au lieu de cases horaires, tu glisses tes tâches sur un slider haut → bas niveau d\'énergie. L\'app les place selon ton rythme historique.',
    status: 'live',
    longDescription: 'Repense le calendrier autour de TON énergie réelle plutôt que des heures fixes. L\'app apprend de tes patterns (tu marques quand tu te sens « en forme » ou « fatigué ») et propose un placement intelligent.',
  },
  {
    key: 'labQrShare',
    icon: <QrCode size={16} />,
    title: 'Partage en direct via QR',
    pitch: 'Un QR à scanner → ton ami collabore sur ta note pendant 1h. Peer-to-peer chiffré, pas de compte, pas de cloud.',
    status: 'live',
    longDescription: 'Pour réunions / brainstorms ad-hoc. Génère un QR code qui contient une clé éphémère + adresse réseau locale. La personne scanne, vous éditez la même note. Connexion P2P chiffrée, expire au bout d\'1h.',
  },
];

export default function LabSection() {
  const { settings, set, toggle } = useSettings();
  const toast = useStore((s) => s.toast);
  const [feedback, setFeedback] = useState<Record<string, Verdict>>(loadFeedback);

  function vote(key: FeatureKey, v: Verdict) {
    setFeedback((prev) => {
      const next = { ...prev, [key]: prev[key] === v ? null : v };
      saveFeedback(next);
      return next;
    });
  }

  function exportFeedback() {
    const lines: string[] = [];
    lines.push(`DéliNote v${CURRENT_VERSION} — retours « Labo »`);
    lines.push(`Utilisateur : ${settings.firstName?.trim() || 'anonyme'}`);
    lines.push('');
    for (const f of FEATURES) {
      const v = feedback[f.key];
      const label = v === 'love' ? '👍 J\'AIME'
                  : v === 'improve' ? '🔧 À AMÉLIORER'
                  : v === 'meh' ? '👎 PAS D\'INTÉRÊT'
                  : '— (pas d\'avis)';
      const enabled = settings[f.key as keyof Settings] ? '[activé]' : '[non activé]';
      lines.push(`• ${f.title} ${enabled} → ${label}`);
    }
    const body = lines.join('\n');
    const subject = `DéliNote v${CURRENT_VERSION} — retours Labo`;
    const url = `mailto:contact@triskell-studio.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try { (window as any).nv?.openExternal?.(url); } catch { /* ignore */ }
    void navigator.clipboard.writeText(body).catch(() => { /* ignore */ });
    toast('success', 'Tes retours ont été copiés et préparés dans un mail');
  }

  const totalVotes = Object.values(feedback).filter((v) => v !== null).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold theme-text mb-1 flex items-center gap-2">
          <FlaskConical size={18} className="theme-accent" /> Labo — innovations à tester
        </h3>
        <p className="text-sm theme-muted mb-4 leading-relaxed">
          Des idées qu&apos;on explore. Active celles qui t&apos;intriguent et dis-nous ce que tu en penses
          (👍 j&apos;aime · 🔧 à améliorer · 👎 pas d&apos;intérêt). Tes retours nous aident à savoir
          où mettre nos efforts.
        </p>
        {totalVotes > 0 && (
          <button
            onClick={exportFeedback}
            className="text-xs px-3 py-1.5 rounded-lg theme-accent-bg text-white hover:opacity-90 inline-flex items-center gap-1.5 mb-3"
          >
            <Send size={12} /> Envoyer mes {totalVotes} retour{totalVotes > 1 ? 's' : ''} à Triskell Studio
          </button>
        )}
      </div>

      <div className="space-y-3">
        {FEATURES.map((f) => (
          <FeatureCard
            key={f.key}
            def={f}
            enabled={settings[f.key as keyof Settings] as boolean}
            onToggle={() => toggle(f.key as any)}
            verdict={feedback[f.key] ?? null}
            onVote={(v) => vote(f.key, v)}
            settings={settings}
            set={set}
          />
        ))}
      </div>
    </div>
  );
}

function FeatureCard({
  def, enabled, onToggle, verdict, onVote, settings, set,
}: {
  def: FeatureDef;
  enabled: boolean;
  onToggle: () => void;
  verdict: Verdict;
  onVote: (v: Verdict) => void;
  settings: Settings;
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
}) {
  const isLive = def.status === 'live';

  return (
    <div
      className={`rounded-lg border theme-border-soft transition ${
        enabled ? 'theme-card' : 'theme-card opacity-90'
      }`}
    >
      <div className="p-3 flex items-start gap-3">
        <div
          className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent-bg-soft)', color: 'var(--accent)' }}
        >
          {def.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold theme-text">{def.title}</h4>
            {isLive ? (
              <span
                className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}
              >
                Disponible
              </span>
            ) : (
              <span
                className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(234,179,8,0.18)', color: '#ca8a04' }}
              >
                En développement
              </span>
            )}
          </div>
          <p className="text-xs theme-muted mt-1 leading-relaxed">{def.pitch}</p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 mt-1 rounded-full transition ${
            enabled ? 'theme-accent-bg' : 'bg-black/20'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
              enabled ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="px-3 pb-3 space-y-2">
          <div className="text-xs theme-text leading-relaxed bg-black/5 dark:bg-white/5 rounded p-2.5">
            <strong className="font-semibold">Comment ça marchera : </strong>
            {def.longDescription}
            {!isLive && (
              <span className="block mt-1.5 text-[11px] theme-muted italic">
                ⏳ Le code n&apos;est pas encore implémenté — ton vote nous aide à savoir si on doit s&apos;y mettre.
              </span>
            )}
          </div>

          {def.key === 'labAutoArchive' && (
            <div className="flex items-center gap-2 text-xs">
              <label className="theme-muted">Délai d&apos;archivage :</label>
              <input
                type="number"
                min={7}
                max={365}
                value={settings.labAutoArchiveDays}
                onChange={(e) => set('labAutoArchiveDays', Math.max(7, Math.min(365, Number(e.target.value) || 60)))}
                className="theme-input rounded px-2 py-0.5 w-16 text-right"
              />
              <span className="theme-muted">jours sans modification</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[11px] theme-muted mr-1">Ton avis :</span>
            <VoteButton active={verdict === 'love'} onClick={() => onVote('love')} icon={<ThumbsUp size={12} />} label="J'aime" tone="green" />
            <VoteButton active={verdict === 'improve'} onClick={() => onVote('improve')} icon={<Wrench size={12} />} label="À améliorer" tone="amber" />
            <VoteButton active={verdict === 'meh'} onClick={() => onVote('meh')} icon={<ThumbsDown size={12} />} label="Pas d'intérêt" tone="red" />
          </div>
        </div>
      )}
    </div>
  );
}

function VoteButton({
  active, onClick, icon, label, tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: 'green' | 'amber' | 'red';
}) {
  const toneStyle: React.CSSProperties = active
    ? tone === 'green' ? { background: 'rgba(34,197,94,0.18)', color: '#16a34a', borderColor: 'rgba(34,197,94,0.45)' }
    : tone === 'amber' ? { background: 'rgba(234,179,8,0.18)', color: '#ca8a04', borderColor: 'rgba(234,179,8,0.45)' }
    :                    { background: 'rgba(239,68,68,0.15)',  color: '#dc2626', borderColor: 'rgba(239,68,68,0.45)' }
    : {};
  return (
    <button
      onClick={onClick}
      className={`text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded border transition ${
        active ? 'font-semibold' : 'theme-muted hover:theme-text border-transparent hover:theme-hover'
      }`}
      style={toneStyle}
    >
      {icon} {label}
    </button>
  );
}
