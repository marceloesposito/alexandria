// Insieme delle estensioni dell'editor. Ogni nodo ha un corrispettivo in src/doc (Markdown).
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { t } from '../../i18n';
import {
  Figure,
  MathBlock,
  MathInline,
  Footnote,
  Citation,
  Wikilink,
  PageBreak,
  SectionBreak,
  Toc,
  Bibliography,
} from './nodes';
import { SlashCommands } from '../slash';
import { DropHandler } from './drop';
import { SearchHighlight } from '../search';
import { CommentAnchors } from '../../comments/plugin';
import { MarkdownShortcuts } from './inputRules';

/** Tabella con l'allineamento delle colonne del Markdown (GFM). */
const AlignedTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: { default: [], rendered: false },
    };
  },
});

export function buildExtensions() {
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
    Highlight,
    Subscript.extend({ addKeyboardShortcuts: () => ({}) }),
    Superscript,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === 'heading' ? t('editor.placeholder.heading') : t('editor.placeholder.paragraph')),
      showOnlyCurrent: true,
    }),
    Figure,
    MathBlock,
    MathInline,
    Footnote,
    Citation,
    Wikilink,
    PageBreak,
    SectionBreak,
    Toc,
    Bibliography,
    SlashCommands,
    DropHandler,
    SearchHighlight,
    CommentAnchors,
    MarkdownShortcuts,
  ];
}
