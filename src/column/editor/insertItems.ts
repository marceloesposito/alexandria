// Cosa si puo' inserire nel foglio: lo stesso elenco per il menu "+" della barretta e per "/".
import type { Editor } from '@tiptap/core';
import { Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Quote, Code2, Minus, Table, Image, Link, Footprints, Pilcrow } from 'lucide-react';
import { platform } from '../../platform';
import { useColumn } from '../store';
import { promptDialog } from '../../components/confirm';
import { t } from '../../i18n';

export interface InsertItem {
  id: string;
  label: string;
  keywords: string;
  icon: React.ComponentType<{ size?: number }>;
  /** blocchi di testo: nel menu "+" stanno sotto Stile, qui solo per "/" */
  block?: boolean;
  run: (editor: Editor) => void;
}

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

/** Sceglie immagini dal disco e le mette nel foglio, nel punto del cursore. */
export async function pickImages(editor: Editor) {
  const paths = await platform.pickFiles(t('insert.pickImage'), IMAGE_EXTS);
  for (const p of paths) {
    const data = await platform.readBytes(p);
    const src = useColumn.getState().addMedia(p.slice(p.lastIndexOf('/') + 1), data);
    editor.chain().focus().insertContent({ type: 'figure', attrs: { src, caption: '' } }).run();
  }
}

/** Chiede l'indirizzo e fa (o toglie) il link sulla selezione. */
export async function editLink(editor: Editor) {
  const prev = String(editor.getAttributes('link').href ?? '');
  const href = await promptDialog(t('link.title'), prev, t('link.hint'));
  if (href === null) return;
  const chain = editor.chain().focus().extendMarkRange('link');
  if (!href.trim()) chain.unsetLink().run();
  else if (editor.state.selection.empty && !prev) {
    editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
  } else chain.setLink({ href: href.trim() }).run();
}

export function insertItems(): InsertItem[] {
  return [
    { id: 'p', label: t('style.body'), keywords: 'text testo paragrafo body corpo', icon: Pilcrow, block: true, run: (e) => e.chain().focus().setParagraph().run() },
    { id: 'h1', label: t('style.h1'), keywords: 'heading titolo h1', icon: Heading1, block: true, run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
    { id: 'h2', label: t('style.h2'), keywords: 'heading titolo h2', icon: Heading2, block: true, run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
    { id: 'h3', label: t('style.h3'), keywords: 'heading titolo h3', icon: Heading3, block: true, run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
    { id: 'quote', label: t('style.quote'), keywords: 'blockquote citazione quote', icon: Quote, block: true, run: (e) => e.chain().focus().toggleBlockquote().run() },
    { id: 'code', label: t('style.code'), keywords: 'code codice', icon: Code2, block: true, run: (e) => e.chain().focus().toggleCodeBlock().run() },
    { id: 'ul', label: t('insert.bullet'), keywords: 'list elenco puntato bullet', icon: List, run: (e) => e.chain().focus().toggleBulletList().run() },
    { id: 'ol', label: t('insert.ordered'), keywords: 'list elenco numerato ordered', icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run() },
    { id: 'task', label: t('insert.task'), keywords: 'todo checklist attivita task', icon: ListChecks, run: (e) => e.chain().focus().toggleTaskList().run() },
    { id: 'table', label: t('insert.table'), keywords: 'table tabella', icon: Table, run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: 'image', label: t('insert.image'), keywords: 'image immagine figura foto', icon: Image, run: (e) => void pickImages(e) },
    { id: 'link', label: t('insert.link'), keywords: 'link collegamento url', icon: Link, run: (e) => void editLink(e) },
    { id: 'footnote', label: t('insert.footnote'), keywords: 'note nota footnote piede', icon: Footprints, run: (e) => e.chain().focus().insertFootnote('').run() },
    { id: 'hr', label: t('insert.divider'), keywords: 'divider separatore linea', icon: Minus, run: (e) => e.chain().focus().setHorizontalRule().run() },
  ];
}
