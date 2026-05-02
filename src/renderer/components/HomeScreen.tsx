import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useT } from '../i18n';
import { useDateFmt } from '../dateFmt';
import { useLabels } from '../labels';
import { useSettings } from '../settings';
import { Logo } from './Logo';
import {
  Plus, Sparkles, Calendar, Upload, FileText, Pin, Tag as TagIcon,
  Notebook as NotebookIcon, Lightbulb, Clock, ArrowRight, FileEdit,
  Pill, Check,
} from 'lucide-react';
import { TriskellMark, openTriskellSite, TRISKELL_URL } from './TriskellMark';
import { getTakenJustNowMessage } from '../med/encouragements';
import { tagPillStyle } from '../tagColors';
import type { ColorLabel, NoteMeta } from '../types';

const COLOR_HEX: Record<ColorLabel, string> = {
  '': 'transparent',
  red: '#ef4444', orange: '#f97316', yellow: '#eab308',
  green: '#22c55e', blue: '#3b82f6', purple: '#a855f7', pink: '#ec4899',
};

export default function HomeScreen() {
  const { index, newNote, openModal, selectNote, refresh } = useStore();
  const settings = useSettings((s) => s.settings);
  const t = useT();
  const df = useDateFmt();
  const lbl = useLabels();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    let base: string;
    if (h < 6) base = t('home.night');
    else if (h < 12) base = t('home.morning');
    else if (h < 18) base = t('home.afternoon');
    else if (h < 23) base = t('home.evening');
    else base = t('home.night');
    const name = settings.firstName?.trim();
    return name ? `${base} ${name}` : base;
  }, [t, settings.firstName]);

  const tip = useMemo(() => {
    const idx = Math.floor(Date.now() / (1000 * 60 * 60)) % 7;
    return t(`home.tip.${idx}` as any);
  }, [t]);

  const stats = useMemo(() => {
    const tagSet = new Set<string>();
    let notes = 0, words = 0;
    for (const n of index.notes) {
      if (n.trashed) continue;
      notes++;
      words += n.wordCount || 0;
      for (const tg of n.tags) tagSet.add(tg);
    }
    return { notes, words, tags: tagSet.size, notebooks: index.notebooks.length };
  }, [index.notes, index.notebooks]);

  const recents = useMemo(
    () => index.notes.filter((n) => !n.trashed).slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
    [index.notes],
  );
  const pinned = useMemo(
    () => index.notes.filter((n) => !n.trashed && n.pinned).slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8),
    [index.notes],
  );
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of index.notes) if (!n.trashed) for (const tg of n.tags) counts.set(tg, (counts.get(tg) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 18);
  }, [index.notes]);

  async function createTodayNote() {
    const today = new Date();
    const title = df.full(today).split(/\s·\s/)[0] || df.iso(today);
    let journalNb = index.notebooks.find((n) => n.name === 'Journal');
    if (!journalNb) {
      journalNb = await window.nv.createNotebook('Journal', null);
    }
    const seed = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: greeting }] },
        { type: 'paragraph' },
      ],
    });
    const n = await window.nv.createNote(journalNb.id, { title, content: seed });
    await refresh();
    void selectNote(n.id);
  }

  async function importFile() {
    const view = useStore.getState().view;
    const nbId = view.kind === 'notebook' ? view.id : (index.notebooks[0]?.id ?? 'inbox');
    const note = await window.nv.importText(nbId);
    if (note) {
      await refresh();
      void selectNote(note.id);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto theme-bg relative">
      {/* Subtle caribbean sun decoration in the background */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-72 overflow-hidden pointer-events-none">
        <SunRays />
      </div>

      <div className="relative max-w-5xl mx-auto px-8 pt-10 pb-16">
        {/* Greeting */}
        <header className="flex items-center gap-5 mb-10">
          <Logo size={64} className="drop-shadow-md" />
          <div>
            <h1 className="text-3xl font-bold theme-text tracking-tight">{greeting}</h1>
            <p className="text-sm theme-muted mt-1">{t('home.subtitle')}</p>
          </div>
        </header>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-3 mb-10">
          <StatTile icon={<FileText size={16} />} value={stats.notes} label={t('home.stats.notes')} accent="#F37223" />
          <StatTile icon={<NotebookIcon size={16} />} value={stats.notebooks} label={t('home.stats.notebooks')} accent="#0d9488" />
          <StatTile icon={<FileEdit size={16} />} value={stats.words.toLocaleString()} label={t('home.stats.words')} accent="#3b82f6" />
          <StatTile icon={<TagIcon size={16} />} value={stats.tags} label={t('home.stats.tags')} accent="#a855f7" />
        </div>

        {/* Today's medications widget — only when there are meds configured */}
        <TodayMedsWidget t={t} />

        {/* Quick actions */}
        <Section label={t('home.quickActions')}>
          <div className="grid grid-cols-4 gap-3">
            <ActionCard
              icon={<Plus size={18} />}
              accent="#F37223"
              title={t('home.action.newNote')}
              hint={t('home.action.newNote.hint')}
              onClick={() => void newNote()}
            />
            <ActionCard
              icon={<Sparkles size={18} />}
              accent="#a855f7"
              title={t('home.action.template')}
              hint={t('home.action.template.hint')}
              onClick={() => openModal('templates')}
            />
            <ActionCard
              icon={<Calendar size={18} />}
              accent="#0d9488"
              title={t('home.action.today')}
              hint={t('home.action.today.hint')}
              onClick={() => void createTodayNote()}
            />
            <ActionCard
              icon={<Upload size={18} />}
              accent="#3b82f6"
              title={t('home.action.import')}
              hint={t('home.action.import.hint')}
              onClick={() => void importFile()}
            />
          </div>
        </Section>

        {/* Recent notes */}
        <Section label={t('home.recent')} icon={<Clock size={14} />}>
          {recents.length === 0 ? (
            <EmptyHint label={t('home.empty.recent')} />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {recents.map((n) => (
                <NoteCard key={n.id} note={n} onClick={() => void selectNote(n.id)} t={t} df={df} lbl={lbl} />
              ))}
            </div>
          )}
        </Section>

        {/* Pinned */}
        {settings.enablePinning && pinned.length > 0 && (
          <Section label={t('home.pinned')} icon={<Pin size={14} />}>
            <div className="flex flex-wrap gap-2">
              {pinned.map((n) => (
                <button
                  key={n.id}
                  onClick={() => void selectNote(n.id)}
                  className="theme-card-soft hover:theme-hover px-3 py-2 rounded-lg flex items-center gap-2 text-sm theme-text border theme-border-soft transition group"
                >
                  {n.color && <span className="w-2 h-2 rounded-full" style={{ background: COLOR_HEX[n.color] }} />}
                  <Pin size={11} className="theme-accent" />
                  <span className="truncate max-w-[160px]">{lbl.noteTitle(n.title)}</span>
                  <ArrowRight size={11} className="theme-muted opacity-0 group-hover:opacity-100 transition" />
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Tag cloud */}
        {settings.enableTags && tags.length > 0 && (
          <Section label={t('home.tags')} icon={<TagIcon size={14} />}>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => useStore.getState().setView({ kind: 'tag', tag })}
                  className="px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 hover:scale-105 transition shadow-sm"
                  style={{ ...tagPillStyle(tag), fontSize: `${Math.min(14, 11 + Math.log(count + 1) * 1.5)}px` }}
                >
                  #{tag}
                  <span className="opacity-60">{count}</span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Tip of the day */}
        <div className="mt-10 theme-card-soft rounded-xl p-4 flex items-start gap-3 border theme-border-soft">
          <div
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #fbbf24, #F37223)' }}
          >
            <Lightbulb size={16} className="text-white" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider theme-muted font-semibold mb-0.5">{t('home.tip.title')}</div>
            <div className="text-sm theme-text">{tip}</div>
          </div>
        </div>

        {/* Discreet studio credit — clickable, opens triskell-studio.fr */}
        <button
          onClick={openTriskellSite}
          title={`${t('studio.tag')} — ${TRISKELL_URL}`}
          aria-label={`${t('studio.tag')} — ouvrir triskell-studio.fr`}
          className="mt-12 flex items-center justify-center gap-1.5 text-xs theme-muted opacity-60 hover:opacity-100 hover:theme-text transition cursor-pointer mx-auto"
        >
          <TriskellMark size={22} />
          <span className="text-sm">{t('studio.tag')}</span>
        </button>
      </div>
    </div>
  );
}

type MedSlot = { medId: string; name: string; dosage: string; color: string; time: string; scheduledFor: number; taken: boolean };
function TodayMedsWidget({ t }: { t: (k: any, p?: any) => string }) {
  const setView = useStore((s) => s.setView);
  const toast = useStore((s) => s.toast);
  const [items, setItems] = useState<MedSlot[]>([]);

  async function reload() {
    const [meds, intakes] = await Promise.all([window.nv.listMedications(), window.nv.listIntakes()]);
    const now = new Date();
    const dow = now.getDay();
    const out: MedSlot[] = [];
    for (const m of meds) {
      if (!m.active) continue;
      if (m.daysOfWeek.length > 0 && !m.daysOfWeek.includes(dow)) continue;
      for (const time of m.schedule) {
        const [h, mi] = time.split(':').map(Number);
        const d = new Date(now); d.setHours(h, mi, 0, 0);
        const at = d.getTime();
        const taken = intakes.some((x) => x.medId === m.id && x.scheduledFor === at && x.takenAt);
        out.push({ medId: m.id, name: m.name, dosage: m.dosage, color: m.color, time, scheduledFor: at, taken });
      }
    }
    out.sort((a, b) => a.scheduledFor - b.scheduledFor);
    setItems(out);
  }
  useEffect(() => { void reload(); }, []);

  if (items.length === 0) return null;
  const taken = items.filter((i) => i.taken).length;
  const allDone = taken === items.length;
  const next = items.find((i) => !i.taken);

  return (
    <section
      className="mb-8 rounded-2xl p-5 border relative overflow-hidden"
      style={{
        background: allDone
          ? 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(20,184,166,0.04))'
          : 'linear-gradient(135deg, rgba(13,148,136,0.10), rgba(20,184,166,0.04))',
        borderColor: allDone ? 'rgba(16,185,129,0.35)' : 'rgba(13,148,136,0.35)',
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
          style={{ background: allDone ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #0d9488, #14b8a6)' }}
        >
          <Pill size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold theme-text">{t('med.title')}</h3>
          <div className="text-xs theme-muted">{t('med.todayProgress', { done: taken, total: items.length })}</div>
        </div>
        <button
          onClick={() => setView({ kind: 'meds' })}
          className="text-xs theme-text px-3 py-1.5 rounded-lg theme-card hover:theme-hover border theme-border-soft flex items-center gap-1"
        >
          {t('med.title')} <ArrowRight size={11} />
        </button>
      </div>
      {allDone ? (
        <div className="text-sm theme-text mt-2 flex items-center gap-2">
          <Check size={14} className="text-emerald-500" />
          <span>🎉 Tout pris aujourd'hui — chapeau bas.</span>
        </div>
      ) : next ? (
        <div className="theme-card rounded-lg border theme-border-soft px-3 py-2.5 flex items-center gap-3 mt-2">
          <div className="w-1 h-8 rounded shrink-0" style={{ background: next.color }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium theme-text">{next.name}</div>
            {next.dosage && <div className="text-xs theme-muted">{next.dosage} · {next.time}</div>}
          </div>
          <button
            onClick={async () => {
              await window.nv.markIntake(next.medId, next.scheduledFor, true, false);
              await reload();
              toast('success', getTakenJustNowMessage());
            }}
            className="text-xs px-3 py-1.5 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm flex items-center gap-1"
          >
            <Check size={12} /> {t('med.take')}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function StatTile({ icon, value, label, accent }: { icon: React.ReactNode; value: number | string; label: string; accent: string }) {
  return (
    <div className="theme-card-soft rounded-xl px-4 py-3 border theme-border-soft relative overflow-hidden">
      <div
        className="absolute right-0 top-0 w-16 h-16 rounded-full opacity-10 -translate-y-4 translate-x-4"
        style={{ background: accent }}
      />
      <div className="flex items-center gap-2 theme-muted text-xs">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold theme-text mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function ActionCard({ icon, title, hint, accent, onClick }: { icon: React.ReactNode; title: string; hint: string; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="theme-card hover:theme-hover rounded-xl p-4 text-left border theme-border-soft transition group hover:scale-[1.02] hover:shadow-md"
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white mb-3 transition group-hover:scale-110"
        style={{ background: accent }}
      >
        {icon}
      </div>
      <div className="font-semibold theme-text text-sm">{title}</div>
      <div className="text-xs theme-muted mt-0.5">{hint}</div>
    </button>
  );
}

function NoteCard({ note, onClick, t, df, lbl }: {
  note: NoteMeta;
  onClick: () => void;
  t: (k: any, p?: any) => string;
  df: any;
  lbl: any;
}) {
  return (
    <button
      onClick={onClick}
      className="theme-card hover:theme-hover rounded-xl p-3 text-left border theme-border-soft transition relative overflow-hidden hover:shadow-md hover:-translate-y-0.5"
    >
      {note.color && (
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: COLOR_HEX[note.color] }} />
      )}
      <div className="flex items-center gap-1.5 mb-1">
        {note.pinned && <Pin size={11} className="theme-accent" />}
        <h4 className="font-semibold theme-text truncate text-sm flex-1">{lbl.noteTitle(note.title)}</h4>
      </div>
      <p className="text-xs theme-muted line-clamp-2 min-h-[2.4em]">{note.excerpt || t('list.noContent')}</p>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="text-[10px] theme-muted">{df.shortTime(note.updatedAt)}</span>
        {note.tags.slice(0, 2).map((tg) => (
          <span key={tg} className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={tagPillStyle(tg)}>#{tg}</span>
        ))}
      </div>
    </button>
  );
}

function Section({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider theme-muted font-semibold">
        {icon}
        {label}
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ label }: { label: string }) {
  return <div className="theme-card-soft rounded-xl px-4 py-6 text-center text-sm theme-muted border theme-border-soft border-dashed">{label}</div>;
}

/** Decorative caribbean sun rays in the top corner (very subtle). */
function SunRays() {
  return (
    <svg
      className="absolute -top-32 -right-32 w-[420px] h-[420px] opacity-[0.07]"
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden
    >
      <defs>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#F37223" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="60" fill="url(#sun)" />
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const x1 = 100 + Math.cos(a) * 70;
        const y1 = 100 + Math.sin(a) * 70;
        const x2 = 100 + Math.cos(a) * 100;
        const y2 = 100 + Math.sin(a) * 100;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F37223" strokeWidth="2" strokeLinecap="round" />;
      })}
    </svg>
  );
}
