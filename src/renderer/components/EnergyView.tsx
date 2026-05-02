import { useEffect, useState } from 'react';
import { BatteryCharging, X, BatteryFull, BatteryMedium, BatteryLow, ArrowLeft, Bell, CalendarDays } from 'lucide-react';
import { useStore } from '../store';
import type { Reminder, CalendarEvent } from '../types';

/**
 * Anti-calendar « Énergie » — three lanes (high / medium / low) instead of
 * fixed time slots. The user drags reminders into the lane that matches the
 * level of energy they think the task needs. The placement is persisted
 * locally (per-reminder) so the next session keeps the layout.
 *
 * Why this and not just slots: many tasks ("écrire le rapport") need full
 * focus — better placed in a "high energy" lane the user can fit into a
 * morning, vs. a routine task ("classer les emails") that fits any low
 * energy moment. Helps people who don't keep rigid clock schedules.
 */

type Energy = 'high' | 'med' | 'low' | 'none';
type Map = Record<string, Energy>;

/** Single source of truth for "things you can place on the energy board". */
type Task = {
  id: string;            // prefixed with kind: "reminder:..." or "calendar:..."
  kind: 'reminder' | 'calendar';
  title: string;
  due: number;           // ms epoch (calendar events: 12:00 if all-day)
  rawId: string;         // underlying id (without prefix) for back-references
};

const STORAGE_KEY = 'delinote.energy.assignments.v1';

function loadMap(): Map { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }
function saveMap(m: Map) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch { /* ignore */ } }

function reminderToTask(r: Reminder): Task {
  return { id: `reminder:${r.id}`, kind: 'reminder', title: r.title, due: r.due, rawId: r.id };
}

function calendarEventToTask(e: CalendarEvent): Task {
  // Compose a real Date from "date" (YYYY-MM-DD) + optional "time" (HH:MM)
  const [y, m, d] = e.date.split('-').map(Number);
  let hours = 12, minutes = 0;
  if (e.time) [hours, minutes] = e.time.split(':').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hours, minutes, 0, 0);
  return { id: `calendar:${e.id}`, kind: 'calendar', title: e.title, due: dt.getTime(), rawId: e.id };
}

const LANES: { key: Exclude<Energy, 'none'>; label: string; sub: string; icon: React.ReactNode; color: string }[] = [
  { key: 'high', label: 'Haute énergie', sub: 'concentration · création · décisions', icon: <BatteryFull size={16} />, color: '#22c55e' },
  { key: 'med',  label: 'Énergie moyenne', sub: 'tâches habituelles · admin · routine', icon: <BatteryMedium size={16} />, color: '#eab308' },
  { key: 'low',  label: 'Basse énergie', sub: 'classer · répondre · ranger', icon: <BatteryLow size={16} />, color: '#f97316' },
];

export default function EnergyView({ onClose }: { onClose: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [map, setMap] = useState<Map>(loadMap);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverLane, setHoverLane] = useState<Energy | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [reminders, events] = await Promise.all([
          window.nv.listReminders(),
          window.nv.listCalendarEvents(),
        ]);
        // Open reminders only; calendar events from today onward (older
        // ones are noise — don't drown the board in past birthdays).
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const cutoff = todayStart.getTime();
        const all: Task[] = [
          ...reminders.filter((r) => !r.done).map(reminderToTask),
          ...events
            .map(calendarEventToTask)
            .filter((t) => t.due >= cutoff),
        ];
        // Earliest first
        all.sort((a, b) => a.due - b.due);
        if (alive) setTasks(all);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  function setEnergy(id: string, e: Energy) {
    setMap((prev) => {
      const next = { ...prev, [id]: e };
      saveMap(next);
      return next;
    });
  }

  function dropOn(lane: Energy) {
    if (draggingId) {
      setEnergy(draggingId, lane);
      setDraggingId(null);
      setHoverLane(null);
    }
  }

  const inbox = tasks.filter((task) => (map[task.id] ?? 'none') === 'none');

  return (
    <div className="fixed inset-0 z-[60] theme-bg flex flex-col">
      <div className="px-6 py-3 border-b theme-border-soft flex items-center gap-3">
        <BatteryCharging size={16} className="theme-accent" />
        <h2 className="font-semibold theme-text text-sm">Anti-calendrier — Énergie</h2>
        <span className="text-xs theme-muted ml-2">
          Glisse tes rappels dans la voie qui correspond à l&apos;énergie qu&apos;ils demandent.
        </span>
        <button onClick={onClose} className="ml-auto theme-muted hover:theme-text p-1 rounded" title="Fermer (Échap)">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Inbox of unsorted reminders */}
        <aside className="w-72 shrink-0 border-r theme-border-soft flex flex-col">
          <div className="px-4 py-2 border-b theme-border-soft flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider theme-muted font-bold">À placer</span>
            <span className="text-[10px] theme-muted">{inbox.length}</span>
          </div>
          <div
            className={`flex-1 overflow-y-auto p-3 space-y-2 transition ${
              hoverLane === 'none' ? 'theme-accent-bg-soft' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setHoverLane('none'); }}
            onDragLeave={() => setHoverLane((h) => (h === 'none' ? null : h))}
            onDrop={() => dropOn('none')}
          >
            {inbox.length === 0 ? (
              <div className="text-xs theme-muted text-center py-8">
                Tout est placé. Crée des rappels ou des évènements de calendrier, ou tire-les des voies →
              </div>
            ) : (
              inbox.map((task) => <Card key={task.id} task={task} onDragStart={() => setDraggingId(task.id)} />)
            )}
          </div>
        </aside>

        {/* Three lanes */}
        <div className="flex-1 flex">
          {LANES.map((lane) => {
            const laneItems = tasks.filter((task) => map[task.id] === lane.key);
            return (
              <div
                key={lane.key}
                className={`flex-1 flex flex-col border-r theme-border-soft last:border-r-0 transition ${
                  hoverLane === lane.key ? 'theme-accent-bg-soft' : ''
                }`}
                onDragOver={(e) => { e.preventDefault(); setHoverLane(lane.key); }}
                onDragLeave={() => setHoverLane((h) => (h === lane.key ? null : h))}
                onDrop={() => dropOn(lane.key)}
              >
                <div className="px-4 py-3 border-b theme-border-soft" style={{ borderTop: `3px solid ${lane.color}` }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color: lane.color }}>{lane.icon}</span>
                    <span className="text-sm font-semibold theme-text">{lane.label}</span>
                    <span className="text-[10px] theme-muted ml-auto">{laneItems.length}</span>
                  </div>
                  <p className="text-[11px] theme-muted mt-1">{lane.sub}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {laneItems.length === 0 ? (
                    <div className="text-xs theme-muted text-center py-12 italic">
                      Glisse ici les tâches qui demandent ce niveau d&apos;énergie.
                    </div>
                  ) : (
                    laneItems.map((task) => (
                      <Card
                        key={task.id}
                        task={task}
                        onDragStart={() => setDraggingId(task.id)}
                        onSendBack={() => setEnergy(task.id, 'none')}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Card({
  task, onDragStart, onSendBack,
}: {
  task: Task;
  onDragStart: () => void;
  onSendBack?: () => void;
}) {
  const due = new Date(task.due);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="theme-card border theme-border-soft rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:theme-hover transition shadow-sm group"
    >
      <div className="flex items-start gap-2">
        <span className="theme-muted shrink-0 mt-0.5" title={task.kind === 'reminder' ? 'Rappel' : 'Évènement de calendrier'}>
          {task.kind === 'reminder' ? <Bell size={12} /> : <CalendarDays size={12} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium theme-text line-clamp-2 leading-snug">
            {task.title}
          </div>
          <div className="text-[10px] theme-muted mt-0.5">
            {due.toLocaleString(navigator.language || 'fr-FR', {
              weekday: 'short', day: 'numeric', month: 'short',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        </div>
        {onSendBack && (
          <button
            onClick={(e) => { e.stopPropagation(); onSendBack(); }}
            className="theme-muted hover:theme-text opacity-0 group-hover:opacity-100 transition"
            title="Renvoyer dans À placer"
          >
            <ArrowLeft size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
