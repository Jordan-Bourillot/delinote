import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { useStore } from '../store';
import { useSettings, FEATURE_CATEGORIES } from '../settings';
import { useT } from '../i18n';
import type { StringKey } from '../i18n';
import { useLabels } from '../labels';
import {
  Search, FileText, Notebook as NotebookIcon, Tag, Settings as SettingsIcon,
  Plus, Trash2, BookOpen, Pin, Sparkles, Keyboard, Download, Upload, FileDown, History,
} from 'lucide-react';

type Item = {
  id: string;
  kind: 'note' | 'notebook' | 'tag' | 'action';
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
};

export default function QuickSwitcher() {
  const closeModal = useStore((s) => s.closeModal);
  const { index, selectNote, setView, newNote, openModal, emptyTrash } = useStore();
  const settings = useSettings((s) => s.settings);
  const t = useT();
  const lbl = useLabels();
  const [q, setQ] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    // Notes
    for (const n of index.notes) {
      if (n.trashed) continue;
      out.push({
        id: `note:${n.id}`,
        kind: 'note',
        label: lbl.noteTitle(n.title),
        hint: n.excerpt,
        icon: n.pinned ? <Pin size={14} /> : <FileText size={14} />,
        run: () => { void selectNote(n.id); closeModal(); },
      });
    }
    // Notebooks
    for (const nb of index.notebooks) {
      out.push({
        id: `nb:${nb.id}`,
        kind: 'notebook',
        label: lbl.notebookName(nb.name),
        hint: t('qs.notebook'),
        icon: <NotebookIcon size={14} />,
        run: () => { setView({ kind: 'notebook', id: nb.id }); closeModal(); },
      });
    }
    // Tags
    const tagSet = new Set<string>();
    for (const n of index.notes) if (!n.trashed) for (const tg of n.tags) tagSet.add(tg);
    for (const tg of tagSet) {
      out.push({
        id: `tag:${tg}`,
        kind: 'tag',
        label: `#${tg}`,
        hint: t('qs.tag'),
        icon: <Tag size={14} />,
        run: () => { setView({ kind: 'tag', tag: tg }); closeModal(); },
      });
    }
    // Actions
    const actions: Item[] = [
      { id: 'a:new-note', kind: 'action', label: t('qs.newNote'), hint: 'Ctrl+N', icon: <Plus size={14} />, run: () => { void newNote(); closeModal(); } },
      { id: 'a:settings', kind: 'action', label: t('qs.openSettings'), hint: 'Ctrl+,', icon: <SettingsIcon size={14} />, run: () => { openModal('settings'); } },
      { id: 'a:templates', kind: 'action', label: t('qs.fromTemplate'), icon: <Sparkles size={14} />, run: () => { openModal('templates'); } },
      { id: 'a:shortcuts', kind: 'action', label: t('qs.shortcuts'), hint: '?', icon: <Keyboard size={14} />, run: () => { openModal('shortcuts'); } },
      { id: 'a:trash', kind: 'action', label: t('qs.openTrash'), icon: <Trash2 size={14} />, run: () => { setView({ kind: 'trash' }); closeModal(); } },
      { id: 'a:empty-trash', kind: 'action', label: t('qs.emptyTrash'), icon: <Trash2 size={14} />, run: () => { if (confirm(t('qs.confirmEmpty'))) void emptyTrash(); closeModal(); } },
      { id: 'a:export', kind: 'action', label: t('qs.exportAll'), icon: <Download size={14} />, run: async () => { await window.nv.exportAll(); closeModal(); } },
      { id: 'a:import', kind: 'action', label: t('qs.importBundle'), icon: <Upload size={14} />, run: async () => { if (confirm(t('qs.confirmImport'))) { const r = await window.nv.importAll(); if (r.ok) { useStore.getState().toast('success', t('toast.importedN', { n: r.imported })); await useStore.getState().refresh(); } } closeModal(); } },
      { id: 'a:backup', kind: 'action', label: t('qs.backupTo'), icon: <FileDown size={14} />, run: async () => { await window.nv.backupNow(); closeModal(); } },
      { id: 'a:read', kind: 'action', label: t('qs.toggleRead'), icon: <BookOpen size={14} />, run: () => { closeModal(); } },
    ];
    // Quick toggles for every feature
    for (const cat of FEATURE_CATEGORIES) {
      for (const tg of cat.toggles) {
        const enabled = settings[tg.key];
        const label = t(tg.labelKey as StringKey);
        actions.push({
          id: `t:${tg.key}`,
          kind: 'action',
          label: t(enabled ? 'qs.disable' : 'qs.enable', { label }),
          hint: t(cat.labelKey as StringKey),
          icon: <SettingsIcon size={14} />,
          run: () => {
            useSettings.getState().toggle(tg.key);
            useStore.getState().toast('success', t(enabled ? 'toast.featOff' : 'toast.featOn', { label }));
            closeModal();
          },
        });
      }
    }
    return out.concat(actions);
  }, [index, settings, t]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items.slice(0, 50);
    const fuse = new Fuse(items, { keys: ['label', 'hint'], threshold: 0.4, ignoreLocation: true });
    return fuse.search(q).slice(0, 50).map((r) => r.item);
  }, [q, items]);

  useEffect(() => { setActiveIdx(0); }, [q]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div
        className="theme-card rounded-xl shadow-2xl border theme-border w-full max-w-xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b theme-border-soft">
          <Search size={16} className="theme-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('qs.placeholder')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); filtered[activeIdx]?.run(); }
              else if (e.key === 'Escape') closeModal();
            }}
            className="flex-1 bg-transparent outline-none theme-text text-sm placeholder:theme-muted"
          />
          <kbd className="theme-kbd text-[10px]">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-96 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm theme-muted text-center">{t('qs.empty')}</div>
          ) : (
            filtered.map((it, idx) => (
              <button
                key={it.id}
                data-idx={idx}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => it.run()}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left ${
                  idx === activeIdx ? 'theme-accent-bg theme-text' : 'theme-text hover:theme-hover'
                }`}
              >
                <span className="theme-muted">{it.icon}</span>
                <span className="flex-1 truncate">{it.label}</span>
                {it.hint && <span className="text-[10px] theme-muted ml-2 truncate max-w-[140px]">{it.hint}</span>}
              </button>
            ))
          )}
        </div>
        <div className="px-3 py-2 border-t theme-border-soft text-[10px] theme-muted flex gap-3">
          <span><kbd className="theme-kbd">↑↓</kbd> {t('qs.navigate')}</span>
          <span><kbd className="theme-kbd">↵</kbd> {t('qs.select')}</span>
          <span><kbd className="theme-kbd">Esc</kbd> {t('qs.close')}</span>
        </div>
      </div>
    </div>
  );
}
