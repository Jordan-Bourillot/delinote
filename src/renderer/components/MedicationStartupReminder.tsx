import { useEffect, useMemo, useState } from 'react';
import { Pill, Check, X, Clock, ArrowRight, Calendar as CalendarIcon } from 'lucide-react';
import { useT } from '../i18n';
import { useDateFmt } from '../dateFmt';
import { useStore } from '../store';
import { useSettings } from '../settings';
import { getEncouragement, getTakenJustNowMessage } from '../med/encouragements';

const DISMISS_KEY = 'delinote.medReminder.dismissed';

/** True if the user has already dismissed today's reminder. */
function alreadyDismissedToday(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    return localStorage.getItem(DISMISS_KEY) === today;
  } catch { return false; }
}

function markDismissedToday() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(DISMISS_KEY, today);
  } catch { /* ignore */ }
}

type Slot = {
  medId: string; name: string; dosage: string; color: string;
  time: string; scheduledFor: number; taken: boolean; skipped: boolean; isPast: boolean;
};

export default function MedicationStartupReminder({ onClose }: { onClose: () => void }) {
  const t = useT();
  const df = useDateFmt();
  const settings = useSettings((s) => s.settings);
  const setView = useStore((s) => s.setView);
  const toast = useStore((s) => s.toast);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [streak, setStreak] = useState(0);
  const [brokeYesterday, setBrokeYesterday] = useState(false);
  const [hasMeds, setHasMeds] = useState(false);

  async function reload() {
    const [meds, intakes] = await Promise.all([window.nv.listMedications(), window.nv.listIntakes()]);
    setHasMeds(meds.length > 0);
    const now = new Date();
    const dow = now.getDay();
    const list: Slot[] = [];
    for (const m of meds) {
      if (!m.active) continue;
      if (m.daysOfWeek.length > 0 && !m.daysOfWeek.includes(dow)) continue;
      for (const time of m.schedule) {
        const [h, mi] = time.split(':').map(Number);
        const d = new Date(now); d.setHours(h, mi, 0, 0);
        const at = d.getTime();
        const intake = intakes.find((x) => x.medId === m.id && x.scheduledFor === at);
        list.push({
          medId: m.id, name: m.name, dosage: m.dosage, color: m.color,
          time, scheduledFor: at,
          taken: !!intake?.takenAt,
          skipped: !!intake?.skipped,
          isPast: at <= Date.now(),
        });
      }
    }
    list.sort((a, b) => a.scheduledFor - b.scheduledFor);
    setSlots(list);
    // Compute streak (lazy, no per-day generation here)
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yEnd = new Date(yesterday); yEnd.setHours(23, 59, 59, 999);
    const ydow = yesterday.getDay();
    const yScheduled: { medId: string; at: number }[] = [];
    for (const m of meds) {
      if (!m.active) continue;
      if (m.daysOfWeek.length > 0 && !m.daysOfWeek.includes(ydow)) continue;
      for (const time of m.schedule) {
        const [h, mi] = time.split(':').map(Number);
        const d = new Date(yesterday); d.setHours(h, mi, 0, 0);
        yScheduled.push({ medId: m.id, at: d.getTime() });
      }
    }
    const yAllTaken = yScheduled.length === 0 || yScheduled.every((s) => intakes.some((x) => x.medId === s.medId && x.scheduledFor === s.at && x.takenAt));
    setBrokeYesterday(yScheduled.length > 0 && !yAllTaken);
    // Simple streak (count back days where everything was taken)
    let s = 0;
    for (let i = 1; i < 60; i++) {
      const day = new Date(); day.setDate(day.getDate() - i); day.setHours(0, 0, 0, 0);
      const dDow = day.getDay();
      let dScheduled = 0; let dTaken = 0;
      for (const m of meds) {
        if (!m.active) continue;
        if (m.daysOfWeek.length > 0 && !m.daysOfWeek.includes(dDow)) continue;
        for (const time of m.schedule) {
          const [h, mi] = time.split(':').map(Number);
          const d = new Date(day); d.setHours(h, mi, 0, 0);
          dScheduled++;
          if (intakes.some((x) => x.medId === m.id && x.scheduledFor === d.getTime() && x.takenAt)) dTaken++;
        }
      }
      if (dScheduled === 0) continue; // neutral
      if (dTaken === dScheduled) s++; else break;
    }
    setStreak(s);
  }

  useEffect(() => { void reload(); }, []);

  const pending = slots.filter((s) => !s.taken && !s.skipped);
  const upcomingPast = pending.filter((s) => s.isPast);   // past time, missed
  const upcomingFuture = pending.filter((s) => !s.isPast); // upcoming today

  const taken = slots.filter((s) => s.taken).length;
  const message = useMemo(() => getEncouragement({
    totalToday: slots.length,
    takenToday: taken,
    upcomingToday: upcomingFuture.length,
    streakDays: streak,
    brokeYesterday,
    hasMeds,
  }), [slots.length, taken, upcomingFuture.length, streak, brokeYesterday, hasMeds]);

  function close() { markDismissedToday(); onClose(); }

  async function take(s: Slot) {
    await window.nv.markIntake(s.medId, s.scheduledFor, true, false);
    toast('success', getTakenJustNowMessage());
    await reload();
  }
  async function skip(s: Slot) {
    await window.nv.markIntake(s.medId, s.scheduledFor, false, true);
    await reload();
  }

  // If nothing to remind about, auto-close immediately.
  useEffect(() => {
    if (slots.length === 0 && hasMeds === false) {
      // Initial state — wait for reload
      return;
    }
    if (slots.length === 0) close();
  }, [slots.length, hasMeds]);

  if (slots.length === 0) return null;
  const greeting = getGreeting(t, settings.firstName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm pop-in">
      <div className="theme-card border theme-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div
          className="px-6 py-5 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 60%, #2dd4bf 100%)' }}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <Pill size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">{greeting}</h2>
              <p className="text-sm text-white/85 mt-0.5">Voici tes prises pour aujourd'hui</p>
              {streak > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-white/15 backdrop-blur px-2 py-0.5 rounded-full">
                  🔥 Série de {streak} jour{streak > 1 ? 's' : ''}
                </div>
              )}
            </div>
            <button onClick={close} className="text-white/70 hover:text-white shrink-0"><X size={16} /></button>
          </div>
        </div>

        {/* Encouragement */}
        <div className="px-6 py-3 theme-bg-soft border-b theme-border-soft text-sm theme-text">
          ✨ {message}
        </div>

        {/* Pending intakes */}
        <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
          {upcomingPast.length > 0 && (
            <Section title="⚠ En retard" subtle>
              {upcomingPast.map((s) => (
                <Row key={`${s.medId}-${s.scheduledFor}`} slot={s} late onTake={() => take(s)} onSkip={() => skip(s)} t={t} df={df} />
              ))}
            </Section>
          )}
          {upcomingFuture.length > 0 && (
            <Section title="À venir aujourd'hui">
              {upcomingFuture.map((s) => (
                <Row key={`${s.medId}-${s.scheduledFor}`} slot={s} onTake={() => take(s)} onSkip={() => skip(s)} t={t} df={df} />
              ))}
            </Section>
          )}
          {taken > 0 && pending.length === 0 && (
            <div className="text-center py-6 theme-text">
              <div className="text-4xl mb-2">🎉</div>
              <p className="font-semibold">Tout est pris pour aujourd'hui !</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t theme-border-soft theme-bg-soft flex items-center gap-2">
          <button
            onClick={() => { setView({ kind: 'meds' }); close(); }}
            className="text-xs theme-muted hover:theme-text px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            <CalendarIcon size={12} /> Voir tout le suivi
          </button>
          <div className="flex-1" />
          <button
            onClick={close}
            className="text-sm px-4 py-2 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm flex items-center gap-1.5"
          >
            <Check size={13} /> J'ai vu
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtle, children }: { title: string; subtle?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className={`text-xs uppercase tracking-wider font-semibold mb-1.5 ${subtle ? 'text-amber-600' : 'theme-muted'}`}>
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ slot, late, onTake, onSkip, t, df }: {
  slot: Slot; late?: boolean; onTake: () => void; onSkip: () => void;
  t: (k: any, p?: any) => string; df: any;
}) {
  return (
    <div className={`theme-card rounded-lg border px-3 py-2 flex items-center gap-2.5 ${late ? 'border-amber-500/40 bg-amber-500/5' : 'theme-border-soft'}`}>
      <div className="w-1 self-stretch rounded shrink-0" style={{ background: slot.color }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold theme-text truncate">{slot.name}</div>
        <div className="text-xs theme-muted flex items-center gap-1.5 mt-0.5">
          <Clock size={10} />
          <span className="font-mono">{slot.time}</span>
          {slot.dosage && <span className="theme-pill px-1.5 py-0.5 rounded text-[10px]">{slot.dosage}</span>}
        </div>
      </div>
      <button onClick={onSkip} className="text-xs theme-muted hover:theme-text hover:theme-hover px-2 py-1 rounded">
        Sauter
      </button>
      <button
        onClick={onTake}
        className="text-xs px-3 py-1.5 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm flex items-center gap-1"
      >
        <Check size={11} /> Prendre
      </button>
    </div>
  );
}

function getGreeting(t: (k: any, p?: any) => string, firstName: string): string {
  const h = new Date().getHours();
  let base: string;
  if (h < 6) base = t('home.night');
  else if (h < 12) base = t('home.morning');
  else if (h < 18) base = t('home.afternoon');
  else if (h < 23) base = t('home.evening');
  else base = t('home.night');
  const name = firstName?.trim();
  return name ? `${base} ${name}` : base;
}

export { alreadyDismissedToday };
