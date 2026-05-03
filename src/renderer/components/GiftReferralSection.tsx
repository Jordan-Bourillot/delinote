import { useEffect, useState } from 'react';
import {
  Gift, Users, Copy, Check, Share2, ExternalLink, Mail, MessageCircle,
  Sparkles, TrendingUp, Coins, Info,
} from 'lucide-react';
import { useStore } from '../store';
import { useSettings } from '../settings';
import { TRISKELL_URL } from './TriskellMark';

/**
 * Offrir DéliNote + Programme de parrainage.
 *
 * Two side-by-side concerns wrapped in one settings section:
 *
 *   - Gift card        — open a checkout flow pre-filled "as a gift" so the
 *                        buyer can offer a license to a friend. The actual
 *                        gift-handover (license email to recipient) happens
 *                        merchant-side once Stripe payment is confirmed.
 *
 *   - Referral card    — every install gets a stable random code stored in
 *                        localStorage. Sharing a link with `?ref=CODE` to the
 *                        landing page makes the landing forward CODE to Stripe
 *                        as `client_reference_id`. After the friend buys,
 *                        the merchant cross-references the code and credits
 *                        the referrer (manual at first, automatable later).
 *
 * Both flows surface real CTAs (mailto, share API, clipboard) so the section
 * is genuinely useful even before any backend talks back. Stats are kept as
 * placeholders (`—`) until a real reconciliation API is wired.
 */

const REFERRAL_CODE_KEY = 'delinote.referral.code.v1';
const SALES_BASE_URL = 'https://delinote.triskell-studio.fr'; // landing host
const STUDIO_HELP_EMAIL = 'contact@triskell-studio.fr';
const REWARD_PER_REFERRAL_EUR = 5; // shown in the UI; merchant decides for real

function getOrCreateReferralCode(): string {
  try {
    const existing = localStorage.getItem(REFERRAL_CODE_KEY);
    if (existing && /^[A-Z0-9]{6,12}$/.test(existing)) return existing;
  } catch { /* ignore */ }
  // Visually friendly alphabet: no 0/O/1/I/L confusion
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  try { localStorage.setItem(REFERRAL_CODE_KEY, code); } catch { /* ignore */ }
  return code;
}

export default function GiftReferralSection() {
  const settings = useSettings((s) => s.settings);
  const toast = useStore((s) => s.toast);
  const [code] = useState(() => getOrCreateReferralCode());

  // --- Gift form state -------------------------------------------------------
  const [giftEmail, setGiftEmail] = useState('');
  const [giftName, setGiftName] = useState('');
  const [giftMessage, setGiftMessage] = useState('');

  function buildGiftUrl(): string {
    const params = new URLSearchParams();
    params.set('gift', '1');
    if (giftEmail.trim()) params.set('to', giftEmail.trim());
    if (giftName.trim()) params.set('name', giftName.trim());
    if (giftMessage.trim()) params.set('msg', giftMessage.trim().slice(0, 280));
    if (code) params.set('ref', code); // self-credit if buyer is already an owner
    return `${SALES_BASE_URL}/?${params.toString()}#prix`;
  }

  function buildReferralUrl(): string {
    const params = new URLSearchParams();
    params.set('ref', code);
    return `${SALES_BASE_URL}/?${params.toString()}`;
  }

  function openExternal(url: string) {
    try { (window as any).nv?.openExternal?.(url) ?? window.open(url, '_blank'); }
    catch { window.open(url, '_blank'); }
  }

  // --- Quick copy helpers ---------------------------------------------------
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  function copy(value: string, kind: 'code' | 'link') {
    navigator.clipboard.writeText(value)
      .then(() => {
        setCopied(kind);
        toast('success', kind === 'code' ? 'Code copié' : 'Lien copié');
        setTimeout(() => setCopied(null), 1800);
      })
      .catch(() => toast('error', 'Impossible de copier'));
  }

  function shareViaEmail() {
    const who = settings.firstName?.trim();
    const subject = encodeURIComponent('Je t\'offre ma découverte : DéliNote');
    const body = encodeURIComponent(
      `Salut !\n\nJe me sers de DéliNote pour mes notes — c'est local-first, rapide, et fait avec soin par un studio indé.\n\n` +
      `Si tu veux essayer, voici mon lien (avec mon code parrain) :\n${buildReferralUrl()}\n\n` +
      `${who ? '— ' + who : ''}\n`,
    );
    openExternal(`mailto:?subject=${subject}&body=${body}`);
  }

  function shareViaWhatsApp() {
    const text = encodeURIComponent(
      `Hey ! Je te recommande DéliNote (notes local-first, vraiment soignées). ` +
      `Mon lien parrain : ${buildReferralUrl()}`,
    );
    openExternal(`https://wa.me/?text=${text}`);
  }

  function shareNative() {
    const data = {
      title: 'DéliNote',
      text: 'Mes notes locales, soignées et sans cloud — voilà mon lien parrain :',
      url: buildReferralUrl(),
    };
    if (typeof navigator.share === 'function') {
      navigator.share(data).catch(() => { /* user cancelled */ });
    } else {
      copy(buildReferralUrl(), 'link');
    }
  }

  // --- Stats placeholder ----------------------------------------------------
  // Wire to a real backend later; for now show "—" and "0".
  const stats = { referrals: 0, earnings: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold theme-text mb-1 flex items-center gap-2">
          <Gift size={18} className="theme-accent" /> Offrir & parrainer
        </h3>
        <p className="text-sm theme-muted leading-relaxed">
          Aide DéliNote à grandir : offre l&apos;app à un proche, ou partage ton lien parrain pour gagner
          {' '}<strong className="theme-text">{REWARD_PER_REFERRAL_EUR}&nbsp;€</strong> par filleul qui achète.
        </p>
      </div>

      {/* === Card: Gift =========================================== */}
      <Card icon={<Gift size={16} />} title="Offrir DéliNote">
        <p className="text-sm theme-muted leading-relaxed">
          Un cadeau original pour quelqu&apos;un qui aime garder ses idées au calme. Le destinataire reçoit
          un email avec le téléchargement et son code de licence.
        </p>

        <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
          <Field label="Email du destinataire">
            <input
              type="email"
              value={giftEmail}
              onChange={(e) => setGiftEmail(e.target.value)}
              placeholder="ami@exemple.fr"
              className="theme-input rounded px-2.5 py-1.5 text-sm w-full outline-none"
            />
          </Field>
          <Field label="Son prénom (optionnel)">
            <input
              type="text"
              value={giftName}
              onChange={(e) => setGiftName(e.target.value)}
              placeholder="Camille"
              className="theme-input rounded px-2.5 py-1.5 text-sm w-full outline-none"
            />
          </Field>
        </div>
        <Field label="Petit mot (optionnel)">
          <textarea
            value={giftMessage}
            onChange={(e) => setGiftMessage(e.target.value.slice(0, 280))}
            placeholder="Pour t'aider à mieux organiser tes idées 💛"
            rows={2}
            className="theme-input rounded px-2.5 py-1.5 text-sm w-full outline-none resize-none"
          />
          <div className="text-[10px] theme-muted text-right">{giftMessage.length} / 280</div>
        </Field>

        <button
          onClick={() => openExternal(buildGiftUrl())}
          disabled={!giftEmail.trim()}
          className="mt-3 inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg theme-accent-bg text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Gift size={14} /> Offrir maintenant
          <ExternalLink size={12} className="opacity-70" />
        </button>
        <p className="text-[11px] theme-muted mt-2">
          Le paiement passe par Stripe sécurisé sur le site DéliNote. La licence est envoyée automatiquement après confirmation.
        </p>
      </Card>

      {/* === Card: Referral ======================================= */}
      <Card icon={<Users size={16} />} title="Programme de parrainage">
        <p className="text-sm theme-muted leading-relaxed">
          Voici <strong className="theme-text">ton code unique</strong>. Partage-le ou utilise le lien parrain : pour chaque ami
          qui achète DéliNote avec ton code, tu gagnes <strong className="theme-text">{REWARD_PER_REFERRAL_EUR}&nbsp;€</strong>.
        </p>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <code
            className="font-mono text-lg font-bold tracking-wider px-3.5 py-2 rounded-lg theme-card border theme-border"
            style={{ letterSpacing: '0.18em' }}
          >
            {code}
          </code>
          <button
            onClick={() => copy(code, 'code')}
            className="text-xs theme-input hover:theme-hover rounded px-2.5 py-2 inline-flex items-center gap-1.5"
            title="Copier le code"
          >
            {copied === 'code' ? <><Check size={12} className="text-green-500" /> Copié</> : <><Copy size={12} /> Copier</>}
          </button>
          <button
            onClick={() => copy(buildReferralUrl(), 'link')}
            className="text-xs theme-input hover:theme-hover rounded px-2.5 py-2 inline-flex items-center gap-1.5"
            title="Copier le lien parrain complet"
          >
            {copied === 'link' ? <><Check size={12} className="text-green-500" /> Copié</> : <><ExternalLink size={12} /> Copier le lien</>}
          </button>
        </div>

        <div className="mt-2 text-[11px] theme-muted break-all font-mono">
          {buildReferralUrl()}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs theme-muted mr-1">Partager :</span>
          <button
            onClick={shareViaEmail}
            className="text-xs theme-input hover:theme-hover rounded px-2.5 py-1.5 inline-flex items-center gap-1.5"
          >
            <Mail size={12} /> Email
          </button>
          <button
            onClick={shareViaWhatsApp}
            className="text-xs theme-input hover:theme-hover rounded px-2.5 py-1.5 inline-flex items-center gap-1.5"
          >
            <MessageCircle size={12} /> WhatsApp
          </button>
          <button
            onClick={shareNative}
            className="text-xs theme-input hover:theme-hover rounded px-2.5 py-1.5 inline-flex items-center gap-1.5"
          >
            <Share2 size={12} /> Autre…
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <StatTile
            icon={<Sparkles size={14} />}
            label="Filleuls actifs"
            value={String(stats.referrals)}
          />
          <StatTile
            icon={<Coins size={14} />}
            label="Gains à recevoir"
            value={`${stats.earnings} €`}
          />
        </div>

        <p className="text-[11px] theme-muted mt-3 leading-relaxed flex items-start gap-1.5">
          <Info size={11} className="shrink-0 mt-0.5" />
          <span>
            Les statistiques sont consolidées chaque fin de mois. Tes gains sont versés
            par virement (à partir de 20&nbsp;€), ou en bons à valoir sur d&apos;autres apps Triskell Studio.
            Une question&nbsp;? Écris à <a className="theme-accent" href={`mailto:${STUDIO_HELP_EMAIL}`}>{STUDIO_HELP_EMAIL}</a>.
          </span>
        </p>
      </Card>

      {/* === Card: How it works =================================== */}
      <Card icon={<TrendingUp size={16} />} title="Comment ça marche">
        <ol className="text-sm theme-text space-y-2.5 list-none">
          <Step n={1}>
            <strong>Tu partages ton lien parrain</strong> ou ton code à un proche qui pourrait
            tirer parti de DéliNote (collègue, famille, communauté).
          </Step>
          <Step n={2}>
            Il achète DéliNote en cliquant sur ton lien. Stripe enregistre ton code à la transaction.
          </Step>
          <Step n={3}>
            <strong>Tu gagnes {REWARD_PER_REFERRAL_EUR}&nbsp;€</strong> par filleul. Sans plafond,
            sans engagement.
          </Step>
          <Step n={4}>
            Tu reçois tes gains par virement, ou tu les transformes en bons à valoir sur d&apos;autres
            apps Triskell Studio.
          </Step>
        </ol>
        <button
          onClick={() => openExternal(`${TRISKELL_URL}/parrainage`)}
          className="mt-4 text-xs inline-flex items-center gap-1.5 theme-muted hover:theme-text"
        >
          Conditions complètes <ExternalLink size={11} />
        </button>
      </Card>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="theme-card rounded-xl border theme-border-soft p-5">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-7 h-7 rounded-md flex items-center justify-center theme-accent shrink-0"
          style={{ background: 'var(--accent-bg-soft)' }}
        >
          {icon}
        </span>
        <h4 className="text-sm font-semibold theme-text">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs theme-muted block mb-1">{label}</span>
      {children}
    </label>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="theme-card-soft rounded-lg border theme-border-soft px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider theme-muted font-bold">
        {icon} {label}
      </div>
      <div className="text-xl font-bold theme-text mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold theme-accent-bg text-white"
      >
        {n}
      </span>
      <div className="flex-1 leading-relaxed">{children}</div>
    </li>
  );
}
