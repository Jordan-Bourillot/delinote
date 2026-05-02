import { useState } from 'react';
import { Sprout, Zap, Rocket, Wand2, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import { detectCurrentProfile, type ProfileId } from '../profiles';
import { useStore } from '../store';
import ProfileChooser from './ProfileChooser';

/**
 * Small profile-status panel pinned to the bottom of the sidebar.
 *
 * Always visible (whatever the profile is). Shows the user which mode they're
 * on, with a one-click way to switch — and a reminder that everything can be
 * fine-tuned in Settings if neither preset fits exactly.
 *
 * For users on the "Découverte" profile, the visual is a bit more inviting
 * (orange tint + "Activer plus →" CTA) to nudge them toward upgrading once
 * they've gotten comfortable.
 */

const META: Record<ProfileId | 'custom', {
  icon: React.ReactNode;
  label: string;
  tagline: string;
  accent: string;
}> = {
  decouverte: { icon: <Sprout size={13} />, label: 'Découverte', tagline: 'Mode épuré pour démarrer',          accent: '#16a34a' },
  equilibre:  { icon: <Zap size={13} />,    label: 'Équilibré',  tagline: 'Productivité essentielle',          accent: '#F37223' },
  complete:   { icon: <Rocket size={13} />, label: 'Complète',   tagline: 'Toutes les fonctions activées',     accent: '#0d9488' },
  custom:     { icon: <Wand2 size={13} />,  label: 'Personnalisé', tagline: 'Réglages ajustés à la pièce',     accent: '#8b5cf6' },
};

export default function SidebarUpsell() {
  const [chooserOpen, setChooserOpen] = useState(false);
  const openModal = useStore((s) => s.openModal);

  const profile = detectCurrentProfile();
  const meta = META[profile];
  const isDecouverte = profile === 'decouverte';

  return (
    <>
      <div
        className="mx-2 my-2 rounded-lg border theme-border-soft overflow-hidden"
        style={{
          background: isDecouverte ? 'var(--accent-bg-soft)' : 'var(--card)',
        }}
      >
        {/* Top row: current profile + change button */}
        <div className="px-2.5 py-2 flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
            style={{ background: `${meta.accent}24`, color: meta.accent }}
            aria-hidden
          >
            {meta.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider theme-muted leading-none">
              Profil
            </div>
            <div className="text-xs font-semibold theme-text leading-tight truncate">
              {meta.label}
            </div>
          </div>
          <button
            onClick={() => setChooserOpen(true)}
            className="text-[10.5px] font-medium px-2 py-1 rounded-md text-white shrink-0 hover:opacity-90 transition flex items-center gap-0.5"
            style={{ background: meta.accent }}
            title="Changer de profil"
          >
            {isDecouverte ? 'Activer plus' : 'Changer'}
            <ChevronRight size={10} />
          </button>
        </div>

        {/* Bottom row: tagline + settings link */}
        <div className="px-2.5 pb-2 -mt-0.5">
          <div className="text-[10px] theme-muted leading-snug">
            {meta.tagline}
          </div>
          <button
            onClick={() => openModal('settings')}
            className="mt-1 text-[10px] theme-muted hover:theme-text inline-flex items-center gap-1 underline-offset-2 hover:underline"
            title="Ouvrir les Réglages"
          >
            <SettingsIcon size={9} />
            Tout est activable dans les Réglages
          </button>
        </div>
      </div>
      {chooserOpen && <ProfileChooser onClose={() => setChooserOpen(false)} reopened />}
    </>
  );
}
