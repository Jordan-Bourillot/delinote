import { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code, Minus, Sigma, GitBranch, Table, Image, Type,
} from 'lucide-react';
import { useT } from '../i18n';
import { useSettings } from '../settings';

export type SlashCommand = {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  /** When false (settings disabled this), command is hidden. */
  enabled: boolean;
  run: (editor: Editor) => void;
};

export function buildCommands(t: (k: any, p?: any) => string, settings: any): SlashCommand[] {
  return [
    { id: 'h1', label: t('tb.h1'), hint: '# ', icon: <Heading1 size={16} />, enabled: settings.enableHeadings, run: (e: Editor) => e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).toggleHeading({ level: 1 }).run() },
    { id: 'h2', label: t('tb.h2'), hint: '## ', icon: <Heading2 size={16} />, enabled: settings.enableHeadings, run: (e: Editor) => e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).toggleHeading({ level: 2 }).run() },
    { id: 'h3', label: t('tb.h3'), hint: '### ', icon: <Heading3 size={16} />, enabled: settings.enableHeadings, run: (e: Editor) => e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).toggleHeading({ level: 3 }).run() },
    { id: 'p', label: t('tb.bold'), hint: 'p', icon: <Type size={16} />, enabled: true, run: (e: Editor) => e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).setParagraph().run() },
    { id: 'ul', label: t('tb.bullet'), hint: '* ', icon: <List size={16} />, enabled: settings.enableLists, run: (e: Editor) => e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).toggleBulletList().run() },
    { id: 'ol', label: t('tb.ordered'), hint: '1. ', icon: <ListOrdered size={16} />, enabled: settings.enableLists, run: (e: Editor) => e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).toggleOrderedList().run() },
    { id: 'task', label: t('tb.task'), hint: '[ ]', icon: <CheckSquare size={16} />, enabled: settings.enableTaskLists, run: (e: Editor) => e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).toggleTaskList().run() },
    { id: 'quote', label: t('tb.quote'), hint: '> ', icon: <Quote size={16} />, enabled: settings.enableBlockquote, run: (e: Editor) => e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).toggleBlockquote().run() },
    { id: 'code', label: t('tb.codeBlock'), hint: '```', icon: <Code size={16} />, enabled: settings.enableCodeBlock, run: (e: Editor) => e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).toggleCodeBlock().run() },
    { id: 'hr', label: t('tb.hr'), hint: '---', icon: <Minus size={16} />, enabled: settings.enableHorizontalRule, run: (e: Editor) => e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).setHorizontalRule().run() },
    { id: 'table', label: t('tb.table'), hint: '', icon: <Table size={16} />, enabled: settings.enableTables, run: (e: Editor) => e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: 'image', label: t('tb.image'), hint: '', icon: <Image size={16} />, enabled: settings.enableImages, run: (e: Editor) => { const url = window.prompt('URL'); if (url) e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).setImage({ src: url }).run(); } },
    { id: 'math', label: 'Math (LaTeX)', hint: '$$', icon: <Sigma size={16} />, enabled: true, run: (e: Editor) => { const tex = window.prompt('LaTeX', 'a^2 + b^2 = c^2'); if (tex) e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).insertContent({ type: 'mathBlock', attrs: { tex } }).run(); } },
    { id: 'mermaid', label: 'Mermaid', hint: '', icon: <GitBranch size={16} />, enabled: true, run: (e: Editor) => { const code = window.prompt('Mermaid', 'graph TD;A-->B;A-->C;'); if (code) e.chain().focus().deleteRange({ from: e.state.selection.from - 1, to: e.state.selection.from }).insertContent({ type: 'mermaidBlock', attrs: { code } }).run(); } },
  ].filter((c) => c.enabled);
}

export default function SlashMenu({ editor, position, query, onClose }: {
  editor: Editor;
  position: { top: number; left: number };
  query: string;
  onClose: () => void;
}) {
  const t = useT();
  const settings = useSettings((s) => s.settings);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const allCommands = useMemo(() => buildCommands(t, settings), [t, settings]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCommands;
    return allCommands.filter((c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q));
  }, [allCommands, query]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[active];
        if (cmd) { cmd.run(editor); onClose(); }
      }
      else if (e.key === 'Escape') { onClose(); }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [filtered, active, editor, onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 theme-popover rounded-lg shadow-2xl border theme-border w-72 max-h-80 overflow-y-auto py-1"
      style={{ top: position.top + 24, left: position.left }}
    >
      {filtered.length === 0 ? (
        <div className="px-3 py-2 text-xs theme-muted">—</div>
      ) : filtered.map((c, idx) => (
        <button
          key={c.id}
          onMouseDown={(e) => { e.preventDefault(); c.run(editor); onClose(); }}
          onMouseEnter={() => setActive(idx)}
          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left ${idx === active ? 'theme-accent-bg text-white' : 'theme-text hover:theme-hover'}`}
        >
          <span className={idx === active ? 'text-white' : 'theme-muted'}>{c.icon}</span>
          <span className="flex-1 truncate">{c.label}</span>
          {c.hint && <span className={`text-[10px] ${idx === active ? 'text-white/70' : 'theme-muted'}`}>{c.hint}</span>}
        </button>
      ))}
    </div>
  );
}
