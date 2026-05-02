import { useState } from 'react';
import { useSettings } from '../settings';
import { useT } from '../i18n';
import { Logo } from './Logo';
import { TriskellMark, openTriskellSite, TRISKELL_URL } from './TriskellMark';
import { ChevronRight, ChevronLeft, X, Check } from 'lucide-react';

const ONBOARDING_KEY = 'delinote.onboarding.done';

export function shouldShowOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) !== '1';
  } catch {
    return false;
  }
}

export function markOnboardingDone() {
  try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* ignore */ }
}

export default function Onboarding({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { settings, set } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    {
      key: 'welcome',
      content: (
        <div className="text-center py-8">
          <Logo size={96} className="mx-auto mb-6 drop-shadow-lg" />
          <h2 className="text-3xl font-bold theme-text">{t('onb.welcome.title')}</h2>
          <p className="text-sm theme-muted mt-3 max-w-sm mx-auto">{t('onb.welcome.body')}</p>
        </div>
      ),
    },
    {
      key: 'lang',
      content: (
        <div className="py-6">
          <h2 className="text-xl font-semibold theme-text mb-1">{t('onb.lang.title')}</h2>
          <div className="grid grid-cols-2 gap-3 mt-6">
            {[
              { v: 'fr', label: 'Français', flag: '🇫🇷' },
              { v: 'en', label: 'English', flag: '🇬🇧' },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => set('language', opt.v as any)}
                className={`p-5 rounded-xl border-2 transition text-center ${
                  settings.language === opt.v ? 'theme-accent border-current theme-accent-bg-soft' : 'theme-border-soft hover:theme-hover theme-card'
                }`}
              >
                <div className="text-3xl mb-2">{opt.flag}</div>
                <div className="text-sm font-semibold theme-text">{opt.label}</div>
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'name',
      content: (
        <div className="py-6">
          <h2 className="text-xl font-semibold theme-text mb-1">{t('onb.name.title')}</h2>
          <p className="text-sm theme-muted">{t('onb.name.body')}</p>
          <input
            autoFocus
            value={settings.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            placeholder={t('onb.name.placeholder')}
            maxLength={40}
            onKeyDown={(e) => { if (e.key === 'Enter' && settings.firstName.trim()) setStep(step + 1); }}
            className="w-full theme-input rounded-lg px-4 py-3 mt-6 outline-none text-lg"
          />
          {settings.firstName.trim() && (
            <p className="text-sm theme-muted mt-3 text-center">
              ✨ <span className="theme-text font-medium">Bonjour {settings.firstName.trim()}</span>
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'theme',
      content: (
        <div className="py-6">
          <h2 className="text-xl font-semibold theme-text mb-1">{t('onb.theme.title')}</h2>
          <p className="text-sm theme-muted">{t('onb.theme.body')}</p>
          <div className="grid grid-cols-2 gap-3 mt-6">
            {[
              { v: 'light', label: t('settings.themeLight'), preview: { bg: '#ffffff', text: '#1B2330', accent: '#F37223' } },
              { v: 'dark', label: t('settings.themeDark'), preview: { bg: '#0e1018', text: '#eef0f6', accent: '#F37223' } },
              { v: 'caribbean', label: t('settings.themeCaribbean'), preview: { bg: '#fbf6e9', text: '#143838', accent: '#0d9488' } },
              { v: 'sepia', label: t('settings.themeSepia'), preview: { bg: '#fbf4e4', text: '#3a2f1c', accent: '#b45309' } },
            ].map((th) => (
              <button
                key={th.v}
                onClick={() => set('theme', th.v as any)}
                className={`p-3 rounded-xl border-2 transition text-left overflow-hidden ${
                  settings.theme === th.v ? 'theme-accent border-current scale-105' : 'theme-border-soft hover:theme-hover'
                }`}
                style={{ background: th.preview.bg, color: th.preview.text }}
              >
                <div className="text-sm font-semibold mb-2">{th.label}</div>
                <div className="flex gap-1">
                  <div className="h-1.5 flex-1 rounded-full" style={{ background: th.preview.text, opacity: 0.2 }} />
                  <div className="h-1.5 w-3 rounded-full" style={{ background: th.preview.accent }} />
                </div>
                <div className="flex gap-1 mt-1">
                  <div className="h-1 flex-1 rounded-full" style={{ background: th.preview.text, opacity: 0.15 }} />
                  <div className="h-1 flex-1 rounded-full" style={{ background: th.preview.text, opacity: 0.15 }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'features',
      content: (
        <div className="py-6">
          <h2 className="text-xl font-semibold theme-text mb-1">{t('onb.feat.title')}</h2>
          <p className="text-sm theme-muted">{t('onb.feat.intro')}</p>
          <ul className="space-y-3 mt-6">
            {(['onb.feat.1', 'onb.feat.2', 'onb.feat.3', 'onb.feat.4'] as const).map((k) => (
              <li key={k} className="flex items-start gap-3 text-sm theme-text">
                <Check size={16} className="theme-accent shrink-0 mt-0.5" />
                <span>{t(k as any)}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={openTriskellSite}
            title={`${t('studio.byLine')} — ${TRISKELL_URL}`}
            aria-label={`${t('studio.byLine')} — ouvrir triskell-studio.fr`}
            className="mt-6 pt-4 border-t theme-border-soft w-full flex items-center justify-center gap-1.5 text-xs theme-muted hover:theme-text transition cursor-pointer"
          >
            <TriskellMark size={22} />
            <span className="text-sm">{t('studio.byLine')}</span>
          </button>
        </div>
      ),
    },
  ];

  const isLast = step === steps.length - 1;

  function finish() {
    markOnboardingDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="theme-card rounded-2xl shadow-2xl border theme-border w-full max-w-lg overflow-hidden">
        <div className="px-6 pt-4 flex justify-between items-center">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 theme-accent-bg' : i < step ? 'w-3 theme-accent-bg opacity-60' : 'w-3 theme-toggle-off'}`}
              />
            ))}
          </div>
          <button onClick={finish} className="theme-muted hover:theme-text text-xs flex items-center gap-1">
            {t('onb.skip')} <X size={12} />
          </button>
        </div>
        <div className="px-8">
          {steps[step].content}
        </div>
        <div className="px-6 py-4 border-t theme-border-soft flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="text-sm theme-muted hover:theme-text disabled:opacity-30 flex items-center gap-1"
          >
            <ChevronLeft size={14} /> {t('onb.back')}
          </button>
          {isLast ? (
            <button
              onClick={finish}
              className="text-sm px-5 py-2 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm font-medium"
            >
              {t('onb.start')}
            </button>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              className="text-sm px-4 py-2 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm flex items-center gap-1"
            >
              {t('onb.next')} <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
