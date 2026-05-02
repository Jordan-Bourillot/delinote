import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sprout, Zap, Rocket, Check, Settings as SettingsIcon } from 'lucide-react';
import { applyProfile, type ProfileId } from '../profiles';
import { Logo } from './Logo';

/**
 * First-launch profile picker. Three cards: Découverte / Équilibré / Complète.
 * Picking one applies its preset to Settings, marks the choice as made, and
 * closes the modal. The user can later switch profiles from the Settings panel.
 *
 * "Plus tard" button skips by silently applying the recommended profile
 * (Équilibré) — we never want to leave a fresh user in an unconfigured state.
 */

type Props = {
  onClose: () => void;
  /** When true, the modal is being re-opened from Settings (different copy). */
  reopened?: boolean;
};

type ProfileCard = {
  id: ProfileId;
  icon: React.ReactNode;
  title: string;
  tagline: string;
  description: string;
  bullets: string[];
  badge?: string;
  accent: string; // CSS color for the card highlight
};

const CARDS: ProfileCard[] = [
  {
    id: 'decouverte',
    icon: <Sprout size={28} />,
    title: 'Découverte',
    tagline: 'Pour démarrer en douceur',
    description: 'L\'essentiel, sans bruit. Idéal si tu veux juste prendre des notes et explorer DéliNote pas à pas.',
    bullets: [
      'Notes, carnets, étiquettes',
      'Mise en forme simple (gras, titres, listes)',
      'Recherche & corbeille',
      'Pas de modules avancés',
    ],
    accent: '#16a34a',
  },
  {
    id: 'equilibre',
    icon: <Zap size={28} />,
    title: 'Équilibré',
    tagline: 'L\'usage quotidien',
    description: 'Toutes les fonctions de productivité utiles à 80 % des gens, sans surcharger l\'interface.',
    bullets: [
      'Tout ce qui est dans Découverte',
      '+ Agenda, tâches, fichiers',
      '+ Tableaux, code, surlignage couleur',
      '+ Modèles, historique, raccourcis',
    ],
    badge: 'Recommandé',
    accent: '#F37223',
  },
  {
    id: 'complete',
    icon: <Rocket size={28} />,
    title: 'Complète',
    tagline: 'Pour les power users',
    description: 'Tout DéliNote dès le départ. Tu sais ce que tu fais et tu veux l\'arsenal complet.',
    bullets: [
      'Tout ce qui est dans Équilibré',
      '+ Contacts (avec WhatsApp)',
      '+ Médicaments (avec rappels)',
      '+ Liens wiki [[note]], backlinks, sommaire',
    ],
    accent: '#0d9488',
  },
];

export default function ProfileChooser({ onClose, reopened = false }: Props) {
  const [hovered, setHovered] = useState<ProfileId | null>(null);

  function pick(id: ProfileId) {
    applyProfile(id);
    onClose();
  }

  function skip() {
    // "Plus tard" → applique discrètement le profil recommandé.
    applyProfile('equilibre');
    onClose();
  }

  // Rendered via a portal on document.body so the modal escapes any ancestor
  // that establishes a containing block for fixed positioning (e.g. the
  // sidebar's `backdrop-filter` when a background image is active).
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-6"
      style={{ background: 'rgba(11,11,15,0.78)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Choisir un profil d'utilisation"
    >
      <div
        className="theme-card rounded-2xl shadow-2xl border theme-border w-full max-w-5xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-2 text-center">
          <div className="flex items-center justify-center mb-3">
            <Logo size={56} />
          </div>
          <h1 className="text-2xl font-bold theme-text">
            {reopened ? 'Changer de profil d\'utilisation' : 'Bienvenue dans DéliNote !'}
          </h1>
          <p className="theme-muted mt-2 text-sm max-w-2xl mx-auto">
            {reopened
              ? 'Choisis un nouveau profil — tes notes, tes carnets et tes paramètres personnels sont préservés.'
              : 'Choisis comment tu veux découvrir l\'app. Tu pourras changer d\'avis à tout moment dans les Réglages.'}
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          {CARDS.map((card) => {
            const isHovered = hovered === card.id;
            const isRecommended = card.id === 'equilibre';
            return (
              <button
                key={card.id}
                onMouseEnter={() => setHovered(card.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => pick(card.id)}
                className={`text-left rounded-xl border-2 p-5 transition-all relative cursor-pointer ${
                  isHovered ? 'shadow-xl' : 'shadow'
                }`}
                style={{
                  borderColor: isHovered ? card.accent : isRecommended ? card.accent : 'var(--border)',
                  background: 'var(--card)',
                  transform: isHovered ? 'translateY(-3px)' : 'none',
                }}
              >
                {card.badge && (
                  <span
                    className="absolute -top-2.5 left-5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                    style={{ background: card.accent }}
                  >
                    {card.badge}
                  </span>
                )}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: `${card.accent}1f`, color: card.accent }}
                >
                  {card.icon}
                </div>
                <h3 className="text-lg font-bold theme-text">{card.title}</h3>
                <p className="text-xs font-medium mb-2" style={{ color: card.accent }}>
                  {card.tagline}
                </p>
                <p className="text-xs theme-muted mb-3 leading-relaxed">{card.description}</p>
                <ul className="space-y-1.5 mb-4">
                  {card.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-1.5 text-xs theme-text">
                      <Check size={12} className="shrink-0 mt-0.5" style={{ color: card.accent }} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div
                  className="text-center text-xs font-semibold py-2 rounded-lg text-white transition-opacity"
                  style={{
                    background: card.accent,
                    opacity: isHovered ? 1 : 0.85,
                  }}
                >
                  Choisir « {card.title} »
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 pt-2 flex items-center justify-between flex-wrap gap-2">
          <p className="text-[11px] theme-muted flex items-center gap-1">
            <SettingsIcon size={11} />
            Modifiable à tout moment dans Réglages → Profil d'utilisation
          </p>
          {!reopened && (
            <button
              onClick={skip}
              className="text-xs theme-muted hover:theme-text underline-offset-4 hover:underline"
              title="Applique le profil Équilibré (recommandé)"
            >
              Plus tard
            </button>
          )}
          {reopened && (
            <button
              onClick={onClose}
              className="text-xs theme-muted hover:theme-text underline-offset-4 hover:underline"
            >
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
