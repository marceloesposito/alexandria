// Comandi dell'editor: modifica, inserimento, formato.
import {
  Undo2,
  Redo2,
  Scissors,
  Copy,
  ClipboardPaste,
  ClipboardType,
  TextSelect,
  Search,
  Replace,
  ListOrdered,
  List,
  ListChecks,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Quote,
  Code2,
  Minus,
  Sigma,
  Table,
  Footprints,
  SeparatorHorizontal,
  ListTree,
  Link2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  Subscript,
  Superscript,
  RemoveFormatting,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  IndentIncrease,
  IndentDecrease,
  Hash,
  BetweenHorizontalStart,
  Columns2,
  FileSymlink,
  TableRowsSplit,
  TableColumnsSplit,
  Trash2,
} from 'lucide-react';
import { registerCommands } from './registry';
import { getEditor } from '../state/editorRef';
import { useDoc } from '../editor/session';
import { ws } from '../state/workspace';
import { t } from '../i18n';
import { promptDialog } from '../components/confirm';
import { getSourceView } from '../editor/SourceView';
import { undo as cmUndo, redo as cmRedo } from '@codemirror/commands';

const E = () => getEditor();
const inEditor = () => !!E() && !useDoc.getState().sourceMode && ws().app.view === 'editor';
const chain = () => E()!.chain().focus();
const active = (name: string, attrs?: Record<string, unknown>) => () => !!E()?.isActive(name, attrs);

export function registerEditorCommands() {
  registerCommands([
    // ----- modifica
    {
      id: 'edit.undo',
      label: 'cmd.edit.undo',
      icon: Undo2,
      shortcut: 'Mod+Z',
      editorShortcut: true,
      category: 'edit',
      isEnabled: () => (useDoc.getState().sourceMode ? true : !!E()?.can().undo()),
      run: () => {
        const sv = getSourceView();
        if (useDoc.getState().sourceMode && sv) cmUndo(sv);
        else chain().undo().run();
      },
    },
    {
      id: 'edit.redo',
      label: 'cmd.edit.redo',
      icon: Redo2,
      shortcut: 'Mod+Shift+Z',
      editorShortcut: true,
      category: 'edit',
      isEnabled: () => (useDoc.getState().sourceMode ? true : !!E()?.can().redo()),
      run: () => {
        const sv = getSourceView();
        if (useDoc.getState().sourceMode && sv) cmRedo(sv);
        else chain().redo().run();
      },
    },
    {
      id: 'edit.cut',
      label: 'cmd.edit.cut',
      icon: Scissors,
      category: 'edit',
      run: async () => {
        const e = E();
        if (!e) return;
        const { from, to } = e.state.selection;
        await navigator.clipboard.writeText(e.state.doc.textBetween(from, to, '\n'));
        chain().deleteSelection().run();
      },
    },
    {
      id: 'edit.copy',
      label: 'cmd.edit.copy',
      icon: Copy,
      category: 'edit',
      run: async () => {
        const e = E();
        if (!e) return;
        const { from, to } = e.state.selection;
        await navigator.clipboard.writeText(e.state.doc.textBetween(from, to, '\n'));
      },
    },
    {
      id: 'edit.paste',
      label: 'cmd.edit.paste',
      icon: ClipboardPaste,
      category: 'edit',
      run: async () => {
        const text = await navigator.clipboard.readText();
        if (text) E()?.chain().focus().insertContent(text).run();
      },
    },
    {
      id: 'edit.pastePlain',
      label: 'cmd.edit.pastePlain',
      icon: ClipboardType,
      shortcut: 'Mod+Shift+V',
      category: 'edit',
      run: async () => {
        const text = await navigator.clipboard.readText();
        const e = E();
        if (text && e) e.chain().focus().command(({ tr }) => {
          tr.insertText(text);
          return true;
        }).run();
      },
    },
    { id: 'edit.selectAll', label: 'cmd.edit.selectAll', icon: TextSelect, category: 'edit', run: () => chain().selectAll().run() },
    { id: 'edit.find', label: 'cmd.edit.find', icon: Search, shortcut: 'Mod+F', category: 'edit', views: ['editor'], run: () => ws().openDialog('findReplace', { replace: false }) },
    { id: 'edit.replace', label: 'cmd.edit.replace', icon: Replace, shortcut: 'Mod+H', category: 'edit', views: ['editor'], run: () => ws().openDialog('findReplace', { replace: true }) },
    { id: 'edit.goToLine', label: 'cmd.edit.goToLine', icon: Hash, shortcut: 'Mod+G', category: 'edit', views: ['editor'], run: () => ws().openDialog('goToLine') },

    // ----- inserisci
    { id: 'insert.paragraph', label: 'cmd.insert.paragraph', icon: Pilcrow, shortcut: 'Mod+Alt+0', category: 'insert', views: ['editor'], isActive: active('paragraph'), run: () => chain().setParagraph().run() },
    { id: 'insert.h1', label: 'cmd.insert.h1', icon: Heading1, shortcut: 'Mod+Alt+1', category: 'insert', views: ['editor'], isActive: active('heading', { level: 1 }), run: () => chain().toggleHeading({ level: 1 }).run() },
    { id: 'insert.h2', label: 'cmd.insert.h2', icon: Heading2, shortcut: 'Mod+Alt+2', category: 'insert', views: ['editor'], isActive: active('heading', { level: 2 }), run: () => chain().toggleHeading({ level: 2 }).run() },
    { id: 'insert.h3', label: 'cmd.insert.h3', icon: Heading3, shortcut: 'Mod+Alt+3', category: 'insert', views: ['editor'], isActive: active('heading', { level: 3 }), run: () => chain().toggleHeading({ level: 3 }).run() },
    { id: 'insert.bulletList', label: 'cmd.insert.bulletList', icon: List, shortcut: 'Mod+Shift+8', category: 'insert', views: ['editor'], isActive: active('bulletList'), run: () => chain().toggleBulletList().run() },
    { id: 'insert.orderedList', label: 'cmd.insert.orderedList', icon: ListOrdered, shortcut: 'Mod+Shift+7', category: 'insert', views: ['editor'], isActive: active('orderedList'), run: () => chain().toggleOrderedList().run() },
    { id: 'insert.taskList', label: 'cmd.insert.taskList', icon: ListChecks, shortcut: 'Mod+Shift+9', category: 'insert', views: ['editor'], isActive: active('taskList'), run: () => chain().toggleTaskList().run() },
    { id: 'insert.quote', label: 'cmd.insert.quote', icon: Quote, shortcut: 'Mod+Shift+B', category: 'insert', views: ['editor'], isActive: active('blockquote'), run: () => chain().toggleBlockquote().run() },
    { id: 'insert.codeBlock', label: 'cmd.insert.codeBlock', icon: Code2, shortcut: 'Mod+Alt+C', category: 'insert', views: ['editor'], isActive: active('codeBlock'), run: () => chain().toggleCodeBlock().run() },
    { id: 'insert.hr', label: 'cmd.insert.hr', icon: Minus, category: 'insert', views: ['editor'], run: () => chain().setHorizontalRule().run() },
    { id: 'insert.math', label: 'cmd.insert.math', icon: Sigma, shortcut: 'Mod+Shift+M', category: 'insert', views: ['editor'], run: () => chain().insertMathBlock('').run() },
    { id: 'insert.mathInline', label: 'cmd.insert.mathInline', icon: Sigma, shortcut: 'Mod+M', category: 'insert', views: ['editor'], run: () => chain().insertMathInline('').run() },
    {
      id: 'insert.table',
      label: 'cmd.insert.table',
      icon: Table,
      category: 'insert',
      views: ['editor'],
      run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    { id: 'table.addRow', label: 'cmd.table.addRow', icon: TableRowsSplit, category: 'insert', views: ['editor'], isEnabled: () => !!E()?.can().addRowAfter(), run: () => chain().addRowAfter().run() },
    { id: 'table.addColumn', label: 'cmd.table.addColumn', icon: TableColumnsSplit, category: 'insert', views: ['editor'], isEnabled: () => !!E()?.can().addColumnAfter(), run: () => chain().addColumnAfter().run() },
    { id: 'table.deleteRow', label: 'cmd.table.deleteRow', icon: Trash2, category: 'insert', views: ['editor'], isEnabled: () => !!E()?.can().deleteRow(), run: () => chain().deleteRow().run() },
    { id: 'table.deleteColumn', label: 'cmd.table.deleteColumn', icon: Trash2, category: 'insert', views: ['editor'], isEnabled: () => !!E()?.can().deleteColumn(), run: () => chain().deleteColumn().run() },
    { id: 'table.delete', label: 'cmd.table.delete', icon: Trash2, category: 'insert', views: ['editor'], isEnabled: () => !!E()?.can().deleteTable(), run: () => chain().deleteTable().run() },
    { id: 'insert.footnote', label: 'cmd.insert.footnote', icon: Footprints, shortcut: 'Mod+Alt+F', category: 'insert', views: ['editor'], run: () => chain().insertFootnote('').run() },
    { id: 'insert.pageBreak', label: 'cmd.insert.pageBreak', icon: SeparatorHorizontal, shortcut: 'Mod+Enter', category: 'insert', views: ['editor'], run: () => chain().insertPageBreak().run() },
    { id: 'insert.sectionBreak', label: 'cmd.insert.sectionBreak', icon: Columns2, category: 'insert', views: ['editor'], run: () => chain().insertSectionBreak({ master: 'body', columns: 1 }).run() },
    { id: 'insert.toc', label: 'cmd.insert.toc', icon: ListTree, category: 'insert', views: ['editor'], run: () => chain().insertToc().run() },
    {
      id: 'insert.link',
      label: 'cmd.insert.link',
      icon: Link2,
      shortcut: 'Mod+K',
      category: 'insert',
      views: ['editor'],
      isActive: active('link'),
      run: async () => {
        const e = E();
        if (!e) return;
        const prev = (e.getAttributes('link').href as string) ?? '';
        const url = await promptDialog(t('editor.link.title'), prev || 'https://', t('editor.link.hint'));
        if (url === null) return;
        if (!url.trim() || url === 'https://') e.chain().focus().extendMarkRange('link').unsetLink().run();
        else e.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
      },
    },
    {
      id: 'insert.wikilink',
      label: 'cmd.insert.wikilink',
      icon: FileSymlink,
      category: 'insert',
      views: ['editor'],
      run: async () => {
        const name = await promptDialog(t('editor.wikilink.title'), '', t('editor.wikilink.hint'));
        if (name?.trim()) chain().insertWikilink(name.trim()).run();
      },
    },

    // ----- formato
    { id: 'fmt.bold', label: 'cmd.fmt.bold', icon: Bold, shortcut: 'Mod+B', editorShortcut: true, category: 'format', views: ['editor'], isActive: active('bold'), run: () => chain().toggleBold().run() },
    { id: 'fmt.italic', label: 'cmd.fmt.italic', icon: Italic, shortcut: 'Mod+I', editorShortcut: true, category: 'format', views: ['editor'], isActive: active('italic'), run: () => chain().toggleItalic().run() },
    { id: 'fmt.underline', label: 'cmd.fmt.underline', icon: Underline, shortcut: 'Mod+U', editorShortcut: true, category: 'format', views: ['editor'], isActive: active('underline'), run: () => chain().toggleUnderline().run() },
    { id: 'fmt.strike', label: 'cmd.fmt.strike', icon: Strikethrough, shortcut: 'Mod+Shift+X', editorShortcut: true, category: 'format', views: ['editor'], isActive: active('strike'), run: () => chain().toggleStrike().run() },
    { id: 'fmt.code', label: 'cmd.fmt.code', icon: Code, shortcut: 'Mod+E', editorShortcut: true, category: 'format', views: ['editor'], isActive: active('code'), run: () => chain().toggleCode().run() },
    { id: 'fmt.highlight', label: 'cmd.fmt.highlight', icon: Highlighter, shortcut: 'Mod+Shift+H', editorShortcut: true, category: 'format', views: ['editor'], isActive: active('highlight'), run: () => chain().toggleHighlight().run() },
    { id: 'fmt.subscript', label: 'cmd.fmt.subscript', icon: Subscript, category: 'format', views: ['editor'], isActive: active('subscript'), run: () => chain().toggleSubscript().run() },
    { id: 'fmt.superscript', label: 'cmd.fmt.superscript', icon: Superscript, shortcut: 'Mod+.', editorShortcut: true, category: 'format', views: ['editor'], isActive: active('superscript'), run: () => chain().toggleSuperscript().run() },
    { id: 'fmt.clear', label: 'cmd.fmt.clear', icon: RemoveFormatting, shortcut: 'Mod+\\', category: 'format', views: ['editor'], run: () => chain().unsetAllMarks().clearNodes().run() },
    { id: 'fmt.alignLeft', label: 'cmd.fmt.alignLeft', icon: AlignLeft, shortcut: 'Mod+Shift+L', editorShortcut: true, category: 'format', views: ['editor'], isActive: () => !!E()?.isActive({ textAlign: 'left' }), run: () => chain().setTextAlign('left').run() },
    { id: 'fmt.alignCenter', label: 'cmd.fmt.alignCenter', icon: AlignCenter, shortcut: 'Mod+Shift+E', editorShortcut: true, category: 'format', views: ['editor'], isActive: () => !!E()?.isActive({ textAlign: 'center' }), run: () => chain().setTextAlign('center').run() },
    { id: 'fmt.alignRight', label: 'cmd.fmt.alignRight', icon: AlignRight, shortcut: 'Mod+Shift+R', editorShortcut: true, category: 'format', views: ['editor'], isActive: () => !!E()?.isActive({ textAlign: 'right' }), run: () => chain().setTextAlign('right').run() },
    { id: 'fmt.alignJustify', label: 'cmd.fmt.alignJustify', icon: AlignJustify, shortcut: 'Mod+Shift+J', editorShortcut: true, category: 'format', views: ['editor'], isActive: () => !!E()?.isActive({ textAlign: 'justify' }), run: () => chain().setTextAlign('justify').run() },
    {
      id: 'fmt.indent',
      label: 'cmd.fmt.indent',
      icon: IndentIncrease,
      category: 'format',
      views: ['editor'],
      isEnabled: () => !!E()?.can().sinkListItem('listItem') || !!E()?.can().sinkListItem('taskItem'),
      run: () => {
        const e = E();
        if (!e) return;
        if (!e.chain().focus().sinkListItem('listItem').run()) e.chain().focus().sinkListItem('taskItem').run();
      },
    },
    {
      id: 'fmt.outdent',
      label: 'cmd.fmt.outdent',
      icon: IndentDecrease,
      category: 'format',
      views: ['editor'],
      isEnabled: () => !!E()?.can().liftListItem('listItem') || !!E()?.can().liftListItem('taskItem'),
      run: () => {
        const e = E();
        if (!e) return;
        if (!e.chain().focus().liftListItem('listItem').run()) e.chain().focus().liftListItem('taskItem').run();
      },
    },
    { id: 'fmt.blockStyle', label: 'cmd.fmt.blockStyle', icon: BetweenHorizontalStart, category: 'format', views: ['editor'], widget: 'blockStyle', run: () => undefined },
  ]);
}

export { inEditor };
