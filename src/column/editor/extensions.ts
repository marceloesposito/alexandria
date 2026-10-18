// Estensioni dell'editor del foglio. Lo schema accetta tutto il Markdown di logos; i comandi e le
// viste sono quelli di Column (barretta, "/", clic destro).
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { getSchema, type AnyExtension } from '@tiptap/core';
import { ColorHighlight, TextColorMark } from './colors';
import { CommentAnchors } from '../comments/anchors';
import { t } from '../../i18n';
import { Bibliography, Callout, Citation, Embed, Figure, Footnote, MathBlock, MathInline, PageBreak, ParagraphStyle, SectionBreak, Toc, Wikilink } from './nodes';

/** Tabella con l'allineamento delle colonne del Markdown (GFM). */
const AlignedTable = Table.extend({
  addAttributes() {
    return { ...this.parent?.(), align: { default: [], rendered: false } };
  },
});

/** Estensioni che definiscono il documento (anche fuori dall'editor: import, test). */
export function schemaExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noreferrer', target: null } },
      codeBlock: { HTMLAttributes: { spellcheck: 'false' } },
      dropcursor: { width: 2, color: 'var(--accent)' },
    }),
    AlignedTable.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ColorHighlight,
    TextColorMark,
    Subscript.extend({ addKeyboardShortcuts: () => ({}) }),
    Superscript,
    TaskList,
    TaskItem.configure({ nested: true }),
    Figure,
    Embed,
    MathBlock,
    MathInline,
    Footnote,
    Citation,
    Wikilink,
    PageBreak,
    SectionBreak,
    Toc,
    Bibliography,
    Callout,
    ParagraphStyle,
  ];
}

export function editorExtensions(extra: AnyExtension[] = []): AnyExtension[] {
  return [
    ...schemaExtensions(),
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === 'heading' ? t('editor.placeholder.heading') : t('editor.placeholder.paragraph')),
      showOnlyCurrent: true,
    }),
    CommentAnchors,
    ...extra,
  ];
}

export const columnSchema = () => getSchema(schemaExtensions());
