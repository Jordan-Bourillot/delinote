import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { useSettings } from '../settings';
import { useT } from '../i18n';
import { useLabels } from '../labels';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationCenter';
import { TriskellMark, openTriskellSite, TRISKELL_URL } from './TriskellMark';
import { useTagRegistry } from '../tagRegistry';
import SidebarUpsell from './SidebarUpsell';
import { BetaBadge } from './BetaExpired';
import { checkBetaStatus } from '../betaGuard';
import {
  Notebook as NotebookIcon, Tag as TagIcon, Trash2, Plus, Inbox, Pencil, X,
  Settings as SettingsIcon, Search, Sparkles, ChevronDown, ChevronRight,
  Clock, Pin, Layers, Sun, Moon, Pill, Calendar as CalendarIcon, CheckSquare, Paperclip, Bell,
  Users, HelpCircle, CalendarDays, Zap, BatteryCharging, Layout,
} from 'lucide-react';
import type { ColorLabel, Notebook, Stack } from '../types';

const COLORS: { id: ColorLabel; hex: string; labelEn: string; labelFr: string }[] = [
  { id: 'red', hex: '#ef4444', labelEn: 'Red', labelFr: 'Rouge' },
  { id: 'orange', hex: '#f97316', labelEn: 'Orange', labelFr: 'Orange' },
  { id: 'yellow', hex: '#eab308', labelEn: 'Yellow', labelFr: 'Jaune' },
  { id: 'green', hex: '#22c55e', labelEn: 'Green', labelFr: 'Vert' },
  { id: 'blue', hex: '#3b82f6', labelEn: 'Blue', labelFr: 'Bleu' },
  { id: 'purple', hex: '#a855f7', labelEn: 'Purple', labelFr: 'Violet' },
  { id: 'pink', hex: '#ec4899', labelEn: 'Pink', labelFr: 'Rose' },
];

export default function Sidebar() {
  const {
    index, view, setView, newNotebook, renameNotebook, deleteNotebook,
    newStack, renameStack, deleteStack, setNotebookStack,
    collapsedStacks, toggleStackCollapsed,
    openModal, moveNotes, selectNote, openDailyNote,
  } = useStore();
  const settings = useSettings((s) => s.settings);
  const { set } = useSettings();
  const t = useT();
  const lbl = useLabels();
  const [creatingNb, setCreatingNb] = useState<string | null>(null);
  const [draftNb, setDraftNb] = useState('');
  const [creatingStack, setCreatingStack] = useState(false);
  const [draftStack, setDraftStack] = useState('');
  const [editingNbId, setEditingNbId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingStackId, setEditingStackId] = useState<string | null>(null);
  const [editStackValue, setEditStackValue] = useState('');
  const [dropTargetNb, setDropTargetNb] = useState<string | null>(null);

  const knownTags = useTagRegistry((s) => s.knownTags);
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of index.notes) {
      if (n.trashed) continue;
      for (const tg of n.tags) counts.set(tg, (counts.get(tg) ?? 0) + 1);
    }
    // Include remembered tags that no longer have any note: they stay visible
    // (count = 0) until the user explicitly deletes them via the context menu.
    for (const tg of knownTags) if (!counts.has(tg)) counts.set(tg, 0);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [index.notes, knownTags]);

  const [tagMenu, setTagMenu] = useState<{ tag: string; x: number; y: number } | null>(null);

  const counts = useMemo(() => {
    const byNb = new Map<string, number>();
    let trash = 0, pinned = 0, all = 0;
    for (const n of index.notes) {
      if (n.trashed) trash++;
      else { all++; if (n.pinned) pinned++; byNb.set(n.notebookId, (byNb.get(n.notebookId) ?? 0) + 1); }
    }
    return { byNb, trash, pinned, all };
  }, [index.notes]);

  const recents = useMemo(
    () => index.notes.filter((n) => !n.trashed).slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, settings.recentCount),
    [index.notes, settings.recentCount],
  );

  const usedColors = useMemo(() => {
    const set = new Set<ColorLabel>();
    for (const n of index.notes) if (!n.trashed && n.color) set.add(n.color);
    return Array.from(set);
  }, [index.notes]);

  const stacked = settings.showStacks ? index.stacks : [];

  function isActive(check: boolean) {
    return check ? 'bg-black/10 dark:bg-white/10 theme-text' : 'hover:bg-black/5 dark:hover:bg-white/5 theme-muted hover:theme-text';
  }

  function handleNbDrop(nbId: string, e: React.DragEvent) {
    e.preventDefault();
    setDropTargetNb(null);
    const data = e.dataTransfer.getData('text/note-ids');
    if (!data) return;
    const ids = JSON.parse(data) as string[];
    if (ids.length) void moveNotes(ids, nbId);
  }

  // Dark/light toggle: switches between dark and the user's last "light" choice (light/sepia/caribbean)
  const isDarkActive = settings.theme === 'dark';
  function toggleDarkLight() {
    if (isDarkActive) {
      // go back to last non-dark choice or default caribbean
      const last = settings.lastDarkLightChoice === 'light' ? 'light' : 'caribbean';
      set('theme', last as any);
    } else {
      set('lastDarkLightChoice', 'light');
      set('theme', 'dark');
    }
  }

  return (
    <aside data-tour="sidebar" className="w-60 shrink-0 border-r theme-border-soft theme-sidebar flex flex-col h-full select-none">
      <div className="px-3 py-3 flex items-center gap-2 border-b theme-border-soft relative">
        {/* Subtle caribbean gradient sliver under the brand */}
        <span
          aria-hidden
          className="absolute left-0 right-0 bottom-0 h-px"
          style={{
            background: 'linear-gradient(90deg, rgba(13,148,136,0) 0%, rgba(13,148,136,0.55) 22%, rgba(243,114,35,0.55) 50%, rgba(251,113,133,0.55) 78%, rgba(251,191,36,0) 100%)',
          }}
        />
        <Logo size={32} />
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold theme-text text-sm tracking-tight truncate">DéliNote</h1>
          <p className="text-[10px] theme-muted">{t('app.tagline')}</p>
        </div>
        <NotificationBell />
        <button
          onClick={toggleDarkLight}
          className="theme-muted hover:theme-text p-1 rounded"
          title={isDarkActive ? t('sidebar.lightMode') : t('sidebar.darkMode')}
        >
          {isDarkActive ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button
          onClick={() => openModal('settings')}
          className="theme-muted hover:theme-text p-1 rounded"
          title={`${t('sidebar.settings')} (Ctrl+,)`}
        >
          <SettingsIcon size={14} />
        </button>
      </div>

      <div className="px-2 py-2 border-b theme-border-soft space-y-1">
        <button
          onClick={() => openModal('quick-switcher')}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs theme-muted hover:theme-hover hover:theme-text"
        >
          <Search size={13} />
          <span className="flex-1 text-left">{t('sidebar.search')}</span>
          <kbd className="theme-kbd text-[9px]">Ctrl+K</kbd>
        </button>
        <button
          onClick={() => openModal('templates')}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs theme-muted hover:theme-hover hover:theme-text"
        >
          <Sparkles size={13} />
          <span className="flex-1 text-left">{t('sidebar.fromTemplate')}</span>
        </button>
        <button
          onClick={() => void openDailyNote()}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs theme-muted hover:theme-hover hover:theme-text"
          title={`${t('sidebar.dailyNote')} (Ctrl+Shift+T)`}
        >
          <CalendarDays size={13} />
          <span className="flex-1 text-left">{t('sidebar.dailyNote')}</span>
          <kbd className="theme-kbd text-[9px]">Ctrl+⇧T</kbd>
        </button>
        {settings.labFlux && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('delinote:open-flux'))}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs theme-muted hover:theme-hover hover:theme-text"
            title="Mode Flux : 25 minutes d'écriture continue"
          >
            <Zap size={13} />
            <span className="flex-1 text-left">Mode Flux</span>
            <span className="text-[9px] theme-accent-bg-soft theme-accent px-1 rounded">25 min</span>
          </button>
        )}
        {settings.labEnergyCalendar && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('delinote:open-energy'))}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs theme-muted hover:theme-hover hover:theme-text"
            title="Anti-calendrier énergie"
          >
            <BatteryCharging size={13} />
            <span className="flex-1 text-left">Énergie</span>
          </button>
        )}
        {settings.labMoodboard && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('delinote:open-moodboard'))}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs theme-muted hover:theme-hover hover:theme-text"
            title="Mood-board libre"
          >
            <Layout size={13} />
            <span className="flex-1 text-left">Mood-board</span>
          </button>
        )}
        {settings.labQrShare && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('delinote:open-qrshare'))}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs theme-muted hover:theme-hover hover:theme-text"
            title="Partager une note via QR"
          >
            <span className="text-[13px]">📱</span>
            <span className="flex-1 text-left">Partage QR</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {settings.showAllNotes && (
          <NavItem icon={<Inbox size={14} />} label={t('sidebar.allNotes')} count={counts.all} active={view.kind === 'all'} onClick={() => setView({ kind: 'all' })} />
        )}
        {settings.enablePinning && counts.pinned > 0 && (
          <NavItem icon={<Pin size={14} />} label={t('sidebar.pinned')} count={counts.pinned} active={view.kind === 'pinned'} onClick={() => setView({ kind: 'pinned' })} />
        )}

        {settings.showRecentSection && recents.length > 0 && (
          <>
            <Section label={t('sidebar.recent')} />
            {recents.map((n) => (
              <NavItem
                key={n.id}
                icon={<Clock size={14} />}
                label={lbl.noteTitle(n.title)}
                onClick={() => void selectNote(n.id)}
                small
              />
            ))}
          </>
        )}

        <Section
          label={t('sidebar.notebooks')}
          actions={
            <div className="flex gap-0.5">
              {settings.enableNotebookStacks && settings.showStacks && (
                <button onClick={() => setCreatingStack(true)} title={t('sidebar.newStack')} className="theme-muted hover:theme-text">
                  <Layers size={12} />
                </button>
              )}
              <button onClick={() => setCreatingNb('root')} title={t('sidebar.newNotebook')} className="theme-muted hover:theme-text">
                <Plus size={13} />
              </button>
            </div>
          }
        />

        {creatingStack && (
          <NameInput placeholder={t('sidebar.stackName')} onCancel={() => { setCreatingStack(false); setDraftStack(''); }} value={draftStack} onChange={setDraftStack} onSubmit={async (name) => { await newStack(name); setCreatingStack(false); setDraftStack(''); }} />
        )}
        {creatingNb === 'root' && (
          <NameInput placeholder={t('sidebar.notebookName')} value={draftNb} onChange={setDraftNb} onCancel={() => { setCreatingNb(null); setDraftNb(''); }} onSubmit={async (name) => { await newNotebook(name, null); setCreatingNb(null); setDraftNb(''); }} />
        )}

        {(settings.showStacks ? index.notebooks.filter((nb) => !nb.stackId) : index.notebooks).map((nb) => (
          <NotebookRow
            key={nb.id} nb={nb} displayName={lbl.notebookName(nb.name)} count={counts.byNb.get(nb.id) ?? 0}
            active={view.kind === 'notebook' && view.id === nb.id}
            editing={editingNbId === nb.id} editValue={editValue}
            onClick={() => setView({ kind: 'notebook', id: nb.id })}
            onStartRename={() => { setEditingNbId(nb.id); setEditValue(nb.name); }}
            onSubmitRename={async () => { if (editValue.trim()) await renameNotebook(nb.id, editValue.trim()); setEditingNbId(null); }}
            onChangeRename={setEditValue}
            onDelete={() => { if (confirm(t('sidebar.confirmDeleteNotebook', { name: nb.name }))) void deleteNotebook(nb.id); }}
            canDelete={index.notebooks.length > 1}
            isDropTarget={dropTargetNb === nb.id}
            onDragOver={(e) => { e.preventDefault(); setDropTargetNb(nb.id); }}
            onDragLeave={() => setDropTargetNb(null)}
            onDrop={(e) => handleNbDrop(nb.id, e)}
            stacks={stacked}
            onSetStack={(sid) => void setNotebookStack(nb.id, sid)}
            t={t}
          />
        ))}

        {stacked.map((s) => (
          <StackBlock
            key={s.id} stack={s} collapsed={collapsedStacks.has(s.id)} onToggle={() => toggleStackCollapsed(s.id)}
            editing={editingStackId === s.id} editValue={editStackValue}
            onStartRename={() => { setEditingStackId(s.id); setEditStackValue(s.name); }}
            onChangeRename={setEditStackValue}
            onSubmitRename={async () => { if (editStackValue.trim()) await renameStack(s.id, editStackValue.trim()); setEditingStackId(null); }}
            onDelete={() => { if (confirm(t('sidebar.confirmDeleteStack', { name: s.name }))) void deleteStack(s.id); }}
            onAddNotebook={() => setCreatingNb(s.id)}
          >
            {creatingNb === s.id && (
              <NameInput placeholder={t('sidebar.notebookName')} value={draftNb} onChange={setDraftNb} onCancel={() => { setCreatingNb(null); setDraftNb(''); }} onSubmit={async (name) => { await newNotebook(name, s.id); setCreatingNb(null); setDraftNb(''); }} indent />
            )}
            {index.notebooks.filter((nb) => nb.stackId === s.id).map((nb) => (
              <NotebookRow
                key={nb.id} nb={nb} displayName={lbl.notebookName(nb.name)} indent count={counts.byNb.get(nb.id) ?? 0}
                active={view.kind === 'notebook' && view.id === nb.id}
                editing={editingNbId === nb.id} editValue={editValue}
                onClick={() => setView({ kind: 'notebook', id: nb.id })}
                onStartRename={() => { setEditingNbId(nb.id); setEditValue(nb.name); }}
                onSubmitRename={async () => { if (editValue.trim()) await renameNotebook(nb.id, editValue.trim()); setEditingNbId(null); }}
                onChangeRename={setEditValue}
                onDelete={() => { if (confirm(t('sidebar.confirmDeleteNotebook', { name: nb.name }))) void deleteNotebook(nb.id); }}
                canDelete={index.notebooks.length > 1}
                isDropTarget={dropTargetNb === nb.id}
                onDragOver={(e) => { e.preventDefault(); setDropTargetNb(nb.id); }}
                onDragLeave={() => setDropTargetNb(null)}
                onDrop={(e) => handleNbDrop(nb.id, e)}
                stacks={stacked}
                onSetStack={(sid) => void setNotebookStack(nb.id, sid)}
                t={t}
              />
            ))}
          </StackBlock>
        ))}

        {settings.enableColorLabels && settings.showColorLabels && usedColors.length > 0 && (
          <>
            <Section label={t('sidebar.colors')} />
            {usedColors.map((c) => {
              const meta = COLORS.find((x) => x.id === c)!;
              return (
                <NavItem
                  key={c}
                  icon={<span className="block w-3 h-3 rounded-full" style={{ background: meta.hex }} />}
                  label={settings.language === 'fr' ? meta.labelFr : meta.labelEn}
                  active={view.kind === 'color' && view.color === c}
                  onClick={() => setView({ kind: 'color', color: c })}
                />
              );
            })}
          </>
        )}

        {settings.enableTags && settings.showTagsSection && tags.length > 0 && (
          <>
            <Section label={t('sidebar.tags')} />
            {tags.map(([tg, count]) => (
              <div
                key={tg}
                onContextMenu={(e) => { e.preventDefault(); setTagMenu({ tag: tg, x: e.clientX, y: e.clientY }); }}
              >
                <NavItem
                  icon={<TagIcon size={14} />}
                  label={tg}
                  count={count}
                  active={view.kind === 'tag' && view.tag === tg}
                  onClick={() => setView({ kind: 'tag', tag: tg })}
                />
              </div>
            ))}
          </>
        )}

        {/* Productivity modules — each one is opt-in via Settings / profile */}
        {(settings.enableCalendarModule || settings.enableTasksModule || settings.enableFilesModule || settings.enableContactsModule) && (
          <Section label="" />
        )}
        {settings.enableCalendarModule && (
          <NavItem
            icon={<CalendarIcon size={14} />}
            label={t('cal.sidebar')}
            active={view.kind === 'calendar'}
            onClick={() => setView({ kind: 'calendar' })}
          />
        )}
        {settings.enableTasksModule && (
          <NavItem
            icon={<CheckSquare size={14} />}
            label={t('tasks.sidebar')}
            active={view.kind === 'tasks'}
            onClick={() => setView({ kind: 'tasks' })}
          />
        )}
        {settings.enableFilesModule && (
          <NavItem
            icon={<Paperclip size={14} />}
            label={t('files.sidebar')}
            active={view.kind === 'files'}
            onClick={() => setView({ kind: 'files' })}
          />
        )}
        {settings.enableContactsModule && (
          <NavItem
            icon={<Users size={14} />}
            label={t('contacts.sidebar')}
            active={view.kind === 'contacts'}
            onClick={() => setView({ kind: 'contacts' })}
          />
        )}

        {settings.showTrashSection && (
          <>
            <NavItem icon={<Trash2 size={14} />} label={t('sidebar.trash')} count={counts.trash} active={view.kind === 'trash'} onClick={() => setView({ kind: 'trash' })} />
          </>
        )}

        {settings.enableHelpModule && (
          <NavItem
            icon={<HelpCircle size={14} />}
            label={t('help.sidebar')}
            active={view.kind === 'help'}
            onClick={() => setView({ kind: 'help' })}
          />
        )}

        {/* Module Santé — isolé en bas car distinct des outils de productivité ci-dessus */}
        {settings.enableMedicationsModule && (
          <>
            <Section label={t('med.sectionLabel')} />
            <MedsSidebarEntry active={view.kind === 'meds'} onClick={() => setView({ kind: 'meds' })} label={t('med.sidebar')} />
          </>
        )}
      </div>

      {/* Bandeau upsell — visible uniquement en profil Découverte, masquable */}
      <SidebarUpsell />

      <div className="border-t theme-border-soft px-3 py-2 text-[10px] theme-muted">
        <div className="flex items-center justify-between">
          <span>{t('sidebar.notesCount', { n: counts.all, b: index.notebooks.length })}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono opacity-70" title={`DéliNote v${__APP_VERSION__}`}>v{__APP_VERSION__}</span>
            <button onClick={() => openModal('shortcuts')} className="hover:theme-text" title={t('sidebar.shortcuts')}>?</button>
          </div>
        </div>
        <button
          onClick={openTriskellSite}
          title={`${t('studio.byLine')} — ${TRISKELL_URL}`}
          aria-label={`${t('studio.byLine')} — ouvrir triskell-studio.fr dans le navigateur`}
          className="mt-1.5 w-full flex items-center justify-center gap-1 opacity-50 hover:opacity-100 hover:theme-text transition cursor-pointer"
        >
          <TriskellMark size={24} />
          <span className="text-[11px] tracking-wide">{t('studio.tag')}</span>
        </button>
        <BetaBadge status={checkBetaStatus()} />
      </div>

      {tagMenu && (
        <TagRenameMenu
          tag={tagMenu.tag}
          x={tagMenu.x}
          y={tagMenu.y}
          onClose={() => setTagMenu(null)}
          onRenamed={() => useStore.getState().refresh()}
        />
      )}
    </aside>
  );

  function NavItem(props: { icon: React.ReactNode; label: string; count?: number; active?: boolean; onClick: () => void; small?: boolean }) {
    return (
      <div onClick={props.onClick} className={`group flex items-center gap-2 px-2.5 py-1 mx-2 my-0.5 rounded text-sm cursor-pointer transition ${isActive(!!props.active)} ${props.small ? 'text-xs' : ''}`}>
        <span className="theme-muted shrink-0">{props.icon}</span>
        <span className="flex-1 truncate">{props.label}</span>
        {props.count !== undefined && props.count > 0 && (<span className="text-[10px] theme-muted">{props.count}</span>)}
      </div>
    );
  }
}

function Section({ label, actions }: { label: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-1">
      <span className="text-[10px] uppercase tracking-wider theme-muted font-semibold">{label}</span>
      {actions}
    </div>
  );
}

function NameInput(props: { placeholder: string; value: string; onChange: (v: string) => void; onSubmit: (v: string) => void; onCancel: () => void; indent?: boolean }) {
  return (
    <form className="px-3 py-1" onSubmit={(e) => { e.preventDefault(); if (props.value.trim()) props.onSubmit(props.value.trim()); }} style={{ paddingLeft: props.indent ? 30 : undefined }}>
      <input autoFocus value={props.value} onChange={(e) => props.onChange(e.target.value)} onBlur={() => { if (props.value.trim()) props.onSubmit(props.value.trim()); else props.onCancel(); }} onKeyDown={(e) => { if (e.key === 'Escape') props.onCancel(); }} placeholder={props.placeholder} className="w-full theme-input text-sm rounded px-2 py-1 outline-none focus:ring-1 focus:ring-current" />
    </form>
  );
}

function NotebookRow(props: {
  nb: Notebook; displayName: string; count: number; active: boolean; editing: boolean; editValue: string;
  onClick: () => void; onStartRename: () => void; onChangeRename: (s: string) => void; onSubmitRename: () => void;
  onDelete: () => void; canDelete: boolean;
  isDropTarget: boolean; onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void; onDrop: (e: React.DragEvent) => void;
  stacks: Stack[]; onSetStack: (id: string | null) => void; indent?: boolean;
  t: (k: any, p?: any) => string;
}) {
  const [menu, setMenu] = useState(false);
  if (props.editing) {
    return <NameInput placeholder="" value={props.editValue} onChange={props.onChangeRename} onSubmit={() => props.onSubmitRename()} onCancel={() => props.onSubmitRename()} indent={props.indent} />;
  }
  return (
    <div className={`group relative`} onDragOver={props.onDragOver} onDragLeave={props.onDragLeave} onDrop={props.onDrop}>
      <div onClick={props.onClick} className={`flex items-center gap-2 px-2.5 py-1 mx-2 my-0.5 rounded text-sm cursor-pointer transition ${
        props.active ? 'bg-black/10 dark:bg-white/10 theme-text' : 'hover:bg-black/5 dark:hover:bg-white/5 theme-muted hover:theme-text'
      } ${props.isDropTarget ? 'ring-2 ring-current/40' : ''}`} style={{ paddingLeft: props.indent ? 28 : undefined }}>
        <NotebookIcon size={14} className="theme-muted shrink-0" />
        <span className="flex-1 truncate">{props.displayName}</span>
        {props.count > 0 && <span className="text-[10px] theme-muted">{props.count}</span>}
        <span className="opacity-0 group-hover:opacity-100 flex gap-0.5 relative">
          <button onClick={(e) => { e.stopPropagation(); setMenu(!menu); }} className="theme-muted hover:theme-text p-0.5"><Pencil size={10} /></button>
          {props.canDelete && (
            <button onClick={(e) => { e.stopPropagation(); props.onDelete(); }} className="theme-muted hover:text-red-400 p-0.5"><X size={10} /></button>
          )}
        </span>
      </div>
      {menu && (
        <div className="absolute top-full mt-1 right-2 theme-popover rounded-lg p-1 z-30 min-w-[160px] shadow-xl" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { props.onStartRename(); setMenu(false); }} className="w-full text-left px-2 py-1 text-xs hover:theme-hover rounded theme-text">{props.t('sidebar.rename')}</button>
          {props.stacks.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wider theme-muted px-2 pt-1">{props.t('sidebar.moveToStack')}</div>
              <button onClick={() => { props.onSetStack(null); setMenu(false); }} className="w-full text-left px-2 py-1 text-xs hover:theme-hover rounded theme-text">{props.t('sidebar.noStack')}</button>
              {props.stacks.map((s) => (
                <button key={s.id} onClick={() => { props.onSetStack(s.id); setMenu(false); }} className="w-full text-left px-2 py-1 text-xs hover:theme-hover rounded theme-text">{s.name}</button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TagRenameMenu({ tag, x, y, onClose, onRenamed }: { tag: string; x: number; y: number; onClose: () => void; onRenamed: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(tag);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  async function commit() {
    const next = draft.trim().replace(/^#+/, '');
    if (!next || next === tag) { onClose(); return; }
    const r = await window.nv.renameTag(tag, next);
    useTagRegistry.getState().rename(tag, next);
    onRenamed();
    useStore.getState().toast('success', `Étiquette renommée (${r.affected} note${r.affected > 1 ? 's' : ''})`);
    onClose();
  }
  async function detach() {
    if (!confirm(`Retirer l'étiquette « ${tag} » de toutes les notes ?\n\nL'étiquette restera visible dans la barre latérale (vide).`)) return;
    const r = await window.nv.renameTag(tag, '');
    onRenamed();
    useStore.getState().toast('info', `Étiquette retirée (${r.affected} note${r.affected > 1 ? 's' : ''})`);
    onClose();
  }
  async function deleteTag() {
    if (!confirm(`Supprimer définitivement l'étiquette « ${tag} » ?\n\nElle sera retirée des notes qui l'utilisent encore et ne réapparaîtra plus dans la barre latérale.`)) return;
    const r = await window.nv.renameTag(tag, '');
    useTagRegistry.getState().forget(tag);
    onRenamed();
    useStore.getState().toast('info', r.affected > 0
      ? `Étiquette supprimée (${r.affected} note${r.affected > 1 ? 's' : ''} mise${r.affected > 1 ? 's' : ''} à jour)`
      : 'Étiquette supprimée');
    onClose();
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 theme-popover rounded-lg shadow-2xl border theme-border min-w-[220px] py-1 pop-in"
      style={{ left: x, top: y }}
    >
      {!renaming ? (
        <>
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider theme-muted font-semibold">Étiquette #{tag}</div>
          <button
            onClick={() => setRenaming(true)}
            className="w-full text-left px-3 py-1.5 text-sm hover:theme-hover theme-text"
          >
            ✏️ Renommer…
          </button>
          <button
            onClick={detach}
            className="w-full text-left px-3 py-1.5 text-sm hover:theme-hover theme-text"
          >
            🧹 Retirer de toutes les notes
          </button>
          <div className="my-1 border-t theme-border-soft" />
          <button
            onClick={deleteTag}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-red-500/10 text-red-400"
          >
            🗑 Supprimer l'étiquette
          </button>
        </>
      ) : (
        <div className="px-3 py-2 space-y-2">
          <div className="text-[10px] uppercase tracking-wider theme-muted font-semibold">Renommer #{tag}</div>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') onClose(); }}
            className="w-full theme-input rounded px-2 py-1 text-sm outline-none"
            placeholder="Nouveau nom"
          />
          <div className="flex justify-end gap-1">
            <button onClick={onClose} className="text-xs px-2 py-1 rounded theme-muted hover:theme-text hover:theme-hover">Annuler</button>
            <button onClick={commit} className="text-xs px-3 py-1 rounded text-white theme-accent-bg hover:opacity-90">Renommer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MedsSidebarEntry({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  // Compute today's pending pill count so we can show a badge.
  const [pending, setPending] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function compute() {
      try {
        const [meds, intakes] = await Promise.all([window.nv.listMedications(), window.nv.listIntakes()]);
        const now = new Date();
        const dow = now.getDay();
        let count = 0;
        for (const m of meds) {
          if (!m.active) continue;
          if (m.daysOfWeek.length > 0 && !m.daysOfWeek.includes(dow)) continue;
          for (const time of m.schedule) {
            const [h, mi] = time.split(':').map(Number);
            const d = new Date(now); d.setHours(h, mi, 0, 0);
            const at = d.getTime();
            const taken = intakes.some((x) => x.medId === m.id && x.scheduledFor === at && (x.takenAt || x.skipped));
            if (!taken) count++;
          }
        }
        if (!cancelled) setPending(count);
      } catch { /* ignore */ }
    }
    compute();
    const iv = setInterval(compute, 60_000); // refresh every minute
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 px-2.5 py-1.5 mx-2 my-1 rounded-lg text-sm cursor-pointer transition relative overflow-hidden ${
        active
          ? 'text-white shadow-md'
          : 'theme-text hover:opacity-95'
      }`}
      style={{
        background: active
          ? 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)'
          : 'linear-gradient(135deg, rgba(13,148,136,0.10) 0%, rgba(20,184,166,0.06) 100%)',
        border: active ? 'none' : '1px solid rgba(13,148,136,0.25)',
      }}
    >
      <span
        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
        style={{ background: active ? 'rgba(255,255,255,0.2)' : 'rgba(13,148,136,0.18)', color: active ? '#fff' : '#0d9488' }}
      >
        <Pill size={13} />
      </span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {pending > 0 && (
        <span
          className="text-[10px] px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold"
          style={{
            background: active ? 'rgba(255,255,255,0.25)' : '#0d9488',
            color: '#fff',
          }}
        >
          {pending}
        </span>
      )}
    </div>
  );
}

function StackBlock(props: { stack: Stack; collapsed: boolean; onToggle: () => void; editing: boolean; editValue: string; onStartRename: () => void; onChangeRename: (s: string) => void; onSubmitRename: () => void; onDelete: () => void; onAddNotebook: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      {props.editing ? (
        <NameInput placeholder="" value={props.editValue} onChange={props.onChangeRename} onSubmit={() => props.onSubmitRename()} onCancel={() => props.onSubmitRename()} />
      ) : (
        <div className="group flex items-center gap-1 px-3 py-1 text-xs theme-muted hover:theme-text">
          <button onClick={props.onToggle}>{props.collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}</button>
          <Layers size={11} />
          <span className="flex-1 truncate font-semibold uppercase tracking-wider text-[10px]">{props.stack.name}</span>
          <span className="opacity-0 group-hover:opacity-100 flex gap-0.5">
            <button onClick={props.onAddNotebook}><Plus size={10} /></button>
            <button onClick={props.onStartRename}><Pencil size={10} /></button>
            <button onClick={props.onDelete} className="hover:text-red-400"><X size={10} /></button>
          </span>
        </div>
      )}
      {!props.collapsed && props.children}
    </div>
  );
}
