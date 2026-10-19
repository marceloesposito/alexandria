// Tabelle nello Scriptorium: il bordo fra due colonne si trascina per cambiarne la larghezza (doppio
// clic: larghezze uguali) e il tasto destro su una cella apre il menu della tabella.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { columnWidths } from 'logos/doc/tables';
import { dragBorder, normalizeWidths } from '../tableModel';
import { openContextMenu, type CtxItem } from '../../components/ContextMenu';
import { getCommand, runCommand } from '../../commands/registry';
import { t } from '../../i18n';

/** distanza dal bordo (px) entro cui il cursore lo afferra */
const GRIP = 5;

interface Border {
  table: HTMLTableElement;
  /** bordo fra la colonna index e la index + 1 */
  index: number;
}

/** Il bordo fra due colonne sotto il puntatore, se c'e'. */
function borderAt(view: EditorView, e: MouseEvent): Border | null {
  const cell = (e.target as HTMLElement | null)?.closest?.('td, th') as HTMLTableCellElement | null;
  if (!cell || !view.dom.contains(cell)) return null;
  const table = cell.closest('table') as HTMLTableElement | null;
  const count = cell.parentElement?.children.length ?? 0;
  if (!table) return null;
  const r = cell.getBoundingClientRect();
  if (e.clientX >= r.right - GRIP && cell.cellIndex < count - 1) return { table, index: cell.cellIndex };
  if (e.clientX <= r.left + GRIP && cell.cellIndex > 0) return { table, index: cell.cellIndex - 1 };
  return null;
}

/** Posizione nel documento della tabella mostrata da `table`. */
function tablePos(view: EditorView, table: HTMLTableElement): number | null {
  const cell = table.querySelector('td, th');
  if (!cell) return null;
  const $p = view.state.doc.resolve(view.posAtDOM(cell, 0));
  for (let d = $p.depth; d > 0; d--) if ($p.node(d).type.name === 'table') return $p.before(d);
  return null;
}

/** Larghezze attuali in percentuale: quelle scelte o quelle misurate sullo schermo. */
function currentWidths(view: EditorView, table: HTMLTableElement, pos: number): number[] {
  const node = view.state.doc.nodeAt(pos)!;
  const cols = node.firstChild?.childCount ?? 0;
  const chosen = columnWidths(node.attrs, cols);
  if (chosen) return chosen;
  const cells = [...(table.rows[0]?.cells ?? [])];
  return normalizeWidths(cells.map((c) => c.getBoundingClientRect().width));
}

function setWidths(view: EditorView, pos: number, widths: number[] | null) {
  const node = view.state.doc.nodeAt(pos);
  if (node) view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, widths: widths ? normalizeWidths(widths) : null }));
}

function startDrag(view: EditorView, b: Border, e: MouseEvent) {
  const pos = tablePos(view, b.table);
  if (pos === null) return;
  const start = currentWidths(view, b.table, pos);
  const total = b.table.getBoundingClientRect().width || 1;
  const cols = [...b.table.querySelectorAll(':scope > colgroup > col')] as HTMLElement[];
  let widths = start;
  document.body.classList.add('is-col-resizing');
  const move = (m: MouseEvent) => {
    widths = dragBorder(start, b.index, ((m.clientX - e.clientX) / total) * 100);
    // durante il trascinamento si cambia solo lo schermo; il documento alla fine
    cols.forEach((c, i) => (c.style.width = `${widths[i]}%`));
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    document.body.classList.remove('is-col-resizing');
    if (widths !== start) setWidths(view, pos, widths);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

const item = (id: string, danger = false): CtxItem => {
  const c = getCommand(id);
  return { label: t(c?.label ?? id), checked: c?.isActive?.() ?? false, disabled: c?.isEnabled ? !c.isEnabled() : false, danger, onClick: () => void runCommand(id) };
};

const sep: CtxItem = { sep: true, label: '' };

/** Voci del menu della tabella (tasto destro su una cella). */
export function tableMenuItems(): CtxItem[] {
  return [
    item('table.addRowBefore'),
    item('table.addRow'),
    item('table.addColumnBefore'),
    item('table.addColumn'),
    sep,
    item('table.deleteRow', true),
    item('table.deleteColumn', true),
    sep,
    item('table.align.left'),
    item('table.align.center'),
    item('table.align.right'),
    item('table.equalWidths'),
    item('table.resize'),
    sep,
    item('table.delete', true),
  ];
}

export const TableTools = Extension.create({
  name: 'tableTools',
  addProseMirrorPlugins() {
    let hover = false;
    return [
      new Plugin({
        key: new PluginKey('tableTools'),
        props: {
          handleDOMEvents: {
            mousemove: (view, e) => {
              const on = view.editable && !!borderAt(view, e);
              if (on !== hover) view.dom.classList.toggle('is-col-border', (hover = on));
              return false;
            },
            mouseleave: (view) => {
              if (hover) view.dom.classList.remove('is-col-border');
              hover = false;
              return false;
            },
            mousedown: (view, e) => {
              if (e.button !== 0 || !view.editable) return false;
              const b = borderAt(view, e);
              if (!b) return false;
              e.preventDefault();
              if (e.detail === 2) {
                const pos = tablePos(view, b.table);
                if (pos !== null) setWidths(view, pos, null);
              } else startDrag(view, b, e);
              return true;
            },
            contextmenu: (view, e) => {
              const cell = (e.target as HTMLElement | null)?.closest?.('td, th');
              if (!cell || !view.dom.contains(cell) || !view.editable) return false;
              // il clic destro fuori dalla selezione porta il cursore nella cella
              const at = view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos;
              const { from, to } = view.state.selection;
              if (at !== undefined && (at < from || at > to)) view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(at))));
              view.focus();
              openContextMenu(e, tableMenuItems());
              return true;
            },
          },
        },
      }),
    ];
  },
});
