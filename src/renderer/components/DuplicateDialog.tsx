import { useState } from 'react';
import { Copy, X, Minus, Plus } from 'lucide-react';
import { useT } from '../i18n';
import { useStore } from '../store';
import { useLabels } from '../labels';
import type { NoteMeta } from '../types';

const QUICK_COUNTS = [1, 2, 3, 5, 10];

export function DuplicateDialog({ note, onClose }: { note: NoteMeta; onClose: () => void }) {
  const t = useT();
  const lbl = useLabels();
  const duplicate = useStore((s) => s.duplicate);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    await duplicate(note.id, count);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="theme-card border theme-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden pop-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b theme-border-soft">
          <h2 className="font-semibold theme-text text-sm flex items-center gap-2">
            <Copy size={14} /> {t('dup.title')}
          </h2>
          <button onClick={onClose} className="theme-muted hover:theme-text"><X size={14} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="theme-card-soft rounded-lg p-3 border theme-border-soft">
            <div className="text-xs uppercase tracking-wider theme-muted font-semibold mb-1">{t('dup.source')}</div>
            <div className="text-sm theme-text truncate font-medium">{lbl.noteTitle(note.title)}</div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider theme-muted font-semibold mb-2">{t('dup.howMany')}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCount(Math.max(1, count - 1))}
                disabled={count <= 1}
                className="w-9 h-9 rounded-lg theme-card border theme-border-soft hover:theme-hover flex items-center justify-center disabled:opacity-30"
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                onKeyDown={(e) => { if (e.key === 'Enter') void go(); }}
                className="theme-input rounded-lg px-3 py-2 text-center text-2xl font-bold tabular-nums w-24 outline-none"
              />
              <button
                onClick={() => setCount(Math.min(50, count + 1))}
                disabled={count >= 50}
                className="w-9 h-9 rounded-lg theme-card border theme-border-soft hover:theme-hover flex items-center justify-center disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
              <span className="text-xs theme-muted ml-2">{count > 1 ? t('dup.copies') : t('dup.copy')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {QUICK_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition ${
                    count === n ? 'theme-accent-bg text-white shadow-sm' : 'theme-card border theme-border-soft hover:theme-hover theme-muted hover:theme-text'
                  }`}
                >
                  ×{n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t theme-border-soft flex justify-end gap-2 theme-bg-soft">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-lg theme-muted hover:theme-text hover:theme-hover"
          >
            {t('settings.cancel')}
          </button>
          <button
            onClick={go}
            disabled={busy || count < 1}
            className="text-sm px-4 py-1.5 rounded-lg text-white theme-accent-bg hover:opacity-90 disabled:opacity-40 shadow-sm flex items-center gap-1.5"
          >
            <Copy size={13} /> {t('dup.confirm', { n: count })}
          </button>
        </div>
      </div>
    </div>
  );
}
