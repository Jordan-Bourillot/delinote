import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { useSettings } from '../settings';
import { useT } from '../i18n';
import { useDateFmt } from '../dateFmt';
import { useLabels } from '../labels';
import { NoteContextMenu } from './NoteContextMenu';
import { DuplicateDialog } from './DuplicateDialog';
import { tagPillStyle } from '../tagColors';
import {
  Plus, Search, ArrowUpDown, ArrowDown, ArrowUp, X, Pin, Trash2,
  CheckSquare, Square, MoreHorizontal, Sparkles,
} from 'lucide-react';
import type { ColorLabel, NoteMeta } from '../types';

const COLOR_HEX: Record<ColorLabel, string> = {
  '': 'transparent',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
};

export function priorityClass(meta: { important?: boolean; urgent?: boolean }, blink = false): string {
  const parts: string[] = [];
  if (meta.important || meta.urgent) parts.push('note-priority-frame');
  if (meta.important && meta.urgent) parts.push('note-priority-both');
  else if (meta.important) parts.push('note-priority-important');
  else if (meta.urgent) parts.push('note-priority-urgent');
  if (meta.urgent && blink) parts.push('note-priority-blink');
  return parts.join(' ');
}

export default function NoteList() {
  const {
    index, view, selectedId, selectNote, newNote, searchQuery, setSearch, searchResults,
    selectedIds, toggleSelectMulti, clearSelection, selectAllVisible, moveNotes, trash, restore,
    deleteForever, togglePin, openModal, emptyTrash,
  } = useStore();
  const settings = useSettings((s) => s.settings);
  const { set } = useSettings();
  const t = useT();
  const [contextMenu, setContextMenu] = useState<{ note: NoteMeta; x: number; y: number } | null>(null);
  const [duplicateFor, setDuplicateFor] = useState<NoteMeta | null>(null);
  const df = useDateFmt();
  const lbl = useLabels();
  const [showSort, setShowSort] = useState(false);
  const visibleIdsRef = useRef<string[]>([]);

  // Ctrl+A → select all visible notes (when focus is not in an input)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'a') return;
      const target = e.target as HTMLElement | null;
      const inEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (inEditable) return;
      if (visibleIdsRef.current.length === 0) return;
      e.preventDefault();
      selectAllVisible(visibleIdsRef.current);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectAllVisible]);

  const title = useMemo(() => {
    switch (view.kind) {
      case 'all': return t('sidebar.allNotes');
      case 'pinned': return t('sidebar.pinned');
      case 'recent': return t('sidebar.recent');
      case 'notebook': {
        const nb = index.notebooks.find((n) => n.id === view.id);
        return nb ? lbl.notebookName(nb.name) : t('list.notebook');
      }
      case 'tag': return `#${view.tag}`;
      case 'color': return `${view.color || ''}`;
      case 'trash': return t('sidebar.trash');
      case 'search': return `${t('list.searchLabel')} ${view.query}`;
    }
  }, [view, index.notebooks, t]);

  const [showArchived, setShowArchived] = useState(false);
  const notes: NoteMeta[] = useMemo(() => {
    if (view.kind === 'search' && searchResults) return searchResults;
    let list = index.notes.slice();
    switch (view.kind) {
      case 'all': list = list.filter((n) => !n.trashed); break;
      case 'pinned': list = list.filter((n) => !n.trashed && n.pinned); break;
      case 'notebook': list = list.filter((n) => !n.trashed && n.notebookId === view.id); break;
      case 'tag': list = list.filter((n) => !n.trashed && n.tags.includes(view.tag)); break;
      case 'color': list = list.filter((n) => !n.trashed && n.color === view.color); break;
      case 'trash': list = list.filter((n) => n.trashed); break;
    }
    // Auto-archive: hide notes untouched for N days from default views.
    // Pinned/important/urgent notes are immune. Doesn't apply in trash or
    // search views, and the user can flip it off via the chip below.
    if (settings.labAutoArchive && !showArchived && view.kind !== 'trash' && view.kind !== 'search') {
      const cutoff = Date.now() - settings.labAutoArchiveDays * 24 * 60 * 60 * 1000;
      list = list.filter((n) => n.pinned || n.important || n.urgent || n.updatedAt >= cutoff);
    }
    list.sort((a, b) => {
      if (settings.pinnedAtTop && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      let cmp = 0;
      switch (settings.notesSortBy) {
        case 'updated': cmp = a.updatedAt - b.updatedAt; break;
        case 'created': cmp = a.createdAt - b.createdAt; break;
        case 'title': cmp = a.title.localeCompare(b.title); break;
      }
      return settings.notesSortOrder === 'desc' ? -cmp : cmp;
    });
    visibleIdsRef.current = list.map((n) => n.id);
    return list;
  }, [view, index.notes, searchResults, settings.pinnedAtTop, settings.notesSortBy, settings.notesSortOrder, settings.labAutoArchive, settings.labAutoArchiveDays, showArchived]);

  const archivedCount = useMemo(() => {
    if (!settings.labAutoArchive || showArchived || view.kind === 'trash' || view.kind === 'search') return 0;
    const cutoff = Date.now() - settings.labAutoArchiveDays * 24 * 60 * 60 * 1000;
    return index.notes.filter((n) =>
      !n.trashed && !n.pinned && !n.important && !n.urgent && n.updatedAt < cutoff,
    ).length;
  }, [index.notes, settings.labAutoArchive, settings.labAutoArchiveDays, showArchived, view.kind]);

  const allowCreate = view.kind === 'notebook' || view.kind === 'all' || view.kind === 'tag' || view.kind === 'color';
  const isCompact = settings.listDensity === 'compact';
  const selectedCount = selectedIds.size;

  return (
    <div data-tour="notelist" className="w-80 shrink-0 border-r theme-border-soft theme-list flex flex-col h-full">
      <div className="p-2.5 border-b theme-border-soft space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold theme-text truncate flex-1 text-sm">{title}</h2>
          <button
            onClick={() => setShowSort(!showSort)}
            title="Sort"
            className="theme-muted hover:theme-text p-1 rounded relative"
          >
            <ArrowUpDown size={13} />
          </button>
          {settings.enableTemplates && allowCreate && (
            <button
              onClick={() => openModal('templates')}
              title={t('list.fromTemplate')}
              className="theme-muted hover:theme-text p-1 rounded"
            >
              <Sparkles size={13} />
            </button>
          )}
          {allowCreate && (
            <button
              onClick={() => void newNote()}
              className="text-white theme-accent-bg rounded p-1.5 hover:opacity-90 transition shadow-sm"
              title={t('list.newNoteShort')}
            >
              <Plus size={14} />
            </button>
          )}
        </div>
        {showSort && (
          <div className="theme-popover rounded p-2 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="theme-muted">Sort by</span>
              <select value={settings.notesSortBy} onChange={(e) => set('notesSortBy', e.target.value as any)} className="theme-input rounded px-1.5 py-0.5">
                <option value="updated">Updated</option>
                <option value="created">Created</option>
                <option value="title">Title</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="theme-muted">Order</span>
              <button
                onClick={() => set('notesSortOrder', settings.notesSortOrder === 'desc' ? 'asc' : 'desc')}
                className="theme-text theme-input rounded px-2 py-0.5 flex items-center gap-1"
              >
                {settings.notesSortOrder === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                {settings.notesSortOrder === 'desc' ? 'Desc' : 'Asc'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="theme-muted">Density</span>
              <button
                onClick={() => set('listDensity', settings.listDensity === 'comfortable' ? 'compact' : 'comfortable')}
                className="theme-text theme-input rounded px-2 py-0.5"
              >
                {settings.listDensity === 'comfortable' ? 'Comfortable' : 'Compact'}
              </button>
            </div>
          </div>
        )}
        {settings.enableSearch && (
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 theme-muted" />
            <input
              value={searchQuery}
              onChange={(e) => void setSearch(e.target.value)}
              placeholder={t('sidebar.search')}
              className="w-full theme-input text-xs rounded pl-7 pr-7 py-1.5 outline-none placeholder:theme-muted"
            />
            {searchQuery && (
              <button onClick={() => void setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 theme-muted hover:theme-text">
                <X size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {selectedCount > 0 && (
        <BulkBar
          count={selectedCount}
          onClear={clearSelection}
          notebooks={index.notebooks}
          onMove={async (nbId) => { await moveNotes(Array.from(selectedIds), nbId); clearSelection(); }}
          onTrash={async () => { for (const id of selectedIds) await trash(id); clearSelection(); }}
          onPin={async () => { for (const id of selectedIds) await togglePin(id); clearSelection(); }}
        />
      )}

      {view.kind === 'trash' && notes.length > 0 && (
        <div className="px-3 py-2 border-b theme-border-soft">
          <button
            onClick={() => { if (confirm(t('list.confirmEmptyTrash'))) void emptyTrash(); }}
            className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1.5"
          >
            <Trash2 size={11} /> {t('list.emptyTrashBtn', { n: notes.length })}
          </button>
        </div>
      )}

      {archivedCount > 0 && (
        <div className="px-3 py-2 border-b theme-border-soft">
          <button
            onClick={() => setShowArchived(true)}
            className="text-xs theme-muted hover:theme-text inline-flex items-center gap-1.5"
            title={`${archivedCount} note${archivedCount > 1 ? 's' : ''} non modifiée${archivedCount > 1 ? 's' : ''} depuis ${settings.labAutoArchiveDays} jours`}
          >
            📦 {archivedCount} note{archivedCount > 1 ? 's' : ''} archivée{archivedCount > 1 ? 's' : ''} — afficher
          </button>
        </div>
      )}
      {showArchived && settings.labAutoArchive && view.kind !== 'trash' && view.kind !== 'search' && (
        <div className="px-3 py-2 border-b theme-border-soft">
          <button
            onClick={() => setShowArchived(false)}
            className="text-xs theme-accent hover:opacity-80 inline-flex items-center gap-1.5"
          >
            ✓ Archives affichées — masquer à nouveau
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="p-8 text-center text-sm theme-muted">
            {view.kind === 'trash' ? t('list.emptyTrash') : t('list.empty')}
          </div>
        ) : (
          notes.map((n) => {
            const checked = selectedIds.has(n.id);
            return (
              <div
                key={n.id}
                data-note-row={n.id}
                draggable
                onDragStart={(e) => {
                  const ids = checked ? Array.from(selectedIds) : [n.id];
                  e.dataTransfer.setData('text/note-ids', JSON.stringify(ids));
                }}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) toggleSelectMulti(n.id);
                  else void selectNote(n.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ note: n, x: e.clientX, y: e.clientY });
                }}
                className={`note-row group relative w-full text-left ${isCompact ? 'px-3 py-1.5' : 'px-3 py-3'} border-b theme-border-soft cursor-pointer ${
                  selectedId === n.id ? 'theme-list-active' : 'hover:theme-hover'
                } ${checked ? 'note-row-selected' : ''} ${n.pinned ? 'pinned-glow' : ''} ${priorityClass(n, settings.urgentBlink)}`}
              >
                {settings.enableColorLabels && settings.showColorLabels && n.color && (
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: COLOR_HEX[n.color] }} />
                )}
                <div className="flex items-start gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelectMulti(n.id); }}
                    className="opacity-0 group-hover:opacity-100 mt-0.5 theme-muted hover:theme-text"
                  >
                    {checked ? <CheckSquare size={12} /> : <Square size={12} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {settings.enablePinning && n.pinned && <Pin size={10} className="theme-accent shrink-0" />}
                      <div className="font-medium theme-text truncate text-sm flex-1">{lbl.noteTitle(n.title)}</div>
                    </div>
                    {settings.showExcerpts && !isCompact && (
                      <div className="text-xs theme-muted line-clamp-2 mt-1">{n.excerpt || t('list.noContent')}</div>
                    )}
                    {(settings.showDates || settings.showTagPills) && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {settings.showDates && (
                          <span className="text-[10px] theme-muted">
                            {isCompact ? df.short(n.updatedAt) : df.shortTime(n.updatedAt)}
                          </span>
                        )}
                        {settings.enableTags && settings.showTagPills && n.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={tagPillStyle(t)}>#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {contextMenu && (
        <NoteContextMenu
          note={contextMenu.note}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDuplicateAsk={(n) => { setContextMenu(null); setDuplicateFor(n); }}
        />
      )}
      {duplicateFor && (
        <DuplicateDialog note={duplicateFor} onClose={() => setDuplicateFor(null)} />
      )}
    </div>
  );
}

function BulkBar({ count, onClear, notebooks, onMove, onTrash, onPin }: {
  count: number;
  onClear: () => void;
  notebooks: { id: string; name: string }[];
  onMove: (id: string) => void;
  onTrash: () => void;
  onPin: () => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  return (
    <div
      className="px-3 py-2.5 border-b theme-border text-xs flex items-center flex-wrap gap-x-2 gap-y-1.5 sticky top-0 z-20 shadow-md"
      style={{ background: 'var(--accent)', color: '#fff' }}
    >
      <span className="font-bold flex items-center gap-1.5 mr-auto min-w-0">
        <span className="bg-white/20 backdrop-blur rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-extrabold shrink-0">{count}</span>
        <span className="truncate">{count > 1 ? 'notes sélectionnées' : 'note sélectionnée'}</span>
      </span>
      <button onClick={onPin} className="shrink-0 text-white px-2 py-1 rounded hover:bg-white/20 transition font-medium">📌 Épingler</button>
      <div className="relative shrink-0">
        <button onClick={() => setMoveOpen(!moveOpen)} className="text-white px-2 py-1 rounded hover:bg-white/20 transition font-medium">📁 Déplacer</button>
        {moveOpen && (
          <div className="absolute right-0 top-full mt-1 theme-popover rounded p-1 z-30 min-w-[160px] max-h-60 overflow-y-auto">
            {notebooks.map((nb) => (
              <button key={nb.id} onClick={() => { onMove(nb.id); setMoveOpen(false); }} className="w-full text-left px-2 py-1 text-xs hover:theme-hover rounded theme-text">{nb.name === 'Inbox' ? 'Notes rapides' : nb.name}</button>
            ))}
          </div>
        )}
      </div>
      <button onClick={onTrash} className="shrink-0 text-white bg-red-600/30 hover:bg-red-600/60 px-2 py-1 rounded font-medium transition">🗑 Corbeille</button>
      <button onClick={onClear} className="shrink-0 text-white hover:bg-white/20 p-1 rounded" title="Désélectionner (Échap)"><X size={14} /></button>
    </div>
  );
}
