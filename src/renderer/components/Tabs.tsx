import { useState } from 'react';
import { useStore } from '../store';
import { useT } from '../i18n';
import { useLabels } from '../labels';
import { X, Plus, FileText } from 'lucide-react';

export default function Tabs() {
  const { openTabs, selectedId, selectNote, closeTab, closeOtherTabs, closeAllTabs, openModal, index } = useStore();
  const t = useT();
  const lbl = useLabels();
  const [contextFor, setContextFor] = useState<string | null>(null);

  if (openTabs.length === 0) return null;

  const tabsWithMeta = openTabs
    .map((id) => index.notes.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => !!n);

  return (
    <div data-tour="tabs" className="flex items-stretch border-b theme-border-soft theme-bg-soft px-1 overflow-x-auto select-none">
      {tabsWithMeta.map((n) => {
        const isActive = n.id === selectedId;
        return (
          <div
            key={n.id}
            onClick={() => void selectNote(n.id)}
            onContextMenu={(e) => { e.preventDefault(); setContextFor(n.id); }}
            className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer max-w-[180px] border-r theme-border-soft transition ${
              isActive ? 'theme-bg theme-text font-medium' : 'theme-muted hover:theme-text hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {isActive && <span className="absolute top-0 left-0 right-0 h-0.5 theme-accent-bg" />}
            <FileText size={11} className="shrink-0" />
            <span className="truncate flex-1">{lbl.noteTitle(n.title)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(n.id); }}
              className="opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded p-0.5"
              title={t('tabs.close')}
            >
              <X size={11} />
            </button>
            {contextFor === n.id && (
              <div
                className="absolute top-full left-0 mt-0.5 theme-popover rounded p-1 z-30 shadow-xl min-w-[140px]"
                onClick={(e) => e.stopPropagation()}
                onMouseLeave={() => setContextFor(null)}
              >
                <button onClick={() => { closeTab(n.id); setContextFor(null); }} className="w-full text-left px-2 py-1 hover:theme-hover rounded">{t('tabs.close')}</button>
                <button onClick={() => { closeOtherTabs(n.id); setContextFor(null); }} className="w-full text-left px-2 py-1 hover:theme-hover rounded">{t('tabs.closeOthers')}</button>
                <button onClick={() => { closeAllTabs(); setContextFor(null); }} className="w-full text-left px-2 py-1 hover:theme-hover rounded">{t('tabs.closeAll')}</button>
              </div>
            )}
          </div>
        );
      })}
      <button
        onClick={() => openModal('quick-switcher')}
        title={t('tabs.new')}
        className="px-2 py-1.5 text-xs theme-muted hover:theme-text"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
