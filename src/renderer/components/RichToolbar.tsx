import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Link as LinkIcon,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Minus,
  AlignLeft, AlignCenter, AlignRight, Image as ImageIcon, Table as TableIcon,
  Highlighter, Palette, Type, ChevronDown, Superscript, Subscript,
  IndentDecrease, IndentIncrease, MoreHorizontal, Star, Zap,
} from 'lucide-react';
import { useStore } from '../store';

const TEXT_COLORS = [
  '#1B2330', '#ef4444', '#F37223', '#fbbf24',
  '#22c55e', '#0d9488', '#3b82f6', '#a855f7', '#ec4899',
];
const HIGHLIGHT_COLORS = [
  '#fef3c7', '#fee2e2', '#fed7aa', '#dcfce7',
  '#cffafe', '#dbeafe', '#ede9fe', '#fce7f3', '#e5e7eb',
];
const FONT_FAMILIES = [
  { label: 'Sans serif', value: 'Inter, system-ui, sans-serif' },
  { label: 'Serif', value: '"Iowan Old Style", Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace' },
];
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60];

/**
 * Enriched editor toolbar — closer to Evernote / Notion / Google Docs.
 * Adds: font family, font size, text color, highlight color, sup/sub, indent.
 */
export default function RichToolbar({ editor }: { editor: Editor }) {
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const current = useStore((s) => s.current);
  const refresh = useStore((s) => s.refresh);
  async function togglePriority(key: 'important' | 'urgent') {
    if (!current) return;
    const next = !current[key];
    await window.nv.saveNote({ id: current.id, [key]: next } as any);
    useStore.setState((s) => ({
      current: s.current && s.current.id === current.id ? { ...s.current, [key]: next } : s.current,
    }));
    await refresh();
  }

  // Close all popovers when clicking outside the toolbar
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setTextColorOpen(false); setHighlightOpen(false); setFontOpen(false);
        setSizeOpen(false); setHeadingOpen(false); setAlignOpen(false); setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!editor) return null;

  const currentTextColor = editor.getAttributes('textStyle')?.color as string | undefined;
  const currentHighlight = editor.getAttributes('highlight')?.color as string | undefined;
  const currentFont = editor.getAttributes('textStyle')?.fontFamily as string | undefined;
  const currentSize = editor.getAttributes('textStyle')?.fontSize as string | undefined;
  const currentLevel = [1, 2, 3].find((l) => editor.isActive('heading', { level: l }));

  return (
    <div
      ref={ref}
      className="flex items-center gap-0.5 px-2 py-1.5 border-b theme-border-soft theme-bg-soft sticky top-0 z-10 flex-wrap"
    >
      {/* Heading dropdown */}
      <Dropdown open={headingOpen} setOpen={setHeadingOpen} label={
        <span className="flex items-center gap-1 text-xs px-1.5">
          <Type size={13} /> {currentLevel ? `H${currentLevel}` : 'Normal'} <ChevronDown size={11} />
        </span>
      }>
        <MItem onClick={() => editor.chain().focus().setParagraph().run()}><Type size={13} /> Normal</MItem>
        <MItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={13} /> Titre 1</MItem>
        <MItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={13} /> Titre 2</MItem>
        <MItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={13} /> Titre 3</MItem>
        <MItem onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={13} /> Citation</MItem>
      </Dropdown>

      {/* Font family */}
      <Dropdown open={fontOpen} setOpen={setFontOpen} label={
        <span className="flex items-center gap-1 text-xs px-1.5 min-w-[80px]">
          {FONT_FAMILIES.find((f) => f.value === currentFont)?.label ?? 'Sans serif'} <ChevronDown size={11} />
        </span>
      }>
        {FONT_FAMILIES.map((f) => (
          <MItem key={f.label} onClick={() => (editor.chain().focus() as any).setFontFamily(f.value).run()}>
            <span style={{ fontFamily: f.value }}>{f.label}</span>
          </MItem>
        ))}
        <div className="border-t theme-border-soft my-1" />
        <MItem onClick={() => (editor.chain().focus() as any).unsetFontFamily?.().run()}>↺ Par défaut</MItem>
      </Dropdown>

      {/* Font size */}
      <Dropdown open={sizeOpen} setOpen={setSizeOpen} label={
        <span className="flex items-center gap-1 text-xs px-1.5 tabular-nums">
          {currentSize ? parseInt(currentSize, 10) : 16} <ChevronDown size={11} />
        </span>
      }>
        {FONT_SIZES.map((s) => (
          <MItem key={s} onClick={() => (editor.chain().focus() as any).setFontSize(`${s}px`).run()}>
            <span style={{ fontSize: Math.min(s, 16) }} className="tabular-nums">{s}</span>
          </MItem>
        ))}
        <div className="border-t theme-border-soft my-1" />
        <MItem onClick={() => (editor.chain().focus() as any).unsetFontSize?.().run()}>↺ Par défaut</MItem>
      </Dropdown>

      <Sep />

      {/* Text color */}
      <div className="relative">
        <button
          onClick={() => setTextColorOpen(!textColorOpen)}
          className="p-1.5 rounded hover:theme-hover relative flex flex-col items-center"
          title="Couleur du texte"
        >
          <span style={{ color: currentTextColor || 'currentColor' }} className="text-sm font-bold leading-none">A</span>
          <span className="block w-4 h-1 mt-0.5 rounded" style={{ background: currentTextColor || '#1B2330' }} />
        </button>
        {textColorOpen && (
          <Popover>
            <ColorGrid colors={TEXT_COLORS} current={currentTextColor} onPick={(c) => {
              editor.chain().focus().setColor(c).run();
              setTextColorOpen(false);
            }} onClear={() => { editor.chain().focus().unsetColor().run(); setTextColorOpen(false); }} />
          </Popover>
        )}
      </div>

      {/* Highlight color */}
      <div className="relative">
        <button
          onClick={() => setHighlightOpen(!highlightOpen)}
          className="p-1.5 rounded hover:theme-hover flex flex-col items-center"
          title="Surlignage"
        >
          <Highlighter size={15} />
          <span className="block w-4 h-1 mt-0.5 rounded" style={{ background: currentHighlight || '#fef3c7' }} />
        </button>
        {highlightOpen && (
          <Popover>
            <ColorGrid colors={HIGHLIGHT_COLORS} current={currentHighlight} onPick={(c) => {
              editor.chain().focus().setHighlight({ color: c }).run();
              setHighlightOpen(false);
            }} onClear={() => { editor.chain().focus().unsetHighlight().run(); setHighlightOpen(false); }} />
          </Popover>
        )}
      </div>

      <Sep />

      {/* Inline formatting */}
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras (Ctrl+B)"><Bold size={14} /></Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique (Ctrl+I)"><Italic size={14} /></Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Souligné (Ctrl+U)"><UnderlineIcon size={14} /></Btn>
      <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Barré"><Strikethrough size={14} /></Btn>

      <Sep />

      {/* Lists */}
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste à puces"><List size={14} /></Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numérotée"><ListOrdered size={14} /></Btn>
      <Btn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Liste de tâches"><CheckSquare size={14} /></Btn>

      <Sep />

      {/* Indent / outdent */}
      <Btn
        title="Diminuer le retrait"
        onClick={() => {
          if (editor.isActive('listItem')) editor.chain().focus().liftListItem('listItem').run();
          else if (editor.isActive('taskItem')) editor.chain().focus().liftListItem('taskItem').run();
        }}
      ><IndentDecrease size={14} /></Btn>
      <Btn
        title="Augmenter le retrait"
        onClick={() => {
          if (editor.isActive('listItem')) editor.chain().focus().sinkListItem('listItem').run();
          else if (editor.isActive('taskItem')) editor.chain().focus().sinkListItem('taskItem').run();
        }}
      ><IndentIncrease size={14} /></Btn>

      <Sep />

      {/* Alignment */}
      <Dropdown open={alignOpen} setOpen={setAlignOpen} label={
        <span className="flex items-center gap-1 px-1">
          <AlignLeft size={14} /> <ChevronDown size={11} />
        </span>
      }>
        <MItem onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={13} /> Aligner à gauche</MItem>
        <MItem onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={13} /> Centrer</MItem>
        <MItem onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={13} /> Aligner à droite</MItem>
        <MItem onClick={() => editor.chain().focus().setTextAlign('justify').run()}>≡ Justifier</MItem>
      </Dropdown>

      <Sep />

      {/* Link / image / table */}
      <Btn
        active={editor.isActive('link')}
        title="Lien (Ctrl+K)"
        onClick={() => {
          const prev = editor.getAttributes('link').href as string | undefined;
          const url = window.prompt('URL', prev ?? 'https://');
          if (url === null) return;
          if (url === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
          else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }}
      ><LinkIcon size={14} /></Btn>
      <Btn title="Insérer une image (URL)" onClick={() => {
        const url = window.prompt('URL de l\'image');
        if (url) editor.chain().focus().setImage({ src: url }).run();
      }}><ImageIcon size={14} /></Btn>
      <Btn title="Insérer un tableau" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={14} /></Btn>

      <Sep />

      {/* Sup / sub / hr */}
      <Btn active={editor.isActive('superscript')} title="Exposant (x²)" onClick={() => (editor.chain().focus() as any).toggleSuperscript().run()}><Superscript size={14} /></Btn>
      <Btn active={editor.isActive('subscript')} title="Indice (x₂)" onClick={() => (editor.chain().focus() as any).toggleSubscript().run()}><Subscript size={14} /></Btn>
      <Btn title="Ligne horizontale" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={14} /></Btn>

      <Sep />

      {/* Priorité — important (jaune) / urgent (bleu) */}
      <button
        onMouseDown={(e) => { e.preventDefault(); void togglePriority('important'); }}
        title="Marquer comme importante (cadre jaune)"
        className={`p-1.5 rounded transition ${current?.important ? 'shadow-sm text-white' : 'theme-muted hover:theme-hover hover:theme-text'}`}
        style={current?.important ? { background: '#eab308' } : undefined}
      >
        <Star size={14} />
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); void togglePriority('urgent'); }}
        title="Marquer comme urgente (cadre bleu)"
        className={`p-1.5 rounded transition ${current?.urgent ? 'shadow-sm text-white' : 'theme-muted hover:theme-hover hover:theme-text'}`}
        style={current?.urgent ? { background: '#3b82f6' } : undefined}
      >
        <Zap size={14} />
      </button>

      {/* More */}
      <Dropdown open={moreOpen} setOpen={setMoreOpen} label={
        <span className="flex items-center gap-1 text-xs px-1.5">
          <MoreHorizontal size={14} /> Plus
        </span>
      }>
        <MItem onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>↺ Supprimer le formatage</MItem>
      </Dropdown>
    </div>
  );
}

function Btn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title: string }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded transition ${active ? 'theme-accent-bg text-white shadow-sm' : 'theme-muted hover:theme-hover hover:theme-text'}`}
    >
      {children}
    </button>
  );
}
function Sep() { return <span className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />; }

function Dropdown({ open, setOpen, label, children }: { open: boolean; setOpen: (b: boolean) => void; label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <button
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        className="px-1 py-1 rounded theme-muted hover:theme-hover hover:theme-text"
      >
        {label}
      </button>
      {open && (
        <Popover>{children}</Popover>
      )}
    </div>
  );
}

function Popover({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute top-full left-0 mt-1 theme-popover rounded-lg shadow-2xl border theme-border min-w-[160px] py-1 z-50 pop-in">
      {children}
    </div>
  );
}

function MItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left theme-text hover:theme-hover"
    >
      {children}
    </button>
  );
}

function ColorGrid({ colors, current, onPick, onClear }: {
  colors: string[];
  current: string | undefined;
  onPick: (color: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="p-2 w-[180px]">
      <div className="grid grid-cols-5 gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            onMouseDown={(e) => { e.preventDefault(); onPick(c); }}
            className={`w-7 h-7 rounded-md transition hover:scale-110 ${current?.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-offset-1 ring-current' : ''}`}
            style={{ background: c, border: '1px solid rgba(0,0,0,0.06)' }}
            title={c}
          />
        ))}
      </div>
      <div className="flex justify-between items-center mt-2 pt-2 border-t theme-border-soft">
        <input
          type="color"
          onChange={(e) => onPick(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer"
          title="Couleur personnalisée"
        />
        <button
          onMouseDown={(e) => { e.preventDefault(); onClear(); }}
          className="text-xs theme-muted hover:theme-text px-2 py-1"
        >
          ↺ Retirer
        </button>
      </div>
    </div>
  );
}
