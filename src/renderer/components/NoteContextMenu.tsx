import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { useT } from '../i18n';
import {
  Copy, Pin, PinOff, Trash2, RotateCcw, Palette, FolderInput, ExternalLink, Tag, Star, Zap,
} from 'lucide-react';
import type { ColorLabel, NoteMeta } from '../types';
import { tagPillStyle } from '../tagColors';

const COLORS: { id: ColorLabel; hex: string }[] = [
  { id: '', hex: 'transparent' },
  { id: 'red', hex: '#ef4444' },
  { id: 'orange', hex: '#f97316' },
  { id: 'yellow', hex: '#eab308' },
  { id: 'green', hex: '#22c55e' },
  { id: 'blue', hex: '#3b82f6' },
  { id: 'purple', hex: '#a855f7' },
  { id: 'pink', hex: '#ec4899' },
];

export function NoteContextMenu({ note, x, y, onClose, onDuplicateAsk }: {
  note: NoteMeta;
  x: number;
  y: number;
  onClose: () => void;
  onDuplicateAsk?: (note: NoteMeta) => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const { togglePin, trash, restore, deleteForever, setColor, moveNotes, selectNote, index } = useStore();
  const [tagInput, setTagInput] = useState('');
  const [showTagPanel, setShowTagPanel] = useState(false);

  // Suggest existing tags as the user types.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of index.notes) if (!n.trashed) for (const tg of n.tags) set.add(tg);
    return Array.from(set).sort();
  }, [index.notes]);
  const suggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    return allTags.filter((tg) => !note.tags.includes(tg) && (q === '' || tg.toLowerCase().includes(q))).slice(0, 6);
  }, [allTags, tagInput, note.tags]);

  async function addTag(tag: string) {
    const t = tag.trim().replace(/^#/, '');
    if (!t || note.tags.includes(t)) return;
    await window.nv.saveNote({ id: note.id, tags: [...note.tags, t] });
    await useStore.getState().refresh();
    setTagInput('');
  }
  async function removeTag(tag: string) {
    await window.nv.saveNote({ id: note.id, tags: note.tags.filter((x) => x !== tag) });
    await useStore.getState().refresh();
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Keep menu within viewport
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let nx = x, ny = y;
    if (rect.right > vw) nx = vw - rect.width - 8;
    if (rect.bottom > vh) ny = vh - rect.height - 8;
    if (nx !== x || ny !== y) {
      ref.current.style.left = `${nx}px`;
      ref.current.style.top = `${ny}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="fixed z-50 theme-popover rounded-lg shadow-2xl border theme-border min-w-[200px] py-1 pop-in"
      style={{ left: x, top: y }}
    >
      <Item icon={<ExternalLink size={13} />} onClick={() => { void selectNote(note.id); onClose(); }}>
        {t('tasks.openNote')}
      </Item>
      <Item icon={<Copy size={13} />} onClick={() => { onDuplicateAsk?.(note); }} hint="Ctrl+Shift+D">
        {t('editor.duplicate')}
      </Item>
      {!note.trashed && (
        <Item icon={note.pinned ? <PinOff size={13} /> : <Pin size={13} />} onClick={async () => { await togglePin(note.id); onClose(); }}>
          {note.pinned ? t('editor.unpin') : t('editor.pin')}
        </Item>
      )}
      {!note.trashed && (
        <Item
          icon={<Star size={13} style={{ color: note.important ? '#eab308' : undefined, fill: note.important ? '#eab308' : 'none' }} />}
          onClick={async () => {
            await window.nv.saveNote({ id: note.id, important: !note.important } as any);
            await useStore.getState().refresh();
            onClose();
          }}
        >
          {note.important ? 'Retirer "importante"' : 'Marquer importante'}
        </Item>
      )}
      {!note.trashed && (
        <Item
          icon={<Zap size={13} style={{ color: note.urgent ? '#3b82f6' : undefined, fill: note.urgent ? '#3b82f6' : 'none' }} />}
          onClick={async () => {
            await window.nv.saveNote({ id: note.id, urgent: !note.urgent } as any);
            await useStore.getState().refresh();
            onClose();
          }}
        >
          {note.urgent ? 'Retirer "urgente"' : 'Marquer urgente'}
        </Item>
      )}
      {!note.trashed && (
        <ColorRow current={note.color} onPick={async (c) => { await setColor(note.id, c); onClose(); }} />
      )}
      {!note.trashed && (
        <div>
          <Item icon={<Tag size={13} />} onClick={() => setShowTagPanel((v) => !v)}>
            {t('ctx.assignTag')}
          </Item>
          {showTagPanel && (
            <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); void addTag(tagInput); }
                  else if (e.key === 'Escape') setShowTagPanel(false);
                }}
                placeholder={t('ctx.tagPlaceholder')}
                className="w-full theme-input rounded px-2 py-1 text-xs outline-none"
              />
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {note.tags.map((tg) => (
                    <button
                      key={tg}
                      onClick={() => void removeTag(tg)}
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium hover:opacity-70 flex items-center gap-1"
                      style={tagPillStyle(tg)}
                    >
                      #{tg} <span className="opacity-60">×</span>
                    </button>
                  ))}
                </div>
              )}
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {suggestions.map((tg) => (
                    <button
                      key={tg}
                      onClick={() => void addTag(tg)}
                      className="text-[10px] px-1.5 py-0.5 rounded border theme-border-soft theme-muted hover:theme-text hover:theme-hover"
                    >
                      + #{tg}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {!note.trashed && (
        <Submenu icon={<FolderInput size={13} />} label={t('editor.moveToNotebook')}>
          <div className="max-h-56 overflow-y-auto">
            {index.notebooks.map((nb) => (
              <button
                key={nb.id}
                onClick={async () => { await moveNotes([note.id], nb.id); onClose(); }}
                className={`w-full text-left px-3 py-1.5 text-sm rounded hover:theme-hover ${
                  nb.id === note.notebookId ? 'theme-accent font-medium' : 'theme-text'
                }`}
              >
                {nb.name === 'Inbox' ? 'Notes rapides' : nb.name}
              </button>
            ))}
          </div>
        </Submenu>
      )}
      <div className="my-1 border-t theme-border-soft" />
      {note.trashed ? (
        <>
          <Item icon={<RotateCcw size={13} />} onClick={async () => { await restore(note.id); onClose(); }}>
            {t('editor.restore')}
          </Item>
          <Item icon={<Trash2 size={13} />} onClick={async () => { await deleteForever(note.id); onClose(); }} danger>
            {t('editor.deleteForever')}
          </Item>
        </>
      ) : (
        <Item icon={<Trash2 size={13} />} onClick={async () => { await trash(note.id); onClose(); }} danger>
          {t('editor.moveToTrash')}
        </Item>
      )}
    </div>
  );
}

function Item({ icon, children, onClick, danger, hint }: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left rounded hover:theme-hover ${
        danger ? 'text-red-400' : 'theme-text'
      }`}
    >
      <span className={danger ? 'text-red-400' : 'theme-muted'}>{icon}</span>
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[10px] theme-muted">{hint}</span>}
    </button>
  );
}

function ColorRow({ current, onPick }: { current: ColorLabel; onPick: (c: ColorLabel) => void }) {
  const t = useT();
  return (
    <div className="px-3 py-1.5 flex items-center gap-2">
      <Palette size={13} className="theme-muted" />
      <span className="text-xs theme-muted flex-1">{t('editor.colorLabel')}</span>
      <div className="flex gap-1">
        {COLORS.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            title={c.id || '—'}
            className={`w-4 h-4 rounded-full transition hover:scale-125 ${current === c.id ? 'ring-2 ring-offset-1 ring-offset-current' : ''}`}
            style={{
              background: c.hex,
              border: c.id ? 'none' : '1px dashed currentColor',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Submenu({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="group relative">
      <button className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left hover:theme-hover theme-text">
        <span className="theme-muted">{icon}</span>
        <span className="flex-1">{label}</span>
        <span className="theme-muted">›</span>
      </button>
      <div className="hidden group-hover:block absolute top-0 left-full ml-1 theme-popover rounded-lg shadow-2xl border theme-border min-w-[200px] py-1">
        {children}
      </div>
    </div>
  );
}
