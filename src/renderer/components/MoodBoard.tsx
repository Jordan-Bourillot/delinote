import { useEffect, useRef, useState } from 'react';
import { Layout, X, Plus, Type as TypeIcon, Image as ImageIcon, Trash2, Download } from 'lucide-react';
import { useStore } from '../store';

/**
 * Mood-board — a free-form canvas where each item (text snippet, image,
 * sticky note) is positionable by drag-and-drop. Each board is **scoped
 * to a note**: open the moodboard from a note's menu and you get that
 * note's canvas. A "global" board (no note open) keeps the same UX as
 * before for users who launched it from the sidebar.
 *
 * Items support:
 *   - text  : editable rich text inside a sticky-note look
 *   - image : pasted/dropped image (rescaled to ≤ 1024 px wide as data URL)
 *
 * Storage: one localStorage key per board, indexed by noteId (or
 * "__global" when no note is open).
 *
 * Interactions:
 *   - Drag to move
 *   - Right-click → delete (or hover → trash button)
 *   - Double-click text item → edit
 *   - Drop an image file onto the canvas → add image item at cursor position
 *   - Paste from clipboard → add image (or text) at center
 */

type ItemBase = { id: string; x: number; y: number; w: number; h: number; rotate: number };
type TextItem = ItemBase & { kind: 'text'; text: string; color: string };
type ImageItem = ItemBase & { kind: 'image'; src: string; alt?: string };
type Item = TextItem | ImageItem;

const STORAGE_PREFIX = 'delinote.moodboard.v2.';
const LEGACY_GLOBAL_KEY = 'delinote.moodboard.v1';
const STICKY_COLORS = ['#fef3c7', '#fee2e2', '#dcfce7', '#dbeafe', '#ede9fe', '#fce7f3'];

function storageKey(noteId: string | null): string {
  return STORAGE_PREFIX + (noteId ?? '__global');
}
function loadItems(noteId: string | null): Item[] {
  try { return JSON.parse(localStorage.getItem(storageKey(noteId)) || '[]'); } catch { return []; }
}
function saveItems(noteId: string | null, items: Item[]) {
  try { localStorage.setItem(storageKey(noteId), JSON.stringify(items)); } catch { /* ignore */ }
}

// One-shot migration of the v1 single-board into the new global slot, so users
// who already started a moodboard before this change don't lose their work.
function migrateLegacy() {
  try {
    const legacy = localStorage.getItem(LEGACY_GLOBAL_KEY);
    if (!legacy) return;
    const newKey = storageKey(null);
    if (!localStorage.getItem(newKey)) localStorage.setItem(newKey, legacy);
    localStorage.removeItem(LEGACY_GLOBAL_KEY);
  } catch { /* ignore */ }
}

export default function MoodBoard({ onClose, noteId }: { onClose: () => void; noteId?: string | null }) {
  const current = useStore((s) => s.current);
  const effectiveId = noteId !== undefined ? noteId : current?.id ?? null;
  const noteTitle = effectiveId === null ? 'Mood-board global' : (current?.title || 'Sans titre');
  const [items, setItems] = useState<Item[]>(() => { migrateLegacy(); return loadItems(effectiveId); });
  const [editingId, setEditingId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Reload items if the underlying note changes (different boards per note).
  useEffect(() => {
    setItems(loadItems(effectiveId));
    setEditingId(null);
  }, [effectiveId]);

  useEffect(() => { saveItems(effectiveId, items); }, [effectiveId, items]);

  function addText(x: number, y: number) {
    const it: TextItem = {
      id: crypto.randomUUID(),
      kind: 'text',
      text: 'Nouveau pense-bête',
      x, y, w: 200, h: 120, rotate: (Math.random() - 0.5) * 4,
      color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
    };
    setItems((s) => [...s, it]);
    setEditingId(it.id);
  }

  function addImage(src: string, x: number, y: number) {
    const it: ImageItem = {
      id: crypto.randomUUID(),
      kind: 'image',
      src,
      x, y, w: 240, h: 180, rotate: (Math.random() - 0.5) * 3,
    };
    setItems((s) => [...s, it]);
  }

  function update(id: string, patch: Partial<Item>) {
    setItems((s) => s.map((it) => (it.id === id ? { ...it, ...patch } as Item : it)));
  }
  function remove(id: string) {
    setItems((s) => s.filter((it) => it.id !== id));
    if (editingId === id) setEditingId(null);
  }

  // Paste handler — image or text
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        void readFileAsDataUrl(file).then((src) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          addImage(src, (rect?.width ?? 800) / 2 - 120, (rect?.height ?? 600) / 2 - 90);
        });
        return;
      }
      const text = e.clipboardData.getData('text/plain');
      if (text && document.activeElement === document.body) {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        const x = (rect?.width ?? 800) / 2 - 100;
        const y = (rect?.height ?? 600) / 2 - 60;
        const it: TextItem = {
          id: crypto.randomUUID(),
          kind: 'text',
          text,
          x, y, w: 200, h: 120, rotate: 0,
          color: STICKY_COLORS[0],
        };
        setItems((s) => [...s, it]);
      }
    }
    window.addEventListener('paste', onPaste as any);
    return () => window.removeEventListener('paste', onPaste as any);
  }, []);

  // Drop file onto canvas
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0) - 120;
    const y = e.clientY - (rect?.top ?? 0) - 90;
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
    if (file) void readFileAsDataUrl(file).then((src) => addImage(src, x, y));
  }

  function onCanvasDoubleClick(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0) - 100;
    const y = e.clientY - (rect?.top ?? 0) - 60;
    addText(Math.max(0, x), Math.max(0, y));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moodboard-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-[60] theme-bg flex flex-col">
      <div className="px-6 py-3 border-b theme-border-soft flex items-center gap-3">
        <Layout size={16} className="theme-accent" />
        <h2 className="font-semibold theme-text text-sm">
          Mood-board {effectiveId !== null && <span className="theme-muted font-normal">— {noteTitle}</span>}
        </h2>
        <span className="text-xs theme-muted">
          Double-clic pour ajouter un mot · glisse une image · colle (Ctrl+V) du texte/image
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => addText(80 + Math.random() * 200, 80 + Math.random() * 200)}
            className="text-xs px-2.5 py-1 rounded theme-input hover:theme-hover inline-flex items-center gap-1.5"
          >
            <TypeIcon size={12} /> Pense-bête
          </button>
          <label className="text-xs px-2.5 py-1 rounded theme-input hover:theme-hover inline-flex items-center gap-1.5 cursor-pointer">
            <ImageIcon size={12} /> Image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const src = await readFileAsDataUrl(f);
                  const rect = canvasRef.current?.getBoundingClientRect();
                  addImage(src, (rect?.width ?? 800) / 2 - 120, (rect?.height ?? 600) / 2 - 90);
                }
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={exportJson}
            className="text-xs px-2.5 py-1 rounded theme-input hover:theme-hover inline-flex items-center gap-1.5"
            title="Exporter le mood-board en JSON"
          >
            <Download size={12} />
          </button>
          <button onClick={onClose} className="theme-muted hover:theme-text p-1 rounded" title="Fermer">
            <X size={14} />
          </button>
        </div>
      </div>

      <div
        ref={canvasRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onDoubleClick={onCanvasDoubleClick}
        className="flex-1 relative overflow-auto"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {items.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center theme-muted">
              <Plus size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Double-clique n&apos;importe où pour poser un pense-bête</p>
              <p className="text-xs mt-1">Tu peux aussi glisser des images ou coller depuis le presse-papier</p>
            </div>
          </div>
        )}

        {items.map((it) => (
          <BoardItemView
            key={it.id}
            item={it}
            editing={editingId === it.id}
            onStartEdit={() => it.kind === 'text' && setEditingId(it.id)}
            onStopEdit={() => setEditingId(null)}
            onUpdate={(p) => update(it.id, p)}
            onRemove={() => remove(it.id)}
          />
        ))}
      </div>
    </div>
  );
}

function BoardItemView({
  item, editing, onStartEdit, onStopEdit, onUpdate, onRemove,
}: {
  item: Item;
  editing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (patch: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const dragOriginRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);

  function onMouseDown(e: React.MouseEvent) {
    if (editing) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.no-drag')) return;
    e.preventDefault();
    dragOriginRef.current = { ox: item.x, oy: item.y, sx: e.clientX, sy: e.clientY };
    function onMove(ev: MouseEvent) {
      const o = dragOriginRef.current;
      if (!o) return;
      onUpdate({ x: Math.max(0, o.ox + ev.clientX - o.sx), y: Math.max(0, o.oy + ev.clientY - o.sy) });
    }
    function onUp() {
      dragOriginRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: item.x,
    top: item.y,
    width: item.w,
    height: item.h,
    transform: `rotate(${item.rotate}deg)`,
    cursor: editing ? 'text' : 'grab',
  };

  if (item.kind === 'image') {
    return (
      <div
        className="group select-none shadow-xl rounded-md overflow-hidden border theme-border-soft hover:shadow-2xl transition"
        style={baseStyle}
        onMouseDown={onMouseDown}
        onContextMenu={(e) => { e.preventDefault(); if (confirm('Supprimer cette image ?')) onRemove(); }}
      >
        <img src={item.src} alt={item.alt ?? ''} className="w-full h-full object-cover pointer-events-none" />
        <button
          onClick={onRemove}
          className="no-drag absolute top-1 right-1 bg-black/50 text-white opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-black/80"
          title="Supprimer"
        >
          <Trash2 size={11} />
        </button>
      </div>
    );
  }

  // text
  return (
    <div
      className="group select-none shadow-lg hover:shadow-2xl transition"
      style={{ ...baseStyle, background: item.color, padding: 12 }}
      onMouseDown={onMouseDown}
      onDoubleClick={() => onStartEdit()}
      onContextMenu={(e) => { e.preventDefault(); if (confirm('Supprimer ce pense-bête ?')) onRemove(); }}
    >
      {editing ? (
        <textarea
          autoFocus
          value={item.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          onBlur={onStopEdit}
          onKeyDown={(e) => { if (e.key === 'Escape') onStopEdit(); }}
          className="no-drag w-full h-full bg-transparent outline-none resize-none text-sm leading-snug"
          style={{ color: '#1f2937', fontFamily: 'inherit' }}
        />
      ) : (
        <div className="text-sm leading-snug whitespace-pre-wrap break-words" style={{ color: '#1f2937' }}>
          {item.text || <span className="opacity-50 italic">Vide — double-clic pour éditer</span>}
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="no-drag absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-500 bg-white/60 rounded p-0.5"
        title="Supprimer"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

async function readFileAsDataUrl(file: File): Promise<string> {
  // Downscale large images to keep localStorage reasonable.
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('image illisible'));
      i.src = blobUrl;
    });
    const max = 1024;
    const ratio = Math.min(1, max / img.naturalWidth);
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
