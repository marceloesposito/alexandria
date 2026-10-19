// Azioni sulla tabella dove sta il cursore: numero di righe e colonne, allineamento della colonna.
// La logica sta in tableModel.ts; qui solo la lettura della selezione e la transazione.
import type { Editor } from '@tiptap/core';
import type { Selection, Transaction } from '@tiptap/pm/state';
import { TextSelection } from '@tiptap/pm/state';
import type { Node as PMNodeView } from '@tiptap/pm/model';
import type { PMNode } from 'logos/doc/types';
import { columnWidths } from 'logos/doc/tables';
import { normalizeWidths, resizeTable, tableSize, withColumnAlign, type ColumnAlign } from './tableModel';

export interface TableHere {
  pos: number;
  node: PMNodeView;
  row: number;
  col: number;
  rows: number;
  cols: number;
  align: ColumnAlign[];
}

/** La tabella che contiene il cursore (o la selezione di celle), con la riga e la colonna. */
export function tableAt(state: { selection: Selection }): TableHere | null {
  const $f = state.selection.$from;
  for (let d = $f.depth; d > 0; d--) {
    const node = $f.node(d);
    if (node.type.name !== 'table') continue;
    const { rows, cols } = tableSize(node.toJSON() as PMNode);
    return {
      pos: $f.before(d),
      node,
      row: $f.index(d),
      col: $f.depth > d ? $f.index(d + 1) : 0,
      rows,
      cols,
      align: (node.attrs.align as ColumnAlign[] | undefined) ?? [],
    };
  }
  return null;
}

/** Porta la tabella a `rows` x `cols`; il cursore resta nella stessa cella (o nell'ultima rimasta). */
export function setTableSize(editor: Editor, rows: number, cols: number): boolean {
  const here = tableAt(editor.state);
  if (!here) return false;
  const next = editor.schema.nodeFromJSON(resizeTable(here.node.toJSON() as PMNode, rows, cols));
  const tr = editor.state.tr.replaceWith(here.pos, here.pos + here.node.nodeSize, next);
  const r = Math.min(here.row, next.childCount - 1);
  const row = next.child(r);
  const c = Math.min(here.col, row.childCount - 1);
  let p = here.pos + 1;
  for (let i = 0; i < r; i++) p += next.child(i).nodeSize;
  p += 1;
  for (let j = 0; j < c; j++) p += row.child(j).nodeSize;
  tr.setSelection(TextSelection.near(tr.doc.resolve(p + 1)));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

/** Allinea la colonna del cursore (null: come di base, a sinistra). */
export function setColumnAlign(editor: Editor, value: ColumnAlign): boolean {
  const here = tableAt(editor.state);
  if (!here) return false;
  const align = withColumnAlign(here.align, here.col, value);
  editor.view.dispatch(editor.state.tr.setNodeMarkup(here.pos, undefined, { ...here.node.attrs, align }));
  editor.view.focus();
  return true;
}

/** Larghezze delle colonne in percentuale (null: uguali). */
export function setColumnWidths(editor: Editor, widths: number[] | null): boolean {
  const here = tableAt(editor.state);
  if (!here) return false;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(here.pos, undefined, { ...here.node.attrs, widths }));
  editor.view.focus();
  return true;
}

export function columnAlign(editor: Editor | null): ColumnAlign | undefined {
  const here = editor ? tableAt(editor.state) : null;
  return here ? (here.align[here.col] ?? null) : undefined;
}

/** Comando su una colonna (aggiunta prima o dopo, eliminazione) che tiene le larghezze scelte:
 *  la colonna nuova prende la media, quella tolta lascia il posto alle altre. Una sola transazione. */
export function columnCommand(editor: Editor, change: 'before' | 'after' | 'delete'): boolean {
  const here = tableAt(editor.state);
  const w = here ? columnWidths(here.node.attrs, here.cols) : null;
  const chain = editor.chain().focus();
  const run = change === 'delete' ? chain.deleteColumn() : change === 'before' ? chain.addColumnBefore() : chain.addColumnAfter();
  return run
    .command(({ tr }: { tr: Transaction }) => {
      const now = tableAt(tr);
      if (!w || !here || !now) return true;
      const next = [...w];
      if (change === 'delete') next.splice(here.col, 1);
      else next.splice(change === 'before' ? here.col : here.col + 1, 0, 100 / w.length);
      // con piu' colonne selezionate i conti non tornano: larghezze uguali
      tr.setNodeMarkup(now.pos, undefined, { ...now.node.attrs, widths: next.length === now.cols ? normalizeWidths(next) : null });
      return true;
    })
    .run();
}
