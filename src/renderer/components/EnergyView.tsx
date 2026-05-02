import { useEffect, useState } from 'react';
import { BatteryCharging, X, BatteryFull, BatteryMedium, BatteryLow, ArrowLeft } from 'lucide-react';
import { useStore } from '../store';
import type { Reminder } from '../types';

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

const STORAGE_KEY = 'delinote.energy.assignments.v1';

function loadMap(): Map { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }
function saveMap(m: Map) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch { /* ignore */ } }

const LANES: { key: Exclude<Energy, 'none'>; label: string; sub: string; icon: React.ReactNode; color: string }[] = [
  { key: 'high', label: 'Haute énergie', sub: 'concentration · création · décisions', icon: <BatteryFull size={16} />, color: '#22c55e' },
  { key: 'med',  label: 'Énergie moyenne', sub: 'tâches habituelles · admin · routine', icon: <BatteryMedium size={16} />, color: '#eab308' },
  { key: 'low',  label: 'Basse énergie', sub: 'classer · répondre · ranger', icon: <BatteryLow size={16} />, color: '#f97316' },
];

export default function EnergyView({ onClose }: { onClose: () => void }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [map, setMap] = useState<Map>(loadMap);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverLane, setHoverLane] = useState<Energy | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await window.nv.listReminders();
        if (alive) setReminders(list.filter((r) => !r.done));
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

  const inbox = reminders.filter((r) => (map[r.id] ?? 'none') === 'none');

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
                Tous tes rappels actifs sont déjà placés. Crée-en de nouveaux ou tire-les des voies →
              </div>
            ) : (
              inbox.map((r) => <Card key={r.id} reminder={r} onDragStart={() => setDraggingId(r.id)} />)
            )}
          </div>
        </aside>

        {/* Three lanes */}
        <div className="flex-1 flex">
          {LANES.map((lane) => {
            const items = reminders.filter((r) => map[r.id] === lane.key);
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
                    <span className="text-[10px] theme-muted ml-auto">{items.length}</span>
                  </div>
                  <p className="text-[11px] theme-muted mt-1">{lane.sub}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {items.length === 0 ? (
                    <div className="text-xs theme-muted text-center py-12 italic">
                      Glisse ici les tâches qui demandent ce niveau d&apos;énergie.
                    </div>
                  ) : (
                    items.map((r) => (
                      <Card
                        key={r.id}
                        reminder={r}
                        onDragStart={() => setDraggingId(r.id)}
                        onSendBack={() => setEnergy(r.id, 'none')}
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
  reminder, onDragStart, onSendBack,
}: {
  reminder: Reminder;
  onDragStart: () => void;
  onSendBack?: () => void;
}) {
  const due = new Date(reminder.due);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="theme-card border theme-border-soft rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:theme-hover transition shadow-sm group"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium theme-text line-clamp-2 leading-snug">
            {reminder.title}
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
