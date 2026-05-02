import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { t } from './i18n';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { Extension } from '@tiptap/core';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import CharacterCount from '@tiptap/extension-character-count';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { MathBlock, MermaidBlock, AttachmentNode } from './editorNodes';
import { WikiLink } from './wikiLink';
import type { Extensions } from '@tiptap/react';
import type { Settings } from './settings';

const lowlight = createLowlight(common);

/** Custom extension adding `setFontSize`/`unsetFontSize` commands on top of textStyle. */
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] as string[] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => (el as HTMLElement).style.fontSize?.replace(/['"]/g, '') || null,
          renderHTML: (attrs) => {
            if (!attrs.fontSize) return {};
            return { style: `font-size: ${attrs.fontSize}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

export function buildExtensions(s: Settings): Extensions {
  const exts: Extensions = [
    StarterKit.configure({
      heading: s.enableHeadings ? { levels: [1, 2, 3] } : false,
      bulletList: s.enableLists ? {} : false,
      orderedList: s.enableLists ? {} : false,
      blockquote: s.enableBlockquote ? {} : false,
      horizontalRule: s.enableHorizontalRule ? {} : false,
      codeBlock: s.enableCodeBlock && !s.enableSyntaxHighlight ? {} : false,
    }),
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === 'heading' ? t('editor.headingPlaceholder') : t('editor.placeholder'),
    }),
    CharacterCount.configure({}),
  ];

  if (s.enableLinks) {
    exts.push(
      Link.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: { rel: 'noopener', target: '_blank' },
      }),
    );
  }
  if (s.enableTaskLists) {
    exts.push(TaskList, TaskItem.configure({ nested: true }));
  }
  if (s.enableUnderline) exts.push(Underline);
  if (s.enableHighlight) exts.push(Highlight.configure({ multicolor: true }));
  // Always push TextStyle (needed by Color, FontFamily and FontSize commands)
  exts.push(TextStyle);
  if (s.enableTextColor) exts.push(Color);
  // Always-on rich-toolbar nodes: font family + size + sup/sub
  exts.push(FontFamily, FontSize, Superscript, Subscript);
  if (s.enableTextAlign) {
    exts.push(TextAlign.configure({ types: ['heading', 'paragraph'] }));
  }
  if (s.enableTypography) exts.push(Typography);
  if (s.enableImages) {
    exts.push(Image.configure({ inline: false, allowBase64: true }));
  }
  if (s.enableTables) {
    exts.push(
      Table.configure({ resizable: true, HTMLAttributes: { class: 'nv-table' } }),
      TableRow,
      TableHeader,
      TableCell,
    );
  }
  if (s.enableSyntaxHighlight && s.enableCodeBlock) {
    exts.push(CodeBlockLowlight.configure({ lowlight }));
  }
  // Always-on custom nodes (Math, Mermaid, Attachments)
  exts.push(MathBlock, MermaidBlock, AttachmentNode);
  if (s.enableWikiLinks) exts.push(WikiLink);
  return exts;
}
