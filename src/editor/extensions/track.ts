// Revisioni tracciate: segni "insertion" e "deletion" (autore e data) e modalità Suggerisci, in cui
// quello che si scrive diventa una proposta e quello che si cancella resta, barrato, finché qualcuno
// accetta o rifiuta. Nel Markdown sono <ins> e <del> con data-author e data-date.
import { Mark, mergeAttributes, Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { Mark as PMMark, Node as PMNode } from '@tiptap/pm/model';
import { create } from 'zustand';

/** Modalità Suggerisci e nome con cui si firmano le revisioni. */
export const useTrack = create<{ suggest: boolean; author: string; set(p: Partial<{ suggest: boolean; author: string }>): void }>((set) => ({
  suggest: false,
  author: '',
  set: (p) => set(p),
}));

const trackAttrs = {
  author: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('data-author'), renderHTML: (a: Record<string, unknown>) => (a.author ? { 'data-author': a.author } : {}) },
  date: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('data-date'), renderHTML: (a: Record<string, unknown>) => (a.date ? { 'data-date': a.date } : {}) },
};

const tip = (m: Record<string, unknown>, verb: string) => [m.author, verb, m.date].filter(Boolean).join(' · ');

export const Insertion = Mark.create({
  name: 'insertion',
  inclusive: false,
  excludes: 'deletion',
  addAttributes: () => trackAttrs,
  parseHTML: () => [{ tag: 'ins' }],
  renderHTML: ({ HTMLAttributes, mark }) => ['ins', mergeAttributes(HTMLAttributes, { class: 'track-ins', title: tip(mark.attrs, '+') }), 0],
});

export const Deletion = Mark.create({
  name: 'deletion',
  inclusive: false,
  excludes: 'insertion',
  addAttributes: () => trackAttrs,
  parseHTML: () => [{ tag: 'del' }],
  renderHTML: ({ HTMLAttributes, mark }) => ['del', mergeAttributes(HTMLAttributes, { class: 'track-del', title: tip(mark.attrs, '−') }), 0],
});

const today = () => new Date().toISOString().slice(0, 10);

function attrs() {
  const { author } = useTrack.getState();
  return { author: author || null, date: today() };
}

/** Marca come cancellato un intervallo; il testo proposto dallo stesso autore sparisce davvero. */
function markDeleted(tr: Transaction, state: EditorState, from: number, to: number) {
  const ins = state.schema.marks.insertion;
  const del = state.schema.marks.deletion;
  const me = useTrack.getState().author || null;
  const own: [number, number][] = [];
  state.doc.nodesBetween(from, to, (n, pos) => {
    if (!n.isText) return;
    const a = Math.max(from, pos);
    const b = Math.min(to, pos + n.nodeSize);
    const m = n.marks.find((x) => x.type === ins);
    if (m && (m.attrs.author ?? null) === me) own.push([a, b]);
    else if (!n.marks.some((x) => x.type === del)) tr.addMark(tr.mapping.map(a), tr.mapping.map(b), del.create(attrs()));
  });
  for (const [a, b] of own.reverse()) tr.delete(tr.mapping.map(a), tr.mapping.map(b));
}

function insertSuggested(tr: Transaction, state: EditorState, pos: number, text: string): number {
  const ins = state.schema.marks.insertion;
  const del = state.schema.marks.deletion;
  tr.insertText(text, pos);
  tr.removeMark(pos, pos + text.length, del);
  tr.addMark(pos, pos + text.length, ins.create(attrs()));
  return pos + text.length;
}

const key = new PluginKey('trackChanges');

export const TrackChanges = Extension.create({
  name: 'trackChanges',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        props: {
          handleTextInput(view, from, to, text) {
            if (!useTrack.getState().suggest || !view.editable) return false;
            const { state } = view;
            const tr = state.tr;
            if (from < to) markDeleted(tr, state, from, to);
            const at = tr.mapping.map(to);
            const end = insertSuggested(tr, state, at, text);
            tr.setSelection(TextSelection.create(tr.doc, end));
            view.dispatch(tr.scrollIntoView());
            return true;
          },
          handleKeyDown(view, e) {
            if (!useTrack.getState().suggest || !view.editable) return false;
            if (e.key !== 'Backspace' && e.key !== 'Delete') return false;
            const { state } = view;
            const { from, to, empty } = state.selection;
            const back = e.key === 'Backspace';
            let a = from;
            let b = to;
            if (empty) {
              // un carattere prima o dopo, solo dentro lo stesso blocco (le unioni di paragrafi non si tracciano)
              const $p = state.selection.$from;
              if (back ? $p.parentOffset === 0 : $p.parentOffset === $p.parent.content.size) return false;
              a = back ? from - 1 : from;
              b = back ? from : from + 1;
            }
            const tr = state.tr;
            markDeleted(tr, state, a, b);
            const caret = empty ? (back ? tr.mapping.map(a, -1) : tr.mapping.map(b)) : tr.mapping.map(b);
            tr.setSelection(TextSelection.create(tr.doc, caret));
            view.dispatch(tr.scrollIntoView());
            e.preventDefault();
            return true;
          },
          handlePaste(view, e) {
            if (!useTrack.getState().suggest || !view.editable) return false;
            const text = e.clipboardData?.getData('text/plain');
            if (!text) return false;
            const { state } = view;
            const tr = state.tr;
            const { from, to } = state.selection;
            if (from < to) markDeleted(tr, state, from, to);
            const end = insertSuggested(tr, state, tr.mapping.map(to), text.replace(/\r?\n+/g, ' '));
            tr.setSelection(TextSelection.create(tr.doc, end));
            view.dispatch(tr.scrollIntoView());
            return true;
          },
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------- accettare e rifiutare

export interface Change {
  kind: 'insertion' | 'deletion';
  from: number;
  to: number;
  author: string | null;
  date: string | null;
  text: string;
}

/** Revisioni del documento, nell'ordine; i pezzi contigui dello stesso autore sono uno solo. */
export function listChanges(doc: PMNode): Change[] {
  const out: Change[] = [];
  doc.descendants((n, pos) => {
    if (!n.isText) return;
    const m = n.marks.find((x: PMMark) => x.type.name === 'insertion' || x.type.name === 'deletion');
    if (!m) return;
    const kind = m.type.name as Change['kind'];
    const last = out[out.length - 1];
    if (last && last.kind === kind && last.to === pos && last.author === (m.attrs.author ?? null)) {
      last.to = pos + n.nodeSize;
      last.text += n.text ?? '';
    } else out.push({ kind, from: pos, to: pos + n.nodeSize, author: m.attrs.author ?? null, date: m.attrs.date ?? null, text: n.text ?? '' });
  });
  return out;
}

/** Accetta o rifiuta le revisioni scelte (dalla fine, così le posizioni restano valide). */
export function resolveChanges(editor: Editor, accept: boolean, which: (c: Change) => boolean = () => true): number {
  const { state } = editor;
  const changes = listChanges(state.doc).filter(which);
  if (!changes.length) return 0;
  const tr = state.tr;
  for (const c of [...changes].reverse()) {
    const keep = accept ? c.kind === 'insertion' : c.kind === 'deletion';
    if (keep) tr.removeMark(c.from, c.to, state.schema.marks[c.kind]);
    else tr.delete(c.from, c.to);
  }
  editor.view.dispatch(tr);
  return changes.length;
}

/** La revisione sotto il cursore (o la prima dopo). */
export function changeAt(editor: Editor): Change | null {
  const pos = editor.state.selection.from;
  const all = listChanges(editor.state.doc);
  return all.find((c) => pos >= c.from && pos <= c.to) ?? null;
}

/** Sposta il cursore sulla revisione successiva (ricomincia dall'inizio). */
export function nextChange(editor: Editor): boolean {
  const pos = editor.state.selection.to;
  const all = listChanges(editor.state.doc);
  const c = all.find((x) => x.from > pos) ?? all[0];
  if (!c) return false;
  editor.chain().focus().setTextSelection({ from: c.from, to: c.to }).scrollIntoView().run();
  return true;
}
