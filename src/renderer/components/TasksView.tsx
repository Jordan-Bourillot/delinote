import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useT } from '../i18n';
import { useLabels } from '../labels';
import { CheckSquare, Square, FileText, ArrowRight, List, LayoutGrid } from 'lucide-react';

type Task = {
  noteId: string;
  noteTitle: string;
  notebookId: string;
  text: string;
  checked: boolean;
  /** position in the JSON tree, used to flip the value back */
  path: number[];
};

type Mode = 'list' | 'kanban';

export default function TasksView() {
  const { index, selectNote, openTab } = useStore();
  const t = useT();
  const lbl = useLabels();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('delinote.tasks.mode') as Mode) || 'list');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    try { localStorage.setItem('delinote.tasks.mode', mode); } catch { /* ignore */ }
  }, [mode]);

  // Walk every note's content and extract task items.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all: Task[] = [];
      for (const meta of index.notes) {
        if (meta.trashed) continue;
        const note = await window.nv.getNote(meta.id);
        if (!note) continue;
        try {
          const doc = JSON.parse(note.content);
          collectTasks(doc, [], (text, checked, path) => {
            all.push({
              noteId: note.id,
              noteTitle: lbl.noteTitle(note.title),
              notebookId: note.notebookId,
              text,
              checked,
              path,
            });
          });
        } catch { /* ignore parse errors */ }
        if (cancelled) return;
      }
      if (!cancelled) setTasks(all);
    })();
    return () => { cancelled = true; };
  }, [index.notes, reload]);

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks;
    if (filter === 'pending') return tasks.filter((x) => !x.checked);
    return tasks.filter((x) => x.checked);
  }, [tasks, filter]);

  async function toggle(task: Task) {
    const note = await window.nv.getNote(task.noteId);
    if (!note) return;
    try {
      const doc = JSON.parse(note.content);
      const target = walkPath(doc, task.path);
      if (target && target.type === 'taskItem') {
        target.attrs = { ...(target.attrs ?? {}), checked: !task.checked };
        await window.nv.saveNote({
          id: note.id,
          content: JSON.stringify(doc),
        });
        setReload((x) => x + 1);
      }
    } catch { /* ignore */ }
  }

  // Group filtered tasks by notebook for the kanban view.
  const byNotebook = useMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const task of filtered) {
      const arr = groups.get(task.notebookId) ?? [];
      arr.push(task);
      groups.set(task.notebookId, arr);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="flex-1 overflow-y-auto theme-bg">
      <div className={`mx-auto px-8 pt-8 pb-12 ${mode === 'kanban' ? 'max-w-none' : 'max-w-3xl'}`}>
        <header className="flex items-center gap-4 mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            <CheckSquare size={22} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold theme-text">{t('tasks.title')}</h1>
            <p className="text-xs theme-muted">{tasks.filter((x) => !x.checked).length} {t('tasks.filter.pending').toLowerCase()} · {tasks.length} {t('tasks.filter.all').toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-1 theme-card border theme-border-soft rounded-lg p-0.5">
            <button
              onClick={() => setMode('list')}
              className={`px-2.5 py-1 text-xs rounded flex items-center gap-1.5 ${mode === 'list' ? 'theme-accent-bg text-white shadow-sm' : 'theme-muted hover:theme-text'}`}
              title={t('tasks.view.list')}
            >
              <List size={12} /> {t('tasks.view.list')}
            </button>
            <button
              onClick={() => setMode('kanban')}
              className={`px-2.5 py-1 text-xs rounded flex items-center gap-1.5 ${mode === 'kanban' ? 'theme-accent-bg text-white shadow-sm' : 'theme-muted hover:theme-text'}`}
              title={t('tasks.view.kanban')}
            >
              <LayoutGrid size={12} /> {t('tasks.view.kanban')}
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="flex items-center gap-1 mb-5">
          {(['pending', 'all', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg ${filter === f ? 'theme-accent-bg text-white shadow-sm' : 'theme-muted hover:theme-text hover:theme-hover'}`}
            >
              {t(`tasks.filter.${f}` as any)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="theme-card-soft rounded-xl px-6 py-10 text-center border theme-border-soft border-dashed">
            <CheckSquare size={28} className="mx-auto theme-muted mb-3 opacity-50" />
            <p className="text-sm theme-text">{t('tasks.empty')}</p>
          </div>
        ) : mode === 'list' ? (
          <div className="space-y-1">
            {filtered.map((task, i) => (
              <TaskRow
                key={`${task.noteId}-${task.path.join('.')}-${i}`}
                task={task}
                onToggle={() => void toggle(task)}
                onOpen={() => { void selectNote(task.noteId); openTab(task.noteId); }}
                openLabel={t('tasks.openNote')}
                fromLabel={t('tasks.fromNote', { note: task.noteTitle })}
              />
            ))}
          </div>
        ) : (
          <KanbanBoard
            byNotebook={byNotebook}
            notebooks={index.notebooks}
            onToggle={toggle}
            onOpen={(id) => { void selectNote(id); openTab(id); }}
            openLabel={t('tasks.openNote')}
            emptyColLabel={t('tasks.kanbanColEmpty')}
            untitled={t('list.untitled')}
          />
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, onOpen, openLabel, fromLabel }: {
  task: Task;
  onToggle: () => void;
  onOpen: () => void;
  openLabel: string;
  fromLabel: string;
}) {
  return (
    <div className="theme-card hover:theme-hover rounded-lg border theme-border-soft px-3 py-2 flex items-start gap-3 group transition">
      <button onClick={onToggle} className="mt-0.5 theme-muted hover:theme-text">
        {task.checked ? <CheckSquare size={16} className="theme-accent" /> : <Square size={16} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${task.checked ? 'theme-muted line-through' : 'theme-text'}`}>
          {task.text || <span className="italic theme-muted">(vide)</span>}
        </div>
        <div className="text-[10px] theme-muted mt-0.5 flex items-center gap-1">
          <FileText size={9} />
          {fromLabel}
        </div>
      </div>
      <button
        onClick={onOpen}
        title={openLabel}
        className="opacity-0 group-hover:opacity-100 theme-muted hover:theme-text p-1"
      >
        <ArrowRight size={12} />
      </button>
    </div>
  );
}

function KanbanBoard({ byNotebook, notebooks, onToggle, onOpen, openLabel, emptyColLabel, untitled }: {
  byNotebook: Map<string, Task[]>;
  notebooks: { id: string; name: string }[];
  onToggle: (task: Task) => Promise<void>;
  onOpen: (noteId: string) => void;
  openLabel: string;
  emptyColLabel: string;
  untitled: string;
}) {
  // Only render columns that contain visible tasks, in notebook order.
  const cols = notebooks
    .map((nb) => ({ nb, tasks: byNotebook.get(nb.id) ?? [] }))
    .filter((c) => c.tasks.length > 0);

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2">
      {cols.map(({ nb, tasks }) => {
        const pending = tasks.filter((t) => !t.checked).length;
        return (
          <div
            key={nb.id}
            className="kanban-col w-72 shrink-0 theme-card-soft border theme-border-soft rounded-xl p-3 flex flex-col"
          >
            <header className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs uppercase tracking-wider font-semibold theme-text truncate">{nb.name || untitled}</h3>
              <span className="text-[10px] theme-muted">{pending} / {tasks.length}</span>
            </header>
            {tasks.length === 0 ? (
              <p className="text-xs theme-muted px-2 py-3 italic">{emptyColLabel}</p>
            ) : (
              <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[65vh]">
                {tasks.map((task, i) => (
                  <div
                    key={`${task.noteId}-${task.path.join('.')}-${i}`}
                    className="theme-card hover:theme-hover rounded-lg border theme-border-soft px-2.5 py-2 group transition"
                  >
                    <div className="flex items-start gap-2">
                      <button onClick={() => void onToggle(task)} className="mt-0.5 theme-muted hover:theme-text shrink-0">
                        {task.checked ? <CheckSquare size={14} className="theme-accent" /> : <Square size={14} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs ${task.checked ? 'theme-muted line-through' : 'theme-text'} break-words`}>
                          {task.text || <span className="italic theme-muted">(vide)</span>}
                        </div>
                        <button
                          onClick={() => onOpen(task.noteId)}
                          title={openLabel}
                          className="text-[10px] theme-muted hover:theme-accent mt-1 flex items-center gap-1 opacity-70 group-hover:opacity-100"
                        >
                          <FileText size={9} />
                          <span className="truncate">{task.noteTitle}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function collectTasks(node: any, path: number[], onTask: (text: string, checked: boolean, path: number[]) => void) {
  if (!node) return;
  if (node.type === 'taskItem') {
    const text = textOf(node);
    onTask(text, !!node.attrs?.checked, path);
  }
  if (Array.isArray(node.content)) {
    node.content.forEach((c: any, i: number) => collectTasks(c, [...path, i], onTask));
  }
}

function walkPath(doc: any, path: number[]): any {
  let cur = doc;
  for (const idx of path) {
    if (!cur || !Array.isArray(cur.content)) return null;
    cur = cur.content[idx];
  }
  return cur;
}

function textOf(node: any): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) return node.content.map(textOf).join('');
  return '';
}
