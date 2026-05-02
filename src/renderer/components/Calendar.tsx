import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useT } from '../i18n';
import { useDateFmt } from '../dateFmt';
import { useLabels } from '../labels';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, FileText,
  Pill, Bell, Plus, X, CalendarHeart, Clock as ClockIcon, Trash2, Edit2, Cake,
} from 'lucide-react';
import type { Medication, Intake, Reminder, CalendarEvent, Contact, ContactEvent } from '../types';

export default function Calendar() {
  const { index, selectNote, openTab, openModal, newNote } = useStore();
  const t = useT();
  const df = useDateFmt();
  const lbl = useLabels();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(() => Date.now());
  const [meds, setMeds] = useState<Medication[]>([]);
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [creatingDate, setCreatingDate] = useState<string | null>(null);

  async function reloadAll() {
    const [m, i, r, ce, co] = await Promise.all([
      window.nv.listMedications(),
      window.nv.listIntakes(),
      window.nv.listReminders(),
      window.nv.listCalendarEvents(),
      window.nv.listContacts(),
    ]);
    setMeds(m); setIntakes(i); setReminders(r); setCalEvents(ce); setContacts(co);
  }
  useEffect(() => { void reloadAll(); }, [index]);

  // Build month grid (6 rows of 7 days, Monday-first)
  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const todayKey = startOfDayKey(new Date());

  function dayInfo(date: Date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    const startMs = start.getTime();
    const endMs = end.getTime();

    const editedNotes = index.notes.filter((n) => !n.trashed && n.updatedAt >= startMs && n.updatedAt <= endMs);
    const createdNotes = index.notes.filter((n) => !n.trashed && n.createdAt >= startMs && n.createdAt <= endMs);

    // Med intakes scheduled this day
    const dow = start.getDay();
    const scheduled: { medId: string; name: string; color: string; time: string; scheduledFor: number }[] = [];
    for (const m of meds) {
      if (!m.active) continue;
      if (m.daysOfWeek.length > 0 && !m.daysOfWeek.includes(dow)) continue;
      for (const time of m.schedule) {
        const [h, mi] = time.split(':').map(Number);
        const d = new Date(start); d.setHours(h, mi, 0, 0);
        scheduled.push({ medId: m.id, name: m.name, color: m.color, time, scheduledFor: d.getTime() });
      }
    }
    const taken = scheduled.filter((s) => intakes.some((x) => x.medId === s.medId && x.scheduledFor === s.scheduledFor && x.takenAt));
    const adherence = scheduled.length === 0 ? null : taken.length / scheduled.length;

    const remindersDue = reminders.filter((r) => r.due >= startMs && r.due <= endMs);

    // Calendar events on this day (one-shot match exact date)
    const dateKey = isoDate(start);
    const events = calEvents.filter((e) => e.date === dateKey);

    // Contact events: yearly recurring birthdays/anniversaries on this day
    const contactEvents: { contact: Contact; event: ContactEvent }[] = [];
    for (const c of contacts) {
      for (const ev of c.events ?? []) {
        if (!ev.date) continue;
        const [, evMonth, evDay] = ev.date.split('-').map(Number);
        if (!evMonth || !evDay) continue;
        if (ev.yearly) {
          if (evMonth - 1 === start.getMonth() && evDay === start.getDate()) {
            contactEvents.push({ contact: c, event: ev });
          }
        } else if (ev.date === dateKey) {
          contactEvents.push({ contact: c, event: ev });
        }
      }
    }

    return { editedNotes, createdNotes, scheduled, taken, adherence, remindersDue, events, contactEvents };
  }

  const monthLabel = `${t(`cal.month.${cursor.getMonth()}` as any)} ${cursor.getFullYear()}`;

  const selectedDate = selectedDay ? new Date(selectedDay) : null;
  const selectedInfo = selectedDate ? dayInfo(selectedDate) : null;

  return (
    <div className="flex-1 flex theme-bg overflow-hidden">
      {/* Calendar */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 pt-8 pb-6">
          <header className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
              >
                <CalendarIcon size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold theme-text">{monthLabel}</h1>
                <p className="text-xs theme-muted">{t('cal.title')}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); }}
                title={t('cal.prev')}
                className="p-2 rounded-lg hover:theme-hover theme-muted hover:theme-text"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); setCursor(d); setSelectedDay(Date.now()); }}
                className="px-3 py-1.5 rounded-lg theme-card border theme-border-soft text-sm theme-text hover:theme-hover"
              >
                {t('cal.today')}
              </button>
              <button
                onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); }}
                title={t('cal.next')}
                className="p-2 rounded-lg hover:theme-hover theme-muted hover:theme-text"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </header>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <div key={d} className="text-[10px] uppercase tracking-wider theme-muted font-semibold text-center">
                {t(`cal.weekday.${d}` as any)}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-2">
            {grid.map((date) => {
              const inMonth = date.getMonth() === cursor.getMonth();
              const dayKey = startOfDayKey(date);
              const isToday = dayKey === todayKey;
              const isSelected = selectedDay && startOfDayKey(new Date(selectedDay)) === dayKey;
              const info = dayInfo(date);
              const hasNotes = info.editedNotes.length > 0;
              const hasReminders = info.remindersDue.length > 0;

              return (
                <button
                  key={date.getTime()}
                  onClick={() => setSelectedDay(date.getTime())}
                  className={`group aspect-square rounded-xl border p-2 text-left transition relative overflow-hidden ${
                    isSelected ? 'border-current theme-accent' :
                    isToday ? 'theme-accent-bg-soft border-current/30' :
                    'theme-card-soft theme-border-soft hover:theme-hover'
                  } ${!inMonth ? 'opacity-35' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${isToday ? 'theme-accent' : 'theme-text'}`}>
                      {date.getDate()}
                    </span>
                    {info.adherence !== null && (
                      <span
                        className="w-2 h-2 rounded-full"
                        title={`${info.taken.length}/${info.scheduled.length} pris`}
                        style={{ background:
                          info.adherence === 1 ? '#10b981' :
                          info.adherence >= 0.5 ? '#fbbf24' :
                          info.adherence > 0 ? '#f97316' : '#ef4444',
                        }}
                      />
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {hasNotes && (
                      <div className="flex items-center gap-1 text-[10px] theme-muted">
                        <FileText size={9} />
                        <span>{info.editedNotes.length}</span>
                      </div>
                    )}
                    {hasReminders && (
                      <div className="flex items-center gap-1 text-[10px] theme-muted">
                        <Bell size={9} />
                        <span>{info.remindersDue.length}</span>
                      </div>
                    )}
                    {info.events.length > 0 && (
                      <div className="space-y-0.5 mt-0.5">
                        {info.events.slice(0, 2).map((e) => (
                          <div
                            key={e.id}
                            className="text-[9px] px-1 py-0.5 rounded text-white truncate font-medium"
                            style={{ background: e.color }}
                          >
                            {e.time && <span className="opacity-80 mr-0.5">{e.time}</span>}
                            {e.title}
                          </div>
                        ))}
                        {info.events.length > 2 && (
                          <div className="text-[9px] theme-muted">+{info.events.length - 2}</div>
                        )}
                      </div>
                    )}
                    {info.contactEvents.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] mt-0.5">
                        <Cake size={9} className="text-pink-500" />
                        <span className="truncate text-pink-600 font-medium">
                          {info.contactEvents[0].contact.firstName}
                          {info.contactEvents.length > 1 ? ` +${info.contactEvents.length - 1}` : ''}
                        </span>
                      </div>
                    )}
                    {info.scheduled.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {info.scheduled.slice(0, 5).map((s, i) => (
                          <span key={i} className="w-1 h-1 rounded-full" style={{ background: s.color }} />
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right detail panel */}
      <aside className="w-80 shrink-0 border-l theme-border-soft theme-bg-soft overflow-y-auto">
        {selectedDate && selectedInfo ? (
          <div className="p-4">
            <div className="flex items-start justify-between mb-4 gap-2">
              <div>
                <h3 className="font-bold theme-text">{df.full(selectedDate)}</h3>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setCreatingDate(isoDate(selectedDate))}
                  title="Créer un évènement"
                  className="px-2 py-1.5 rounded-lg theme-accent-bg text-white hover:opacity-90 shadow-sm flex items-center gap-1 text-xs"
                >
                  <CalendarHeart size={12} /> Évènement
                </button>
                <button
                  onClick={async () => {
                    const view = useStore.getState().view;
                    const nbId = view.kind === 'notebook' ? view.id : (index.notebooks[0]?.id ?? 'inbox');
                    const today = selectedDate.toLocaleDateString();
                    const note = await window.nv.createNote(nbId, { title: today, content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }) });
                    await useStore.getState().refresh();
                    void selectNote(note.id);
                  }}
                  title="Créer une note pour ce jour"
                  className="p-1.5 rounded-lg theme-card border theme-border-soft hover:theme-hover"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {selectedInfo.editedNotes.length === 0 && selectedInfo.scheduled.length === 0 && selectedInfo.remindersDue.length === 0 && selectedInfo.events.length === 0 && selectedInfo.contactEvents.length === 0 && (
              <p className="text-sm theme-muted">{t('cal.empty')}</p>
            )}

            {/* Calendar events created by the user */}
            {selectedInfo.events.length > 0 && (
              <DaySection title="Évènements" icon={<CalendarHeart size={12} />}>
                {selectedInfo.events.map((e) => (
                  <div key={e.id} className="px-2 py-1.5 text-sm rounded hover:theme-hover flex items-center gap-2 group">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.color }} />
                    <span className="flex-1 truncate theme-text">{e.title}</span>
                    {e.time && <span className="text-[10px] theme-muted font-mono">{e.time}</span>}
                    <button
                      onClick={() => setEditingEvent(e)}
                      className="opacity-0 group-hover:opacity-100 theme-muted hover:theme-text"
                      title="Modifier"
                    ><Edit2 size={11} /></button>
                    <button
                      onClick={async () => {
                        if (confirm(`Supprimer "${e.title}" ?`)) {
                          await window.nv.deleteCalendarEvent(e.id);
                          await reloadAll();
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 theme-muted hover:text-red-500"
                      title="Supprimer"
                    ><Trash2 size={11} /></button>
                  </div>
                ))}
              </DaySection>
            )}

            {/* Birthdays / contact events on this day */}
            {selectedInfo.contactEvents.length > 0 && (
              <DaySection title="Dates contacts" icon={<Cake size={12} />}>
                {selectedInfo.contactEvents.map((ce, i) => (
                  <div key={i} className="px-2 py-1.5 text-sm rounded flex items-center gap-2">
                    {ce.event.kind === 'birthday' ? <Cake size={11} className="text-pink-500" /> : <CalendarHeart size={11} className="text-pink-500" />}
                    <span className="flex-1 truncate theme-text">
                      <span className="font-medium">{ce.contact.firstName} {ce.contact.lastName}</span>
                      <span className="theme-muted"> · {ce.event.label || (ce.event.kind === 'birthday' ? 'Anniversaire' : 'Évènement')}</span>
                    </span>
                  </div>
                ))}
              </DaySection>
            )}

            {selectedInfo.editedNotes.length > 0 && (
              <DaySection title={t('cal.notesEdited')} icon={<FileText size={12} />}>
                {selectedInfo.editedNotes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { void selectNote(n.id); openTab(n.id); }}
                    className="w-full text-left text-sm theme-text px-2 py-1.5 rounded hover:theme-hover truncate flex items-center gap-2"
                  >
                    {n.color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorHex(n.color) }} />}
                    <span className="truncate">{lbl.noteTitle(n.title)}</span>
                  </button>
                ))}
              </DaySection>
            )}

            {selectedInfo.scheduled.length > 0 && (
              <DaySection title={t('cal.medsTaken')} icon={<Pill size={12} />}>
                {selectedInfo.scheduled.map((s, i) => {
                  const taken = intakes.some((x) => x.medId === s.medId && x.scheduledFor === s.scheduledFor && x.takenAt);
                  return (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className={taken ? 'theme-muted line-through' : 'theme-text'}>{s.name}</span>
                      <span className="ml-auto text-[10px] theme-muted font-mono">{s.time}</span>
                      {taken && <span className="text-[10px] text-green-500">✓</span>}
                    </div>
                  );
                })}
              </DaySection>
            )}

            {selectedInfo.remindersDue.length > 0 && (
              <DaySection title={t('cal.remindersDue')} icon={<Bell size={12} />}>
                {selectedInfo.remindersDue.map((r) => (
                  <div key={r.id} className="px-2 py-1 text-sm theme-text flex items-center gap-2">
                    <Bell size={11} className="theme-muted" />
                    <span className="flex-1 truncate">{r.title}</span>
                    <span className="text-[10px] theme-muted font-mono">{df.time(r.due)}</span>
                  </div>
                ))}
              </DaySection>
            )}
          </div>
        ) : (
          <div className="p-6 text-sm theme-muted text-center">
            Sélectionne un jour pour voir les détails.
          </div>
        )}
      </aside>

      {(creatingDate || editingEvent) && (
        <EventEditor
          initial={editingEvent}
          defaultDate={creatingDate ?? (editingEvent?.date ?? isoDate(new Date()))}
          onCancel={() => { setCreatingDate(null); setEditingEvent(null); }}
          onSave={async (data) => {
            await window.nv.saveCalendarEvent(data);
            setCreatingDate(null);
            setEditingEvent(null);
            await reloadAll();
            useStore.getState().toast('success', 'Évènement enregistré');
          }}
        />
      )}
    </div>
  );
}

function DaySection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-wider theme-muted font-semibold">
        {icon}
        {title}
      </div>
      <div>{children}</div>
    </section>
  );
}

function colorHex(c: string): string {
  const map: Record<string, string> = {
    red: '#ef4444', orange: '#f97316', yellow: '#eab308',
    green: '#22c55e', blue: '#3b82f6', purple: '#a855f7', pink: '#ec4899',
  };
  return map[c] ?? c;
}

function startOfDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** YYYY-MM-DD in local time. */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const EVENT_COLORS = ['#3b82f6', '#0d9488', '#F37223', '#a855f7', '#ec4899', '#22c55e', '#f59e0b', '#ef4444'];

export function EventEditor({ initial, defaultDate, onSave, onCancel }: {
  initial: CalendarEvent | null;
  defaultDate: string;
  onSave: (e: Partial<CalendarEvent> & { title: string; date: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Partial<CalendarEvent>>({
    id: initial?.id,
    title: initial?.title ?? '',
    date: initial?.date ?? defaultDate,
    time: initial?.time ?? null,
    notes: initial?.notes ?? '',
    color: initial?.color ?? EVENT_COLORS[0],
    remindBeforeDays: initial?.remindBeforeDays ?? [0],
    contactId: initial?.contactId ?? null,
  });

  function toggleReminder(days: number) {
    const set = new Set(draft.remindBeforeDays ?? []);
    set.has(days) ? set.delete(days) : set.add(days);
    setDraft({ ...draft, remindBeforeDays: Array.from(set).sort((a, b) => b - a) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/40 backdrop-blur-sm pop-in" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="theme-card border theme-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b theme-border-soft">
          <h2 className="font-semibold theme-text text-sm flex items-center gap-2">
            <CalendarHeart size={14} /> {initial ? 'Modifier l\'évènement' : 'Nouvel évènement'}
          </h2>
          <button onClick={onCancel} className="theme-muted hover:theme-text"><X size={14} /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs uppercase tracking-wider theme-muted font-semibold block mb-1.5">Titre</label>
            <input
              autoFocus
              value={draft.title ?? ''}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Réunion, RDV, Vacances…"
              className="w-full theme-input rounded px-3 py-2 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider theme-muted font-semibold block mb-1.5">Date</label>
              <input
                type="date"
                value={draft.date ?? ''}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="w-full theme-input rounded px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider theme-muted font-semibold block mb-1.5">Heure (optionnel)</label>
              <input
                type="time"
                value={draft.time ?? ''}
                onChange={(e) => setDraft({ ...draft, time: e.target.value || null })}
                className="w-full theme-input rounded px-3 py-2 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider theme-muted font-semibold block mb-1.5">Couleur</label>
            <div className="flex gap-1.5">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setDraft({ ...draft, color: c })}
                  className={`w-7 h-7 rounded-full transition ${draft.color === c ? 'ring-2 ring-offset-2 ring-offset-current ring-current scale-110' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider theme-muted font-semibold block mb-1.5">Me prévenir</label>
            <div className="flex flex-wrap gap-1.5">
              {[30, 14, 7, 3, 1, 0].map((d) => {
                const active = (draft.remindBeforeDays ?? []).includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleReminder(d)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                      active ? 'theme-accent-bg text-white shadow-sm' : 'theme-card border theme-border-soft hover:theme-hover theme-muted'
                    }`}
                  >
                    {d === 0 ? <><Bell size={11} /> Le jour J</> : <>{d} j avant</>}
                  </button>
                );
              })}
            </div>
            {(draft.remindBeforeDays ?? []).length === 0 && (
              <p className="text-[10px] theme-muted mt-1.5">Aucun rappel — choisis au moins une option pour être prévenu.</p>
            )}
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider theme-muted font-semibold block mb-1.5">Notes (optionnel)</label>
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={3}
              className="w-full theme-input rounded px-3 py-2 outline-none"
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t theme-border-soft flex justify-end gap-2 theme-bg-soft">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded theme-muted hover:theme-text hover:theme-hover">Annuler</button>
          <button
            onClick={() => draft.title?.trim() && draft.date && onSave({ ...draft, title: draft.title.trim(), date: draft.date } as any)}
            disabled={!draft.title?.trim() || !draft.date}
            className="text-sm px-4 py-1.5 rounded text-white theme-accent-bg hover:opacity-90 disabled:opacity-40 shadow-sm"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function buildMonthGrid(monthStart: Date): Date[] {
  const start = new Date(monthStart);
  // Find Monday on/before the 1st
  const dow = start.getDay();
  const offset = (dow + 6) % 7; // 0 = Mon
  start.setDate(1 - offset);
  // 6 weeks = 42 days
  const out: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    d.setHours(0, 0, 0, 0);
    out.push(d);
  }
  return out;
}
