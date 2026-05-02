import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Block-level math via KaTeX. */
export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      tex: { default: 'a^2 + b^2 = c^2' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-math]', getAttrs: (el: any) => ({ tex: el.getAttribute('data-tex') || '' }) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math': 'true', 'data-tex': HTMLAttributes.tex })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathView);
  },
});

function MathView({ node, updateAttributes, editor }: any) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.attrs.tex);
  const html = (() => {
    try {
      return katex.renderToString(node.attrs.tex || '', { displayMode: true, throwOnError: false });
    } catch {
      return `<span style="color:#ef4444">⚠ ${escapeHtml(node.attrs.tex)}</span>`;
    }
  })();
  return (
    <NodeViewWrapper className="my-3">
      {editing ? (
        <div className="theme-card-soft border theme-border-soft rounded p-2 flex flex-col gap-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { updateAttributes({ tex: draft }); setEditing(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDraft(node.attrs.tex); setEditing(false); }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { updateAttributes({ tex: draft }); setEditing(false); }
            }}
            className="w-full theme-input rounded p-2 text-xs font-mono"
            rows={3}
            placeholder="\\frac{a}{b}, \\sum, …"
          />
          <div className="text-[10px] theme-muted">Echap pour annuler · Ctrl+Entrée pour valider</div>
        </div>
      ) : (
        <div
          onClick={() => editor.isEditable && setEditing(true)}
          className="cursor-pointer text-center py-2 hover:theme-hover rounded"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </NodeViewWrapper>
  );
}

/** Block-level Mermaid diagram. */
export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { code: { default: 'graph TD;\n  A-->B;\n  A-->C;' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-mermaid]', getAttrs: (el: any) => ({ code: el.textContent || '' }) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-mermaid': 'true' }), HTMLAttributes.code];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MermaidView);
  },
});

function MermaidView({ node, updateAttributes, editor }: any) {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.attrs.code);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
      try {
        const id = 'm' + Math.random().toString(36).slice(2);
        const { svg } = await mermaid.render(id, node.attrs.code);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Erreur Mermaid');
      }
    })();
    return () => { cancelled = true; };
  }, [node.attrs.code]);

  return (
    <NodeViewWrapper className="my-3">
      {editing ? (
        <div className="theme-card-soft border theme-border-soft rounded p-2 flex flex-col gap-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { updateAttributes({ code: draft }); setEditing(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDraft(node.attrs.code); setEditing(false); }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { updateAttributes({ code: draft }); setEditing(false); }
            }}
            className="w-full theme-input rounded p-2 text-xs font-mono"
            rows={6}
          />
          <div className="text-[10px] theme-muted">Echap pour annuler · Ctrl+Entrée pour valider</div>
        </div>
      ) : (
        <div
          onClick={() => editor.isEditable && setEditing(true)}
          className="cursor-pointer p-3 hover:theme-hover rounded text-center"
        >
          {error ? <span className="text-red-500 text-xs">{error}</span> : <div ref={ref} />}
        </div>
      )}
    </NodeViewWrapper>
  );
}

/** Inline attachment chip referencing a stored file. */
export const AttachmentNode = Node.create({
  name: 'attachment',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      attachmentId: { default: '' },
      filename: { default: '' },
      mime: { default: '' },
      size: { default: 0 },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-attachment]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-attachment': 'true' }), `📎 ${HTMLAttributes.filename}`];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AttachmentView);
  },
});

function AttachmentView({ node }: any) {
  const { attachmentId, filename, mime, size } = node.attrs;
  const noteId = (window as any).__feverCurrentNoteId as string | undefined;
  return (
    <NodeViewWrapper as="span" className="inline-flex items-center gap-1.5 px-2 py-1 mx-0.5 my-0.5 rounded theme-pill text-xs cursor-pointer hover:theme-hover" onClick={() => {
      if (noteId) void window.nv.openAttachment(noteId, attachmentId, filename);
    }}>
      <span>📎</span>
      <span className="font-medium">{filename}</span>
      <span className="opacity-60">{formatBytes(size)}</span>
    </NodeViewWrapper>
  );
}

function formatBytes(n: number) {
  if (!n) return '';
  if (n < 1024) return `${n}o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}Ko`;
  return `${(n / 1024 / 1024).toFixed(1)}Mo`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
