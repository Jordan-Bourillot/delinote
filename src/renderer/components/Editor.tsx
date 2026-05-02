import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { useStore } from '../store';
import { useSettings } from '../settings';
import { useT as useTHook } from '../i18n';
import { useDateFmt } from '../dateFmt';
import { buildExtensions } from '../editorExtensions';
import HomeScreen from './HomeScreen';
import SlashMenu from './SlashMenu';
import RichToolbar from './RichToolbar';
import { UnlockGate, LockDialog, isNoteEncrypted, getCachedPassword, clearCachedPassword } from './NoteLock';
import { decryptString } from '../crypto';
import { markNoteAsEncrypted, unmarkNoteAsEncrypted } from '../store';
import { AudioRecorder } from './AudioRecorder';
import { DuplicateDialog } from './DuplicateDialog';
import { ocrImage } from '../ocr';
import { tagPillStyle } from '../tagColors';
import { useTagRegistry } from '../tagRegistry';
import { priorityClass } from './NoteList';
import { generateHTML } from '@tiptap/html';
import TurndownService from 'turndown';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Trash2,
  RotateCcw,
  CheckSquare,
  Underline as UnderlineIcon,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Table as TableIcon,
  Minus,
  Pin,
  PinOff,
  MoreHorizontal,
  Copy,
  Download,
  History,
  BookOpen,
  PenLine,
  Tag as TagIcon,
  Mic,
  Eye,
} from 'lucide-react';
// date-fns is now wrapped via useDateFmt() in '../dateFmt'
import type { ColorLabel, NoteMeta } from '../types';

const COLORS: { id: ColorLabel; name: string; hex: string }[] = [
  { id: '', name: 'None', hex: 'transparent' },
  { id: 'red', name: 'Red', hex: '#ef4444' },
  { id: 'orange', name: 'Orange', hex: '#f97316' },
  { id: 'yellow', name: 'Yellow', hex: '#eab308' },
  { id: 'green', name: 'Green', hex: '#22c55e' },
  { id: 'blue', name: 'Blue', hex: '#3b82f6' },
  { id: 'purple', name: 'Purple', hex: '#a855f7' },
  { id: 'pink', name: 'Pink', hex: '#ec4899' },
];

export default function Editor() {
  const { current, patchCurrent, trash, restore, deleteForever, flushSave, togglePin, setColor, duplicate, index, openModal } =
    useStore();
  const settings = useSettings((s) => s.settings);
  const t = useTHook();
  const df = useDateFmt();
  const [tagDraft, setTagDraft] = useState('');
  const [slash, setSlash] = useState<{ top: number; left: number; query: string } | null>(null);
  const [lockOpen, setLockOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  // Decrypted overrides for the currently-open encrypted note (kept in memory).
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);

  // Expose audio opener globally (toolbar button uses it)
  useEffect(() => {
    (window as any).__openAudioRecorder = () => setAudioOpen(true);
    return () => { delete (window as any).__openAudioRecorder; };
  }, []);

  // Global Ctrl+Shift+D shortcut → opens the duplicate dialog for the current note
  useEffect(() => {
    const onDup = () => setDupOpen(true);
    window.addEventListener('delinote:open-duplicate', onDup);
    return () => window.removeEventListener('delinote:open-duplicate', onDup);
  }, []);
  const [readMode, setReadMode] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const moveRef = useRef<HTMLDivElement>(null);

  const extensions = useMemo(() => buildExtensions(settings), [
    settings.enableHeadings,
    settings.enableLists,
    settings.enableBlockquote,
    settings.enableHorizontalRule,
    settings.enableCodeBlock,
    settings.enableSyntaxHighlight,
    settings.enableLinks,
    settings.enableTaskLists,
    settings.enableUnderline,
    settings.enableHighlight,
    settings.enableTextColor,
    settings.enableTextAlign,
    settings.enableTypography,
    settings.enableImages,
    settings.enableTables,
    settings.enableWikiLinks,
  ]);

  const editor = useEditor(
    {
      extensions,
      content: current ? safeParse(current.content) : '',
      editable: !!current && !current.trashed && !readMode,
      editorProps: {
        attributes: {
          spellcheck: settings.enableSpellcheck ? 'true' : 'false',
        },
        handleKeyDown(view, event) {
          // Wiki-link autocomplete trigger handled at higher level — keep default here
          if (event.key === 'Tab' && view.state.selection.empty) {
            return false;
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        const text = editor.getText();
        const content = JSON.stringify(editor.getJSON());
        patchCurrent({ content, text });

        // Detect slash command trigger: "/" at start of an empty paragraph,
        // or "/" + alphanum after whitespace.
        const { from } = editor.state.selection;
        const $pos = editor.state.doc.resolve(from);
        const blockText = $pos.parent.textContent ?? '';
        const beforeCursor = blockText.slice(0, $pos.parentOffset);
        const m = beforeCursor.match(/(?:^|\s)\/([\w\-]*)$/);
        if (m) {
          try {
            const coords = editor.view.coordsAtPos(from);
            const editorEl = editor.view.dom.getBoundingClientRect();
            setSlash({
              top: coords.top - editorEl.top + (editor.view.dom.parentElement?.scrollTop ?? 0),
              left: coords.left - editorEl.left,
              query: m[1],
            });
          } catch { setSlash(null); }
        } else if (slash) {
          setSlash(null);
        }
      },
    },
    [current?.id, extensions],
  );

  useEffect(() => {
    if (!editor || !current) return;
    if (current.content && current.content !== JSON.stringify(editor.getJSON())) {
      editor.commands.setContent(safeParse(current.content), false);
    }
    editor.setEditable(!current.trashed && !readMode);
    // Expose current note id for inline node views (attachments)
    (window as any).__feverCurrentNoteId = current.id;
  }, [current?.id, readMode, editor]);

  // Drag & drop file attachments onto the editor
  useEffect(() => {
    if (!editor || !current) return;
    const dom = editor.view.dom as HTMLElement;
    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer || e.dataTransfer.files.length === 0) return;
      e.preventDefault();
      for (const file of Array.from(e.dataTransfer.files)) {
        const buf = await file.arrayBuffer();
        const att = await window.nv.saveAttachment(current.id, file.name, file.type, buf);
        // Image → embed as Tiptap image. Otherwise → attachment chip.
        if (file.type.startsWith('image/') && settings.enableImages) {
          const dataUrl = await new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.readAsDataURL(file);
          });
          editor.chain().focus().setImage({ src: dataUrl }).run();
        } else {
          editor.chain().focus().insertContent({
            type: 'attachment',
            attrs: { attachmentId: att.id, filename: att.filename, mime: att.mime, size: att.size },
          }).run();
        }
      }
    };
    const onDragOver = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); };
    dom.addEventListener('drop', onDrop);
    dom.addEventListener('dragover', onDragOver);
    return () => {
      dom.removeEventListener('drop', onDrop);
      dom.removeEventListener('dragover', onDragOver);
    };
  }, [editor, current?.id, settings.enableImages]);

  useEffect(() => {
    setDecryptedContent(null);
    setDecryptedText(null);
    return () => {
      void flushSave();
    };
  }, [current?.id]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (moreOpen && moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (colorOpen && colorRef.current && !colorRef.current.contains(e.target as Node)) setColorOpen(false);
      if (moveOpen && moveRef.current && !moveRef.current.contains(e.target as Node)) setMoveOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [moreOpen, colorOpen, moveOpen]);

  const updated = useMemo(
    () => (current ? df.full(current.updatedAt) : ''),
    [current?.updatedAt, df],
  );

  if (!current) {
    return <HomeScreen />;
  }

  // Encrypted note → unlock gate until decrypted
  const encrypted = isNoteEncrypted(current.content);
  if (encrypted && decryptedContent === null) {
    const cached = getCachedPassword(current.id);
    if (cached) {
      void (async () => {
        try {
          const plain = await decryptString(current.content, cached);
          const parsed = JSON.parse(plain);
          markNoteAsEncrypted(current.id);
          // Replace in-memory content so the editor renders the plain version
          useStore.setState((s) => ({
            current: s.current && s.current.id === current.id ? { ...s.current, content: parsed.content ?? '', text: parsed.text ?? '' } : s.current,
          }));
          setDecryptedContent(parsed.content ?? '');
          setDecryptedText(parsed.text ?? '');
        } catch {
          clearCachedPassword(current.id);
        }
      })();
    }
    return (
      <UnlockGate
        noteId={current.id}
        encryptedContent={current.content}
        onUnlocked={(c, txt) => {
          markNoteAsEncrypted(current.id);
          // Update in-memory current with decrypted content so the editor mounts on the plain text
          useStore.setState((s) => ({
            current: s.current && s.current.id === current.id ? { ...s.current, content: c, text: txt } : s.current,
          }));
          setDecryptedContent(c);
          setDecryptedText(txt);
        }}
      />
    );
  }

  const readOnly = current.trashed || readMode;
  const colorObj = COLORS.find((c) => c.id === current.color);

  async function exportAs(fmt: 'md' | 'html' | 'txt' | 'json') {
    if (!editor || !current) return;
    let body = '';
    if (fmt === 'json') body = '';
    else if (fmt === 'html') body = wrappedHtml(current.title, generateHTML(editor.getJSON(), extensions));
    else if (fmt === 'md') {
      const html = generateHTML(editor.getJSON(), extensions);
      const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
      td.keep(['table', 'thead', 'tbody', 'tr', 'td', 'th']);
      body = `# ${current.title}\n\n${td.turndown(html)}`;
    } else if (fmt === 'txt') {
      body = `${current.title}\n${'='.repeat(current.title.length)}\n\n${editor.getText()}`;
    }
    const res = await window.nv.exportNote(current.id, fmt, body);
    if (res.ok) {
      useStore.getState().toast('success', t('toast.exportedTo', { path: res.path }));
    }
    setMoreOpen(false);
  }

  return (
    <div
      data-tour="editor"
      data-mode={readOnly ? 'read' : 'edit'}
      className={`flex-1 flex flex-col h-full theme-bg relative ${readMode ? 'read-mode' : 'edit-mode'} ${priorityClass(current, settings.urgentBlink)}`}
    >
      <NoteHeader
        t={t}
        current={current}
        updated={updated}
        onTrash={() => void trash(current.id)}
        onRestore={() => void restore(current.id)}
        onDelete={() => { void deleteForever(current.id); }}
        onTogglePin={() => void togglePin(current.id)}
        onDuplicate={() => setDupOpen(true)}
        onExport={exportAs}
        onToggleRead={() => setReadMode((v) => !v)}
        readMode={readMode}
        moreOpen={moreOpen}
        setMoreOpen={setMoreOpen}
        moreRef={moreRef}
        colorOpen={colorOpen}
        setColorOpen={setColorOpen}
        colorRef={colorRef}
        moveOpen={moveOpen}
        setMoveOpen={setMoveOpen}
        moveRef={moveRef}
        colorObj={colorObj}
        notebooks={index.notebooks}
        onSetColor={(c) => void setColor(current.id, c)}
        onMove={(nbId) => {
          void useStore.getState().moveNotes([current.id], nbId);
          setMoveOpen(false);
        }}
        onShowHistory={() => openModal('about')}
        onLock={() => setLockOpen(true)}
      />

      <div className={editorWidthClass(settings.editorWidth)}>
        <input
          ref={(el) => { if (el && !current.title && !current.text) el.focus(); }}
          value={current.title}
          disabled={readOnly}
          onChange={(e) => patchCurrent({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || (e.key === 'ArrowDown' && e.currentTarget.selectionStart === e.currentTarget.value.length)) {
              e.preventDefault();
              editor?.commands.focus('end');
            }
          }}
          placeholder={t('editor.untitled')}
          className="w-full bg-transparent text-[2rem] font-bold theme-text outline-none placeholder:theme-muted py-2"
          style={{ fontFamily: fontFamilyCss(settings.fontFamily) }}
        />
        {settings.enableTags && (
          <TagsRow
            t={t}
            current={current}
            tagDraft={tagDraft}
            setTagDraft={setTagDraft}
            readOnly={readOnly}
            onPatch={patchCurrent}
          />
        )}
      </div>

      {settings.showToolbar && !readOnly && editor && (
        <RichToolbar editor={editor} />
      )}

      <div
        className={`flex-1 overflow-y-auto pb-16 ${editorWidthClass(settings.editorWidth)} relative`}
        style={{
          fontSize: settings.fontSize,
          fontFamily: fontFamilyCss(settings.fontFamily),
        }}
      >
        <EditorContent editor={editor} />
        {slash && editor && (
          <SlashMenu
            editor={editor}
            position={{ top: slash.top, left: slash.left }}
            query={slash.query}
            onClose={() => setSlash(null)}
          />
        )}
      </div>
      {lockOpen && (
        <LockDialog
          noteId={current.id}
          currentContent={current.content}
          currentText={current.text}
          onCancel={() => setLockOpen(false)}
          onLocked={async (env) => {
            markNoteAsEncrypted(current.id);
            await window.nv.saveNote({ id: current.id, content: env, text: '' });
            await useStore.getState().refresh();
            setLockOpen(false);
          }}
        />
      )}
      {audioOpen && editor && (
        <AudioRecorder
          noteId={current.id}
          onAttach={(filename, mime, size, attachmentId) => {
            editor.chain().focus().insertContent({
              type: 'attachment',
              attrs: { attachmentId, filename, mime, size },
            }).run();
          }}
          onTranscript={(text) => {
            // Insert each paragraph as its own paragraph node so structure is sane.
            const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);
            const nodes = paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] }));
            if (nodes.length === 0) return;
            editor.chain().focus().insertContent(nodes).run();
          }}
          onClose={() => setAudioOpen(false)}
        />
      )}
      {dupOpen && current && (
        <DuplicateDialog note={current} onClose={() => setDupOpen(false)} />
      )}
    </div>
  );
}

function NoteHeader(props: {
  t: (k: any, p?: any) => string;
  current: any;
  updated: string;
  onTrash: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onDuplicate: () => void;
  onExport: (fmt: 'md' | 'html' | 'txt' | 'json') => void;
  onToggleRead: () => void;
  readMode: boolean;
  moreOpen: boolean;
  setMoreOpen: (b: boolean) => void;
  moreRef: React.RefObject<HTMLDivElement>;
  colorOpen: boolean;
  setColorOpen: (b: boolean) => void;
  colorRef: React.RefObject<HTMLDivElement>;
  moveOpen: boolean;
  setMoveOpen: (b: boolean) => void;
  moveRef: React.RefObject<HTMLDivElement>;
  colorObj: { id: ColorLabel; name: string; hex: string } | undefined;
  notebooks: { id: string; name: string }[];
  onSetColor: (c: ColorLabel) => void;
  onMove: (nbId: string) => void;
  onShowHistory: () => void;
  onLock: () => void;
}) {
  const settings = useSettings((s) => s.settings);
  const t = props.t;
  const cur = props.current;
  const trashed = cur.trashed;
  return (
    <div className="border-b theme-border px-4 py-2.5 flex items-center justify-between gap-2 backdrop-blur">
      <div className="flex items-center gap-2 min-w-0">
        <ModeBadge readOnly={trashed || props.readMode} trashed={trashed} t={t} />
        <div className="text-xs theme-muted truncate">
          {t('editor.updated', { date: props.updated })}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {settings.enableReadMode && !trashed && (
          <HeaderBtn title={props.readMode ? t('editor.editMode') : t('editor.readMode')} onClick={props.onToggleRead}>
            {props.readMode ? <PenLine size={14} /> : <BookOpen size={14} />}
          </HeaderBtn>
        )}
        {settings.enablePinning && !trashed && (
          <HeaderBtn title={cur.pinned ? t('editor.unpin') : t('editor.pin')} onClick={props.onTogglePin} active={cur.pinned}>
            {cur.pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </HeaderBtn>
        )}
        {settings.enableColorLabels && !trashed && (
          <div className="relative" ref={props.colorRef}>
            <HeaderBtn
              title={t('editor.colorLabel')}
              onClick={() => props.setColorOpen(!props.colorOpen)}
            >
              <span
                className="block w-3.5 h-3.5 rounded-full ring-1 ring-inset ring-current/30"
                style={{ background: props.colorObj?.hex || 'transparent' }}
              />
            </HeaderBtn>
            {props.colorOpen && (
              <div className="absolute top-full mt-1 right-0 theme-popover rounded-lg p-1.5 z-30 grid grid-cols-4 gap-1 shadow-xl">
                {COLORS.map((c) => (
                  <button
                    key={c.id}
                    title={c.name}
                    onClick={() => {
                      props.onSetColor(c.id);
                      props.setColorOpen(false);
                    }}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:scale-110 transition-transform"
                    style={{ background: c.hex || 'transparent', border: c.id ? 'none' : '1px dashed currentColor' }}
                  >
                    {props.colorObj?.id === c.id && (
                      <span className="text-white text-[10px]">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {!trashed && (
          <div className="relative" ref={props.moveRef}>
            <HeaderBtn title={t('editor.moveToNotebook')} onClick={() => props.setMoveOpen(!props.moveOpen)}>
              <span className="text-xs">→</span>
            </HeaderBtn>
            {props.moveOpen && (
              <div className="absolute top-full mt-1 right-0 theme-popover rounded-lg p-1 z-30 min-w-[180px] max-h-72 overflow-y-auto shadow-xl">
                {props.notebooks.map((nb) => (
                  <button
                    key={nb.id}
                    onClick={() => props.onMove(nb.id)}
                    className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-black/5 dark:hover:bg-white/10 ${
                      nb.id === cur.notebookId ? 'theme-accent' : ''
                    }`}
                  >
                    {nb.name === 'Inbox' ? t('seed.notebook.inbox') : nb.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {trashed ? (
          <>
            <HeaderBtn title={t('editor.restore')} onClick={props.onRestore}>
              <RotateCcw size={14} />
            </HeaderBtn>
            <HeaderBtn title={t('editor.deleteForever')} onClick={props.onDelete} danger>
              <Trash2 size={14} />
            </HeaderBtn>
          </>
        ) : (
          <HeaderBtn title={t('editor.moveToTrash')} onClick={props.onTrash}>
            <Trash2 size={14} />
          </HeaderBtn>
        )}
        <div className="relative" ref={props.moreRef}>
          <HeaderBtn title={t('editor.more')} onClick={() => props.setMoreOpen(!props.moreOpen)}>
            <MoreHorizontal size={14} />
          </HeaderBtn>
          {props.moreOpen && (
            <div className="absolute top-full mt-1 right-0 theme-popover rounded-lg p-1 z-30 min-w-[200px] shadow-xl">
              <MenuItem icon={<Copy size={13} />} onClick={() => { props.onDuplicate(); props.setMoreOpen(false); }}>
                {t('editor.duplicate')}
              </MenuItem>
              <MenuItem icon={<span>🔒</span>} onClick={() => { props.onLock(); props.setMoreOpen(false); }}>
                {t('enc.lock')}
              </MenuItem>
              {settings.enableExport && (
                <>
                  <MenuItem icon={<Download size={13} />} onClick={() => props.onExport('md')}>{t('editor.exportMd')}</MenuItem>
                  <MenuItem icon={<Download size={13} />} onClick={() => props.onExport('html')}>{t('editor.exportHtml')}</MenuItem>
                  <MenuItem icon={<Download size={13} />} onClick={() => props.onExport('txt')}>{t('editor.exportTxt')}</MenuItem>
                  <MenuItem icon={<Download size={13} />} onClick={() => props.onExport('json')}>{t('editor.exportJson')}</MenuItem>
                  <MenuItem icon={<Download size={13} />} onClick={async () => {
                    const r = await window.nv.exportPdf(props.current.title || 'Sans titre');
                    if (r.ok) useStore.getState().toast('success', `PDF: ${r.path}`);
                    props.setMoreOpen(false);
                  }}>Exporter en PDF</MenuItem>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeBadge({ readOnly, trashed, t }: { readOnly: boolean; trashed: boolean; t: (k: any, p?: any) => string }) {
  if (trashed) {
    return (
      <span
        className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{ background: 'rgba(239, 68, 68, 0.18)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.5)' }}
      >
        <Trash2 size={10} /> Corbeille
      </span>
    );
  }
  if (readOnly) {
    return (
      <span
        className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.45)' }}
      >
        <BookOpen size={10} /> {t('editor.modeBadgeRead')}
      </span>
    );
  }
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider edit-mode-badge"
      style={{ background: 'rgba(234, 179, 8, 0.18)', color: '#ca8a04', border: '1px solid rgba(234, 179, 8, 0.6)' }}
    >
      <PenLine size={10} /> {t('editor.modeBadgeEdit')}
    </span>
  );
}

function HeaderBtn(props: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      title={props.title}
      className={`p-1.5 rounded-md flex items-center justify-center text-xs transition ${
        props.active ? 'theme-accent-bg theme-text' : props.danger ? 'hover:bg-red-500/15 text-red-400' : 'hover:theme-hover theme-muted hover:theme-text'
      }`}
    >
      {props.children}
    </button>
  );
}

function MenuItem(props: { children: React.ReactNode; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-black/5 dark:hover:bg-white/10 theme-text text-left"
    >
      {props.icon && <span className="theme-muted">{props.icon}</span>}
      <span>{props.children}</span>
    </button>
  );
}

function TagsRow({
  t,
  current,
  tagDraft,
  setTagDraft,
  readOnly,
  onPatch,
}: {
  t: (k: any, p?: any) => string;
  current: any;
  tagDraft: string;
  setTagDraft: (s: string) => void;
  readOnly: boolean;
  onPatch: (p: any) => void;
}) {
  return (
    <div className="flex items-center flex-wrap gap-1.5 mt-2">
      {current.tags.map((tg: string) => (
        <span
          key={tg}
          className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
          style={tagPillStyle(tg)}
        >
          <TagIcon size={10} />#{tg}
          {!readOnly && (
            <button
              onClick={() => onPatch({ tags: current.tags.filter((x: string) => x !== tg) })}
              className="theme-muted hover:theme-text"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <TagPicker
          t={t}
          tagDraft={tagDraft}
          setTagDraft={setTagDraft}
          existingTagsOnNote={current.tags}
          onAdd={(tag) => onPatch({ tags: [...current.tags, tag] })}
        />
      )}
    </div>
  );
}

function TagPicker({
  t,
  tagDraft,
  setTagDraft,
  existingTagsOnNote,
  onAdd,
}: {
  t: (k: any, p?: any) => string;
  tagDraft: string;
  setTagDraft: (s: string) => void;
  existingTagsOnNote: string[];
  onAdd: (tag: string) => void;
}) {
  const knownTags = useTagRegistry((s) => s.knownTags);
  const indexNotes = useStore((s) => s.index.notes);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Build the universe of selectable tags: registry + tags currently used on
  // any note. Filter out tags already on this note so we don't suggest dupes.
  const universe = useMemo(() => {
    const set = new Set<string>(knownTags);
    for (const n of indexNotes) if (!n.trashed) for (const tg of n.tags) set.add(tg);
    return Array.from(set).filter((tg) => !existingTagsOnNote.includes(tg)).sort((a, b) => a.localeCompare(b));
  }, [knownTags, indexNotes, existingTagsOnNote]);

  const draft = tagDraft.trim().replace(/^#/, '');
  const lower = draft.toLowerCase();
  const filtered = useMemo(
    () => (draft ? universe.filter((tg) => tg.toLowerCase().includes(lower)) : universe).slice(0, 10),
    [universe, draft, lower],
  );
  const exactMatch = !!draft && universe.some((tg) => tg.toLowerCase() === lower);
  const showCreate = !!draft && !exactMatch && !existingTagsOnNote.includes(draft);
  const totalRows = filtered.length + (showCreate ? 1 : 0);

  useEffect(() => { setHighlight(0); }, [tagDraft, open]);

  // Click-outside → close
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function commit(tag: string) {
    const v = tag.trim().replace(/^#/, '');
    if (!v) return;
    if (!existingTagsOnNote.includes(v)) onAdd(v);
    setTagDraft('');
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(totalRows - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (open && totalRows > 0 && highlight < filtered.length) {
        commit(filtered[highlight]);
      } else if (showCreate) {
        commit(draft);
      } else if (draft) {
        // Plain creation when no list — fallback for users who never opened the dropdown
        commit(draft);
      }
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={tagDraft}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setTagDraft(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder={t('editor.addTag')}
        className="text-xs bg-transparent outline-none theme-text placeholder:theme-muted w-44 min-w-[10rem] focus:w-56 transition-[width] px-1.5 py-0.5 rounded border border-transparent hover:theme-border-soft focus:theme-border"
      />
      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute left-0 top-full mt-1 z-30 theme-popover rounded-lg shadow-2xl border theme-border min-w-[14rem] max-h-72 overflow-y-auto py-1">
          {filtered.map((tg, i) => (
            <button
              key={tg}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); commit(tg); }}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${
                i === highlight ? 'theme-hover' : ''
              }`}
            >
              <span className="px-1.5 py-0.5 rounded font-medium" style={tagPillStyle(tg)}>#{tg}</span>
            </button>
          ))}
          {showCreate && (
            <>
              {filtered.length > 0 && <div className="my-1 border-t theme-border-soft" />}
              <button
                onMouseEnter={() => setHighlight(filtered.length)}
                onMouseDown={(e) => { e.preventDefault(); commit(draft); }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 theme-text ${
                  highlight === filtered.length ? 'theme-hover' : ''
                }`}
              >
                <span className="theme-accent text-sm leading-none">+</span>
                <span>Créer la nouvelle étiquette <span className="font-semibold">#{draft}</span></span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor, settings, t }: { editor: TiptapEditor; settings: any; t: (k: any, p?: any) => string }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  if (!editor) return null;

  const Btn = ({
    onClick,
    active,
    title,
    children,
    disabled,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded-md transition disabled:opacity-30 ${
        active ? 'theme-accent-bg theme-text' : 'theme-muted hover:theme-hover hover:theme-text'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className={`${editorWidthClass(settings.editorWidth)} flex items-center flex-wrap gap-0.5 py-2 border-b theme-border-soft sticky top-0 theme-bg z-10`}>
      {settings.enableHeadings && (
        <>
          <Btn title={t('tb.h1')} active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 size={16} />
          </Btn>
          <Btn title={t('tb.h2')} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={16} />
          </Btn>
          <Btn title={t('tb.h3')} active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 size={16} />
          </Btn>
          <Sep />
        </>
      )}
      <Btn title={t('tb.bold')} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={16} />
      </Btn>
      <Btn title={t('tb.italic')} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={16} />
      </Btn>
      {settings.enableUnderline && (
        <Btn title={t('tb.underline')} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={16} />
        </Btn>
      )}
      <Btn title={t('tb.strike')} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={16} />
      </Btn>
      <Btn title={t('tb.code')} active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code size={16} />
      </Btn>
      {settings.enableHighlight && (
        <Btn title={t('tb.highlight')} active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <Highlighter size={16} />
        </Btn>
      )}
      <Sep />
      {settings.enableLists && (
        <>
          <Btn title={t('tb.bullet')} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={16} />
          </Btn>
          <Btn title={t('tb.ordered')} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={16} />
          </Btn>
        </>
      )}
      {settings.enableTaskLists && (
        <Btn title={t('tb.task')} active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <CheckSquare size={16} />
        </Btn>
      )}
      {settings.enableBlockquote && (
        <Btn title={t('tb.quote')} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={16} />
        </Btn>
      )}
      {settings.enableCodeBlock && (
        <Btn title={t('tb.codeBlock')} active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code size={16} />
        </Btn>
      )}
      {settings.enableHorizontalRule && (
        <Btn title={t('tb.hr')} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus size={16} />
        </Btn>
      )}
      <Sep />
      {settings.enableTextAlign && (
        <>
          <Btn title={t('tb.alignLeft')} active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
            <AlignLeft size={16} />
          </Btn>
          <Btn title={t('tb.alignCenter')} active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
            <AlignCenter size={16} />
          </Btn>
          <Btn title={t('tb.alignRight')} active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
            <AlignRight size={16} />
          </Btn>
          <Sep />
        </>
      )}
      {settings.enableLinks && (
        <div className="relative">
          <Btn
            title={t('tb.link')}
            active={editor.isActive('link')}
            onClick={() => {
              const prev = editor.getAttributes('link').href as string | undefined;
              setLinkUrl(prev ?? 'https://');
              setLinkOpen(true);
            }}
          >
            <LinkIcon size={16} />
          </Btn>
          {linkOpen && (
            <div className="absolute top-full mt-1 left-0 theme-popover rounded-lg p-2 z-20 flex gap-1 shadow-xl">
              <input
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (linkUrl) editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
                    else editor.chain().focus().extendMarkRange('link').unsetLink().run();
                    setLinkOpen(false);
                  } else if (e.key === 'Escape') setLinkOpen(false);
                }}
                className="theme-input rounded px-2 py-1 text-sm w-64 outline-none"
              />
            </div>
          )}
        </div>
      )}
      {settings.enableImages && (
        <Btn
          title={t('tb.image')}
          onClick={() => {
            const url = window.prompt(t('editor.imageUrl'));
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}
        >
          <ImageIcon size={16} />
        </Btn>
      )}
      {settings.enableTables && (
        <Btn
          title={t('tb.table')}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon size={16} />
        </Btn>
      )}
      <Sep />
      <Btn
        title={t('audio.record')}
        onClick={() => (window as any).__openAudioRecorder?.()}
      >
        <Mic size={16} />
      </Btn>
      <Btn
        title={t('ocr.run')}
        onClick={async () => {
          // Find a selected image's src or the most recent image in the doc
          const json = editor.getJSON();
          const src = findFirstImageSrc(json);
          if (!src) { useStore.getState().toast('info', '—'); return; }
          useStore.getState().toast('info', t('ocr.running'));
          try {
            const text = await ocrImage(src);
            if (text) {
              editor.chain().focus().insertContent({
                type: 'paragraph',
                content: [{ type: 'text', text }],
              }).run();
              useStore.getState().toast('success', t('ocr.done'));
            }
          } catch (e: any) {
            useStore.getState().toast('error', t('ocr.error') + ': ' + (e?.message ?? ''));
          }
        }}
      >
        <Eye size={16} />
      </Btn>
    </div>
  );
}

function findFirstImageSrc(node: any): string | null {
  if (!node) return null;
  if (node.type === 'image' && node.attrs?.src) return node.attrs.src as string;
  if (Array.isArray(node.content)) {
    for (const c of node.content) {
      const r = findFirstImageSrc(c);
      if (r) return r;
    }
  }
  return null;
}

function Sep() {
  return <div className="w-px h-5 theme-border mx-1" />;
}

function EmptyState() {
  const newNote = useStore((s) => s.newNote);
  const t = useTHook();
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent || '');
  const modKey = isMac ? '⌘' : 'Ctrl';
  return (
    <div className="flex-1 flex items-center justify-center theme-muted theme-bg">
      <div className="text-center max-w-sm">
        <p className="text-2xl theme-text font-semibold">{t('app.welcome.title')}</p>
        <p className="text-sm mt-2">{t('app.welcome.sub')}</p>
        <button
          onClick={() => void newNote()}
          className="mt-6 px-4 py-2 rounded-lg theme-accent-bg text-white font-medium text-sm hover:opacity-90 shadow-md transition"
        >
          {t('app.welcome.cta')}
        </button>
        <p className="text-xs mt-3 theme-muted">{t('app.welcome.hint')} <kbd className="theme-kbd">{modKey}+N</kbd></p>
      </div>
    </div>
  );
}

export function safeParse(json: string): object {
  try {
    return JSON.parse(json);
  } catch {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
}

export function editorWidthClass(w: 'narrow' | 'wide' | 'full') {
  if (w === 'narrow') return 'max-w-2xl w-full mx-auto px-8';
  if (w === 'full') return 'w-full mx-auto px-10';
  return 'max-w-3xl w-full mx-auto px-10';
}

export function fontFamilyCss(f: 'sans' | 'serif' | 'mono') {
  if (f === 'serif') return '"Iowan Old Style", "Apple Garamond", Baskerville, "Times New Roman", serif';
  if (f === 'mono') return 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace';
  return 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
}

function wrappedHtml(title: string, body: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Inter,system-ui,sans-serif;max-width:780px;margin:2rem auto;padding:0 1.5rem;color:#111;line-height:1.65}h1{margin-top:0}pre{background:#f3f4f6;padding:1em;border-radius:6px;overflow:auto}code{font-family:ui-monospace,SFMono-Regular,monospace;background:#f3f4f6;padding:.1em .35em;border-radius:4px}table{border-collapse:collapse}td,th{border:1px solid #d1d5db;padding:.4em .6em}blockquote{border-left:3px solid #d1d5db;color:#6b7280;padding-left:1em;margin:.8em 0}</style>
</head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
