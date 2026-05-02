import { useEffect, useMemo, useState } from 'react';
import { History, RotateCcw, X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useStore } from '../store';
import { useDateFmt } from '../dateFmt';
import { generateHTML } from '@tiptap/html';
import { buildExtensions } from '../editorExtensions';
import { useSettings } from '../settings';
import type { Snapshot } from '../types';

/**
 * Time-travel scrubber — a slider over a note's snapshot history.
 *
 * Uses the snapshots DéliNote already takes automatically (every ~2 minutes
 * while editing). The user drags the slider to see a preview of the note as
 * it was at any past point. A single click on "Restaurer" replaces the
 * current content with the selected snapshot.
 *
 * Mounted as a floating panel above the editor — closes via the X button
 * or by hitting Escape.
 */
export default function TimeTravelScrubber({ onClose }: { onClose: () => void }) {
  const { snapshots, restoreSnapshot, loadSnapshots, current } = useStore();
  const settings = useSettings((s) => s.settings);
  const df = useDateFmt();
  const [idx, setIdx] = useState(0);

  // Sort oldest → newest for natural left-to-right scrubbing.
  const ordered: Snapshot[] = useMemo(() => {
    return [...snapshots].sort((a, b) => a.takenAt - b.takenAt);
  }, [snapshots]);

  useEffect(() => {
    void loadSnapshots();
  }, [current?.id, loadSnapshots]);

  // Land on the most recent snapshot whenever the list refreshes.
  useEffect(() => {
    setIdx(Math.max(0, ordered.length - 1));
  }, [ordered.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && idx > 0) setIdx(idx - 1);
      else if (e.key === 'ArrowRight' && idx < ordered.length - 1) setIdx(idx + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, ordered.length, onClose]);

  const extensions = useMemo(() => buildExtensions(settings), [settings]);

  if (!current) return null;
  if (ordered.length === 0) {
    return (
      <Panel onClose={onClose}>
        <div className="text-sm theme-muted text-center py-8">
          Aucun instantané enregistré pour cette note.
          <br />
          <span className="text-xs">Les instantanés sont créés automatiquement toutes les ~2 minutes pendant que tu écris.</span>
        </div>
      </Panel>
    );
  }

  const snap = ordered[idx];
  let previewHtml = '';
  try {
    const json = JSON.parse(snap.content);
    previewHtml = generateHTML(json, extensions);
  } catch {
    previewHtml = `<pre>${escapeHtml(snap.text || '')}</pre>`;
  }

  async function restore() {
    await restoreSnapshot(snap.id);
    onClose();
  }

  return (
    <Panel onClose={onClose}>
      <div className="px-4 py-3 border-b theme-border-soft flex items-center gap-2">
        <History size={16} className="theme-accent" />
        <h3 className="text-sm font-semibold theme-text flex-1">Retour dans le temps</h3>
        <button onClick={onClose} className="theme-muted hover:theme-text p-1 rounded">
          <X size={14} />
        </button>
      </div>

      <div className="px-4 py-2 border-b theme-border-soft flex items-center gap-2 text-xs theme-muted">
        <button
          onClick={() => setIdx(0)}
          disabled={idx === 0}
          className="theme-muted hover:theme-text disabled:opacity-30"
          title="Plus ancien"
        >
          <ChevronsLeft size={14} />
        </button>
        <input
          type="range"
          min={0}
          max={ordered.length - 1}
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          className="flex-1"
        />
        <button
          onClick={() => setIdx(ordered.length - 1)}
          disabled={idx === ordered.length - 1}
          className="theme-muted hover:theme-text disabled:opacity-30"
          title="Plus récent"
        >
          <ChevronsRight size={14} />
        </button>
        <span className="tabular-nums text-[11px] shrink-0 ml-2">
          {idx + 1} / {ordered.length}
        </span>
      </div>

      <div className="px-4 py-2 border-b theme-border-soft flex items-center justify-between gap-2">
        <div>
          <div className="text-xs theme-muted">Version du</div>
          <div className="text-sm theme-text font-medium">{df.full(snap.takenAt)}</div>
        </div>
        <button
          onClick={restore}
          className="text-xs px-3 py-1.5 rounded-lg theme-accent-bg text-white hover:opacity-90 inline-flex items-center gap-1.5"
        >
          <RotateCcw size={12} /> Restaurer cette version
        </button>
      </div>

      <div className="overflow-y-auto max-h-[50vh] px-4 py-3 prose-sm theme-text">
        <div className="text-xs theme-muted mb-2 font-medium">{snap.title || 'Sans titre'}</div>
        <div
          className="text-sm leading-relaxed time-travel-preview"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </Panel>
  );
}

function Panel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(11,11,15,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Retour dans le temps"
    >
      <div
        className="theme-card rounded-2xl shadow-2xl border theme-border w-full max-w-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c] as string);
}
