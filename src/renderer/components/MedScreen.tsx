import { useEffect, useMemo, useState } from 'react';
import {
  Pill, Plus, Check, X, Edit2, Trash2, AlertTriangle,
  Sun, Moon, Coffee, Sparkles, Clock as ClockIcon, Calendar,
} from 'lucide-react';
import { useT } from '../i18n';
import { useDateFmt } from '../dateFmt';
import { useStore } from '../store';
import { getEncouragement, getTakenJustNowMessage, getLowStockMessage } from '../med/encouragements';
import type { Medication, Intake } from '../types';

const PRESET_COLORS = ['#0d9488', '#F37223', '#fbbf24', '#3b82f6', '#a855f7', '#ec4899', '#10b981', '#ef4444'];

type Tab = 'today' | 'list' | 'history';

export default function MedScreen() {
  const t = useT();
  const df = useDateFmt();
  const toast = useStore((s) => s.toast);

  const [tab, setTab] = useState<Tab>('today');
  const [meds, setMeds] = useState<Medication[]>([]);
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [adding, setAdding] = useState(false);

  async function reload() {
    const [m, i] = await Promise.all([window.nv.listMedications(), window.nv.listIntakes()]);
    setMeds(m);
    setIntakes(i);
  }
  useEffect(() => { void reload(); }, []);

  return (
    <div className="flex-1 overflow-y-auto theme-bg">
      <div className="max-w-4xl mx-auto px-8 pt-8 pb-12">
        <header className="flex items-center gap-4 mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md"
            style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)' }}
          >
            <Pill size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold theme-text">{t('med.title')}</h1>
            <p className="text-sm theme-muted mt-0.5">{t('app.tagline')}</p>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b theme-border-soft">
          {(['today', 'list', 'history'] as Tab[]).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === id ? 'theme-text border-current theme-accent' : 'theme-muted hover:theme-text border-transparent'
              }`}
            >
              {t(`med.tab.${id}` as any)}
            </button>
          ))}
        </div>

        {tab === 'today' && (
          <TodayTab meds={meds} intakes={intakes} onChange={reload} />
        )}
        {tab === 'list' && (
          <ListTab
            meds={meds}
            onAdd={() => setAdding(true)}
            onEdit={(m) => setEditing(m)}
            onDelete={async (m) => {
              if (confirm(t('med.confirmDelete', { name: m.name }))) {
                await window.nv.deleteMedication(m.id);
                await reload();
              }
            }}
          />
        )}
        {tab === 'history' && (
          <HistoryTab meds={meds} intakes={intakes} />
        )}

        {(editing || adding) && (
          <MedEditor
            initial={editing}
            onCancel={() => { setEditing(null); setAdding(false); }}
            onSave={async (data) => {
              await window.nv.saveMedication(data);
              setEditing(null);
              setAdding(false);
              await reload();
              toast('success', t('med.save'));
            }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TODAY TAB
// ============================================================================

function TodayTab({ meds, intakes, onChange }: { meds: Medication[]; intakes: Intake[]; onChange: () => Promise<void> }) {
  const t = useT();
  const df = useDateFmt();
  const toast = useStore((s) => s.toast);

  const todayItems = useMemo(() => generateScheduleForDay(meds, new Date()), [meds]);
  const status = useMemo(() => {
    return todayItems.map((it) => {
      const intake = intakes.find((x) => x.medId === it.medId && x.scheduledFor === it.scheduledFor);
      return { ...it, intake };
    });
  }, [todayItems, intakes]);

  const taken = status.filter((s) => s.intake?.takenAt).length;
  const total = status.length;
  const upcoming = status.filter((s) => !s.intake?.takenAt && !s.intake?.skipped && s.scheduledFor >= Date.now()).length;
  const streakDays = computeStreakDays(meds, intakes);
  const brokeYesterday = didBreakStreakYesterday(meds, intakes);
  const lowStock = meds.filter((m) => typeof m.stock === 'number' && m.stock !== null && m.stock <= m.refillThreshold);

  const message = useMemo(
    () => getEncouragement({
      totalToday: total,
      takenToday: taken,
      upcomingToday: upcoming,
      streakDays,
      brokeYesterday,
      hasMeds: meds.length > 0,
    }),
    [total, taken, upcoming, streakDays, brokeYesterday, meds.length],
  );

  // Group by time band
  const groups = useMemo(() => groupByPart(status), [status]);

  async function setTaken(medId: string, scheduledFor: number, taken: boolean) {
    await window.nv.markIntake(medId, scheduledFor, taken, false);
    if (taken) toast('success', getTakenJustNowMessage());
    await onChange();
  }
  async function skip(medId: string, scheduledFor: number) {
    await window.nv.markIntake(medId, scheduledFor, false, true);
    await onChange();
  }
  async function undo(medId: string, scheduledFor: number) {
    await window.nv.clearIntake(medId, scheduledFor);
    await onChange();
  }

  return (
    <div className="space-y-6">
      {/* Top: progress ring + encouragement */}
      <div className="grid grid-cols-3 gap-4">
        <div className="theme-card-soft rounded-xl p-5 border theme-border-soft flex items-center gap-4">
          <ProgressRing taken={taken} total={total} />
          <div>
            <div className="text-sm theme-muted">{t('med.adherence')}</div>
            <div className="text-2xl font-bold theme-text tabular-nums">
              {total === 0 ? '—' : `${Math.round((taken / total) * 100)}%`}
            </div>
            <div className="text-xs theme-muted">{t('med.todayProgress', { done: taken, total })}</div>
          </div>
        </div>
        <div className="theme-card-soft rounded-xl p-5 border theme-border-soft flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white"
            style={{ background: streakDays > 0 ? 'linear-gradient(135deg, #fbbf24, #F37223)' : '#9ca3af' }}
          >
            <span className="text-xl font-bold">{streakDays}</span>
          </div>
          <div>
            <div className="text-sm theme-muted">{t('med.streak')}</div>
            <div className="text-lg font-semibold theme-text">
              {streakDays} {streakDays === 1 ? t('med.streakDay') : t('med.streakDays')}
            </div>
          </div>
        </div>
        <div className="theme-card-soft rounded-xl p-5 border theme-border-soft flex items-start gap-3">
          <Sparkles size={18} className="theme-accent shrink-0 mt-0.5" />
          <div>
            <div className="text-xs uppercase tracking-wider theme-muted font-semibold mb-1">{t('med.encourage.title')}</div>
            <div className="text-sm theme-text leading-snug">{message}</div>
          </div>
        </div>
      </div>

      {/* Low stock alerts */}
      {lowStock.map((m) => (
        <div key={m.id} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 flex items-center gap-2 text-sm">
          <AlertTriangle size={14} className="text-amber-600" />
          <span className="theme-text">{getLowStockMessage(m.name)}</span>
          <span className="theme-muted ml-auto">{m.stock ?? 0} doses</span>
        </div>
      ))}

      {/* Schedule by time band */}
      {total === 0 ? (
        <EmptyState label={meds.length === 0 ? t('med.empty.list') : t('med.empty.today')} />
      ) : (
        Object.entries(groups).map(([part, items]) =>
          items.length === 0 ? null : (
            <section key={part}>
              <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider theme-muted font-semibold">
                {partIcon(part as PartOfDay)}
                {t(`med.${part}` as any)}
              </div>
              <div className="space-y-2">
                {items.map((s) => (
                  <IntakeRow key={`${s.medId}-${s.scheduledFor}`}
                    item={s}
                    onTake={() => setTaken(s.medId, s.scheduledFor, true)}
                    onSkip={() => skip(s.medId, s.scheduledFor)}
                    onUndo={() => undo(s.medId, s.scheduledFor)}
                    timeFmt={df.time}
                  />
                ))}
              </div>
            </section>
          ),
        )
      )}
    </div>
  );
}

function IntakeRow({ item, onTake, onSkip, onUndo, timeFmt }: {
  item: ReturnType<typeof generateScheduleForDay>[number] & { intake?: Intake };
  onTake: () => void; onSkip: () => void; onUndo: () => void;
  timeFmt: (d: Date | number) => string;
}) {
  const t = useT();
  const taken = !!item.intake?.takenAt;
  const skipped = !!item.intake?.skipped;
  return (
    <div className={`theme-card rounded-xl border theme-border-soft px-4 py-3 flex items-center gap-3 transition ${
      taken ? 'opacity-70' : ''
    }`}>
      <div className="w-1.5 self-stretch rounded" style={{ background: item.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-semibold theme-text ${taken ? 'line-through theme-muted' : ''}`}>{item.name}</span>
          {item.dosage && <span className="text-xs theme-pill px-1.5 py-0.5 rounded">{item.dosage}</span>}
        </div>
        <div className="text-xs theme-muted mt-0.5 flex items-center gap-1.5">
          <ClockIcon size={11} />
          {item.time}
          {taken && <span> · {t('med.takenAt', { time: timeFmt(item.intake!.takenAt!) })}</span>}
          {skipped && <span> · {t('med.skipped')}</span>}
        </div>
      </div>
      {taken || skipped ? (
        <button
          onClick={onUndo}
          className="text-xs px-3 py-1.5 rounded-lg theme-muted hover:theme-text hover:theme-hover"
        >
          {t('med.undo')}
        </button>
      ) : (
        <>
          <button
            onClick={onSkip}
            className="text-xs px-3 py-1.5 rounded-lg theme-muted hover:theme-text hover:theme-hover"
          >
            <X size={12} className="inline mr-1" />
            {t('med.skip')}
          </button>
          <button
            onClick={onTake}
            className="text-xs px-3 py-1.5 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm"
          >
            <Check size={12} className="inline mr-1" />
            {t('med.take')}
          </button>
        </>
      )}
    </div>
  );
}

function ProgressRing({ taken, total }: { taken: number; total: number }) {
  const pct = total === 0 ? 0 : taken / total;
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <svg width={62} height={62} viewBox="0 0 62 62" className="shrink-0">
      <circle cx="31" cy="31" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
      <circle
        cx="31" cy="31" r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="6"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round"
        transform="rotate(-90 31 31)"
        style={{ transition: 'stroke-dashoffset 400ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      />
      <text x="31" y="36" textAnchor="middle" className="theme-text" fontSize="14" fontWeight="700" fill="var(--text)">
        {taken}/{total || '—'}
      </text>
    </svg>
  );
}

// ============================================================================
// LIST TAB
// ============================================================================

function ListTab({ meds, onAdd, onEdit, onDelete }: {
  meds: Medication[];
  onAdd: () => void;
  onEdit: (m: Medication) => void;
  onDelete: (m: Medication) => void;
}) {
  const t = useT();

  return (
    <div className="space-y-4">
      <button
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed theme-border hover:theme-hover theme-muted hover:theme-text transition"
      >
        <Plus size={16} /> {t('med.add')}
      </button>

      {meds.length === 0 ? (
        <EmptyState label={t('med.empty.list')} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {meds.map((m) => (
            <div key={m.id} className="theme-card rounded-xl border theme-border-soft overflow-hidden relative group">
              <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: m.color }} />
              <div className="p-4 pl-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold theme-text">{m.name}</h3>
                    {m.dosage && <p className="text-xs theme-muted mt-0.5">{m.dosage}</p>}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition">
                    <button onClick={() => onEdit(m)} className="p-1 rounded hover:theme-hover theme-muted hover:theme-text">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => onDelete(m)} className="p-1 rounded hover:bg-red-500/10 theme-muted hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {m.notes && <p className="text-xs theme-muted mt-2 line-clamp-2">{m.notes}</p>}
                <div className="flex flex-wrap gap-1 mt-3">
                  {m.schedule.map((s) => (
                    <span key={s} className="text-[10px] theme-pill px-1.5 py-0.5 rounded font-mono">{s}</span>
                  ))}
                </div>
                {m.daysOfWeek.length > 0 && m.daysOfWeek.length < 7 && (
                  <div className="flex gap-0.5 mt-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <span
                        key={d}
                        className={`text-[9px] w-5 text-center py-0.5 rounded ${
                          m.daysOfWeek.includes(d) ? 'theme-accent-bg text-white' : 'theme-muted'
                        }`}
                      >
                        {t(`med.day.${d}` as any).slice(0, 1)}
                      </span>
                    ))}
                  </div>
                )}
                {typeof m.stock === 'number' && (
                  <div className="text-xs theme-muted mt-2 flex items-center gap-1.5">
                    <span>Stock: <span className={`font-semibold ${m.stock <= m.refillThreshold ? 'text-amber-600' : 'theme-text'}`}>{m.stock}</span></span>
                    {m.stock <= m.refillThreshold && <AlertTriangle size={10} className="text-amber-500" />}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HISTORY TAB
// ============================================================================

function HistoryTab({ meds, intakes }: { meds: Medication[]; intakes: Intake[] }) {
  const t = useT();
  const df = useDateFmt();

  const last7 = computeAdherence(meds, intakes, 7);
  const last30 = computeAdherence(meds, intakes, 30);
  const heatmap = computeHeatmap(meds, intakes, 30);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="theme-card-soft rounded-xl p-5 border theme-border-soft">
          <div className="text-xs uppercase tracking-wider theme-muted font-semibold">{t('med.last7')}</div>
          <div className="text-3xl font-bold theme-text mt-1">{Math.round(last7.pct * 100)}%</div>
          <div className="text-xs theme-muted">{last7.taken} / {last7.total}</div>
        </div>
        <div className="theme-card-soft rounded-xl p-5 border theme-border-soft">
          <div className="text-xs uppercase tracking-wider theme-muted font-semibold">{t('med.last30')}</div>
          <div className="text-3xl font-bold theme-text mt-1">{Math.round(last30.pct * 100)}%</div>
          <div className="text-xs theme-muted">{last30.taken} / {last30.total}</div>
        </div>
      </div>

      <div className="theme-card rounded-xl p-5 border theme-border-soft">
        <div className="text-xs uppercase tracking-wider theme-muted font-semibold mb-3">{t('med.last30')}</div>
        <div className="grid grid-cols-[repeat(30,1fr)] gap-1">
          {heatmap.map((d) => (
            <div
              key={d.dateStr}
              title={`${d.dateStr} — ${d.taken}/${d.total}`}
              className="aspect-square rounded-sm"
              style={{
                background:
                  d.total === 0 ? 'var(--border-soft)' :
                  d.pct === 1 ? '#10b981' :
                  d.pct >= 0.5 ? '#fbbf24' :
                  d.pct > 0 ? '#f97316' :
                  '#ef4444',
                opacity: d.total === 0 ? 0.4 : 0.85,
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 text-[10px] theme-muted mt-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#10b981' }} /> 100%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#fbbf24' }} /> ≥50%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#f97316' }} /> &lt;50%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#ef4444' }} /> 0%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: 'var(--border-soft)' }} /> {t('med.empty.today')}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EDITOR MODAL
// ============================================================================

function MedEditor({ initial, onSave, onCancel }: {
  initial: Medication | null;
  onSave: (m: Partial<Medication> & { name: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<Partial<Medication>>({
    id: initial?.id,
    name: initial?.name ?? '',
    dosage: initial?.dosage ?? '',
    notes: initial?.notes ?? '',
    color: initial?.color ?? PRESET_COLORS[0],
    schedule: initial?.schedule ?? ['08:00'],
    daysOfWeek: initial?.daysOfWeek ?? [],
    stock: initial?.stock ?? null,
    refillThreshold: initial?.refillThreshold ?? 5,
    active: initial?.active ?? true,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="theme-card rounded-xl shadow-2xl border theme-border w-full max-w-lg overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b theme-border-soft">
          <h2 className="font-semibold theme-text text-sm">{initial ? t('med.edit') : t('med.add')}</h2>
          <button onClick={onCancel} className="theme-muted hover:theme-text"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <Field label={t('med.fieldName')}>
            <input
              autoFocus
              value={draft.name ?? ''}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full theme-input rounded px-3 py-2 outline-none"
              placeholder="Doliprane"
            />
          </Field>
          <Field label={t('med.fieldDosage')}>
            <input
              value={draft.dosage ?? ''}
              onChange={(e) => setDraft({ ...draft, dosage: e.target.value })}
              className="w-full theme-input rounded px-3 py-2 outline-none"
              placeholder={t('med.fieldDosagePh')}
            />
          </Field>
          <Field label={t('med.fieldColor')}>
            <div className="flex gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setDraft({ ...draft, color: c })}
                  className={`w-8 h-8 rounded-full border-2 transition ${draft.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
          <Field label={t('med.fieldSchedule')}>
            {/* Quick-pick presets for the most common medication schedules */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {([
                { id: 'morning', label: t('med.morning'), times: ['08:00'] },
                { id: 'noon', label: t('med.noon'), times: ['12:30'] },
                { id: 'evening', label: t('med.evening'), times: ['19:00'] },
                { id: 'night', label: t('med.night'), times: ['22:00'] },
                { id: '2x', label: '2× / jour', times: ['08:00', '20:00'] },
                { id: '3x', label: '3× / jour', times: ['08:00', '13:00', '20:00'] },
                { id: '4x', label: '4× / jour', times: ['07:00', '12:00', '17:00', '22:00'] },
              ] as const).map((p) => {
                const active = JSON.stringify(draft.schedule ?? []) === JSON.stringify(p.times);
                return (
                  <button
                    key={p.id}
                    onClick={() => setDraft({ ...draft, schedule: [...p.times] })}
                    className={`text-xs px-2.5 py-1 rounded-full transition ${
                      active ? 'theme-accent-bg text-white shadow-sm' : 'theme-card border theme-border-soft hover:theme-hover theme-muted hover:theme-text'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {/* Editable list of times */}
            <div className="flex flex-wrap gap-2">
              {(draft.schedule ?? []).map((s, idx) => (
                <div key={idx} className="flex items-center gap-1 theme-input rounded px-2 py-1">
                  <input
                    type="time"
                    value={s}
                    onChange={(e) => {
                      const next = [...(draft.schedule ?? [])];
                      next[idx] = e.target.value;
                      setDraft({ ...draft, schedule: next });
                    }}
                    className="bg-transparent outline-none theme-text text-sm font-mono"
                  />
                  <button
                    onClick={() => setDraft({ ...draft, schedule: (draft.schedule ?? []).filter((_, i) => i !== idx) })}
                    className="theme-muted hover:text-red-500"
                    title={t('med.removeTime')}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setDraft({ ...draft, schedule: [...(draft.schedule ?? []), '12:00'] })}
                className="text-xs theme-muted hover:theme-text px-2 py-1 rounded hover:theme-hover border theme-border-soft border-dashed"
              >
                {t('med.addTime')}
              </button>
            </div>
            {(draft.schedule ?? []).length === 0 && (
              <p className="text-xs text-amber-600 mt-2">⚠ Au moins un horaire est requis pour les rappels.</p>
            )}
          </Field>

          <Field label={t('med.fieldDays')}>
            {/* "Every day" / "Weekdays" / "Weekend" presets */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {([
                { id: 'all', label: t('med.fieldDaysAll'), days: [] as number[] },
                { id: 'weekdays', label: 'Lun → Ven', days: [1, 2, 3, 4, 5] },
                { id: 'weekend', label: 'Sam-Dim', days: [0, 6] },
              ] as const).map((p) => {
                const cur = draft.daysOfWeek ?? [];
                const isPresetActive =
                  (p.days.length === 0 && cur.length === 0) ||
                  (p.days.length > 0 && p.days.length === cur.length && p.days.every((d) => cur.includes(d)));
                return (
                  <button
                    key={p.id}
                    onClick={() => setDraft({ ...draft, daysOfWeek: [...p.days] })}
                    className={`text-xs px-2.5 py-1 rounded-full transition ${
                      isPresetActive ? 'theme-accent-bg text-white shadow-sm' : 'theme-card border theme-border-soft hover:theme-hover theme-muted hover:theme-text'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const active = (draft.daysOfWeek ?? []).length === 0 || (draft.daysOfWeek ?? []).includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => {
                      const cur = draft.daysOfWeek ?? [];
                      const all = cur.length === 0;
                      let next = all ? [0, 1, 2, 3, 4, 5, 6] : cur.slice();
                      if (next.includes(d)) next = next.filter((x) => x !== d);
                      else next.push(d);
                      if (next.length === 7) next = [];
                      setDraft({ ...draft, daysOfWeek: next });
                    }}
                    className={`text-xs w-10 py-2 rounded-lg font-medium ${
                      active ? 'theme-accent-bg text-white shadow-sm' : 'theme-card border theme-border-soft theme-muted hover:theme-hover'
                    }`}
                  >
                    {t(`med.day.${d}` as any)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs theme-muted mt-2">
              {(draft.daysOfWeek ?? []).length === 0
                ? `✓ ${t('med.fieldDaysAll')}`
                : `${(draft.daysOfWeek ?? []).length} jour${(draft.daysOfWeek ?? []).length > 1 ? 's' : ''} sélectionné${(draft.daysOfWeek ?? []).length > 1 ? 's' : ''}`}
            </p>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('med.fieldStock')}>
              <input
                type="number"
                value={draft.stock ?? ''}
                onChange={(e) => setDraft({ ...draft, stock: e.target.value === '' ? null : Number(e.target.value) })}
                className="w-full theme-input rounded px-3 py-2 outline-none"
                placeholder="—"
              />
            </Field>
            <Field label={t('med.fieldRefill')}>
              <input
                type="number"
                value={draft.refillThreshold ?? 5}
                onChange={(e) => setDraft({ ...draft, refillThreshold: Number(e.target.value) })}
                className="w-full theme-input rounded px-3 py-2 outline-none"
              />
            </Field>
          </div>
          <Field label={t('med.fieldNotes')}>
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={3}
              className="w-full theme-input rounded px-3 py-2 outline-none"
              placeholder={t('med.fieldNotesPh')}
            />
          </Field>
        </div>
        <div className="px-4 py-3 border-t theme-border-soft flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded hover:theme-hover theme-muted hover:theme-text">
            {t('med.cancel')}
          </button>
          <button
            onClick={() => draft.name?.trim() && onSave({ ...draft, name: draft.name.trim() } as any)}
            disabled={!draft.name?.trim()}
            className="text-sm px-4 py-1.5 rounded text-white theme-accent-bg hover:opacity-90 disabled:opacity-40 shadow-sm"
          >
            {t('med.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider theme-muted font-semibold block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="theme-card-soft rounded-xl px-6 py-10 text-center border theme-border-soft border-dashed">
      <Pill size={28} className="mx-auto theme-muted mb-3 opacity-50" />
      <p className="text-sm theme-text">{label}</p>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

type PartOfDay = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

function partOfDay(time: string): PartOfDay {
  const [h] = time.split(':').map(Number);
  if (h < 11) return 'morning';
  if (h < 14) return 'noon';
  if (h < 18) return 'afternoon';
  if (h < 22) return 'evening';
  return 'night';
}

function partIcon(p: PartOfDay) {
  const map: Record<PartOfDay, React.ReactNode> = {
    morning: <Sun size={11} />, noon: <Coffee size={11} />, afternoon: <Sun size={11} />,
    evening: <Sun size={11} />, night: <Moon size={11} />,
  };
  return map[p];
}

function groupByPart<T extends { time: string }>(items: T[]): Record<PartOfDay, T[]> {
  const groups: Record<PartOfDay, T[]> = { morning: [], noon: [], afternoon: [], evening: [], night: [] };
  for (const it of items) groups[partOfDay(it.time)].push(it);
  for (const k of Object.keys(groups) as PartOfDay[]) groups[k].sort((a, b) => a.time.localeCompare(b.time));
  return groups;
}

/** Generate the day's scheduled intake instances (no DB writes). */
function generateScheduleForDay(meds: Medication[], date: Date): {
  medId: string; name: string; dosage: string; color: string; time: string; scheduledFor: number;
}[] {
  const dow = date.getDay();
  const out: { medId: string; name: string; dosage: string; color: string; time: string; scheduledFor: number }[] = [];
  for (const m of meds) {
    if (!m.active) continue;
    if (m.daysOfWeek.length > 0 && !m.daysOfWeek.includes(dow)) continue;
    for (const time of m.schedule) {
      const [h, mi] = time.split(':').map(Number);
      const d = new Date(date);
      d.setHours(h, mi, 0, 0);
      out.push({
        medId: m.id,
        name: m.name,
        dosage: m.dosage,
        color: m.color,
        time,
        scheduledFor: d.getTime(),
      });
    }
  }
  return out.sort((a, b) => a.scheduledFor - b.scheduledFor);
}

function computeAdherence(meds: Medication[], intakes: Intake[], days: number): { taken: number; total: number; pct: number } {
  let taken = 0, total = 0;
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const expected = generateScheduleForDay(meds, d);
    for (const e of expected) {
      // Don't count future intakes today
      if (e.scheduledFor > Date.now()) continue;
      total++;
      const intake = intakes.find((x) => x.medId === e.medId && x.scheduledFor === e.scheduledFor);
      if (intake?.takenAt) taken++;
    }
  }
  return { taken, total, pct: total === 0 ? 0 : taken / total };
}

function computeHeatmap(meds: Medication[], intakes: Intake[], days: number): { dateStr: string; taken: number; total: number; pct: number }[] {
  const out: { dateStr: string; taken: number; total: number; pct: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const expected = generateScheduleForDay(meds, d);
    let taken = 0, total = 0;
    for (const e of expected) {
      if (e.scheduledFor > Date.now()) continue;
      total++;
      const intake = intakes.find((x) => x.medId === e.medId && x.scheduledFor === e.scheduledFor);
      if (intake?.takenAt) taken++;
    }
    out.push({
      dateStr: d.toISOString().slice(0, 10),
      taken, total,
      pct: total === 0 ? 0 : taken / total,
    });
  }
  return out;
}

function computeStreakDays(meds: Medication[], intakes: Intake[]): number {
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const expected = generateScheduleForDay(meds, d);
    // Day with no scheduled intakes = neutral (does not break streak, does not count)
    if (expected.length === 0) continue;
    // For today, only count if there's been at least one taken
    const day = expected.filter((e) => e.scheduledFor <= Date.now());
    if (day.length === 0) continue;
    const allTaken = day.every((e) => intakes.some((x) => x.medId === e.medId && x.scheduledFor === e.scheduledFor && x.takenAt));
    if (!allTaken) {
      // For "today", be lenient: don't break streak yet
      if (i === 0) continue;
      break;
    }
    streak++;
  }
  return streak;
}

function didBreakStreakYesterday(meds: Medication[], intakes: Intake[]): boolean {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  const expected = generateScheduleForDay(meds, d);
  if (expected.length === 0) return false;
  return !expected.every((e) => intakes.some((x) => x.medId === e.medId && x.scheduledFor === e.scheduledFor && x.takenAt));
}
