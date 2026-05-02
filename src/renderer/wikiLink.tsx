import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useStore } from './store';

/**
 * Inline `[[Note title]]` wiki-link. Typing `[[Foo]]` (with the closing
 * brackets) auto-converts to a chip that resolves to a note by title;
 * clicking opens it, or creates one on the fly if missing.
 *
 * The node renders back to the literal `[[Foo]]` syntax in plain text so the
 * search index, exports and the backlinks scanner all see it as plain
 * markdown-style wiki link.
 */
export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      title: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-wiki-link]',
        getAttrs: (el: any) => ({
          title: (el as HTMLElement).getAttribute('data-title') || (el as HTMLElement).textContent || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-link': 'true',
        'data-title': HTMLAttributes.title,
        class: 'wiki-link',
        href: '#',
      }),
      `[[${HTMLAttributes.title}]]`,
    ];
  },

  // Critical: makes editor.getText() emit `[[Foo]]` so search and the
  // backlinks scanner can see the link in the plain text field.
  renderText({ node }) {
    return `[[${node.attrs.title}]]`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkView);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^\]\n]+)\]\]$/,
        handler: ({ state, range, match }) => {
          const title = match[1].trim();
          if (!title) return null;
          state.tr.replaceWith(range.from, range.to, this.type.create({ title }));
          return;
        },
      }),
    ];
  },
});

function WikiLinkView({ node }: any) {
  const title = node.attrs.title as string;
  const notes = useStore((s) => s.index.notes);
  const target = notes.find(
    (n) => !n.trashed && (n.title || '').toLowerCase() === title.toLowerCase(),
  );
  const exists = !!target;

  async function open(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (target) {
      await useStore.getState().selectNote(target.id);
      useStore.getState().openTab(target.id);
      return;
    }
    // Create a missing note on click — same notebook as the current view, or fallback.
    const view = useStore.getState().view;
    const idx = useStore.getState().index;
    const nbId = view.kind === 'notebook' ? view.id : (idx.notebooks[0]?.id ?? 'inbox');
    const created = await window.nv.createNote(nbId, { title });
    await useStore.getState().refresh();
    await useStore.getState().selectNote(created.id);
    useStore.getState().openTab(created.id);
  }

  return (
    <NodeViewWrapper
      as="span"
      className={`wiki-link-chip ${exists ? 'wiki-exists' : 'wiki-missing'}`}
      onClick={open}
      contentEditable={false}
      title={exists ? `Ouvrir « ${title} »` : `Créer la note « ${title} »`}
    >
      <span className="wiki-bracket">[[</span>
      <span className="wiki-title">{title}</span>
      <span className="wiki-bracket">]]</span>
    </NodeViewWrapper>
  );
}

/**
 * Extract every `[[…]]` target from a note's plain-text body. Case-preserving
 * — backlink resolution is done case-insensitively at query time.
 */
export function extractWikiTargets(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /\[\[([^\]\n]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  return out;
}
