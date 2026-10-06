// Spostamento dei blocchi come in Notion: mentre si trascina un blocco (dalla maniglia), gli altri
// scorrono per fargli posto e al rilascio il blocco va esattamente dove si vede il vuoto.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, NodeSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

export interface Band {
  top: number;
  bottom: number;
}

/**
 * Posto d'arrivo (indice fra i blocchi di primo livello, prima dello spostamento) per il puntatore a
 * quota `y`: il primo blocco, escluso quello trascinato, la cui meta' sta sotto il puntatore.
 * Restituisce un indice "di inserimento" da 0 a n; `from` e `from + 1` significano "resta dov'e'".
 */
export function dropIndex(bands: Band[], from: number, y: number, count = 1): number {
  for (let i = 0; i < bands.length; i++) {
    if (i >= from && i < from + count) continue;
    const mid = (bands[i].top + bands[i].bottom) / 2;
    if (y < mid) return i;
  }
  return bands.length;
}

/**
 * Spostamento verticale di ogni blocco per aprire il vuoto: chi sta fra la posizione vecchia e quella
 * nuova scorre dell'altezza del blocco trascinato (in su se il blocco scende, in giu' se sale).
 */
export function shiftsFor(n: number, from: number, to: number, gap: number, count = 1): number[] {
  const out = new Array<number>(n).fill(0);
  if (to > from + count) for (let i = from + count; i < to; i++) out[i] = -gap;
  else if (to < from) for (let i = to; i < from; i++) out[i] = gap;
  return out;
}

/** Indice finale dei blocchi dopo averli tolti dalla posizione `from` e reinseriti a `to`. */
export function finalIndex(from: number, to: number, count = 1): number {
  return to > from ? to - count : to;
}

/** Stato visibile dello spostamento: quali blocchi si spostano e di quanto (null: nessuno). */
interface Look {
  from: number;
  count: number;
  shifts: number[];
}

const key = new PluginKey<Look | null>('blockReorder');

interface Drag {
  from: number;
  /** quanti blocchi consecutivi si spostano insieme */
  count: number;
  bands: Band[];
  gap: number;
  to: number;
  scroller: HTMLElement | null;
  scroll0: number;
}

/** Il disegno passa da decorazioni: ProseMirror ridisegnerebbe i blocchi toccati direttamente nel DOM. */
function show(view: EditorView, look: Look | null) {
  view.dispatch(view.state.tr.setMeta(key, look).setMeta('addToHistory', false));
}

/**
 * Inizio dello spostamento: uno o piu' blocchi interi di primo livello (quelli scelti dalla maniglia,
 * che seleziona per intervallo di nodi). Altrimenti si lascia fare a ProseMirror.
 */
function start(view: EditorView): Drag | null {
  const sel = view.state.selection;
  if (!view.dragging || sel.empty || sel.$from.depth !== 0 || sel.$to.depth !== 0) return null;
  const els = Array.from(view.dom.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
  if (els.length !== view.state.doc.childCount) return null;
  const from = sel.$from.index(0);
  const count = sel.$to.index(0) - from;
  if (count < 1) return null;
  const bands = els.map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  });
  // altezza del vuoto: dal primo blocco al successivo all'ultimo (margini compresi)
  const last = from + count - 1;
  const gap = last + 1 < bands.length ? bands[last + 1].top - bands[from].top : bands[last].bottom - bands[from].top;
  const scroller = view.dom.closest<HTMLElement>('.editor-scroll');
  return { from, count, bands, gap, to: from, scroller, scroll0: scroller?.scrollTop ?? 0 };
}

export const BlockReorder = Extension.create({
  name: 'blockReorder',
  addProseMirrorPlugins() {
    let drag: Drag | null = null;
    const stop = (view: EditorView) => {
      drag = null;
      if (key.getState(view.state)) show(view, null);
    };
    return [
      new Plugin<Look | null>({
        key,
        state: {
          init: () => null,
          apply: (tr, prev) => (tr.getMeta(key) !== undefined ? (tr.getMeta(key) as Look | null) : prev),
        },
        props: {
          attributes: (state): Record<string, string> => (key.getState(state) ? { class: 'is-reordering' } : {}),
          decorations: (state) => {
            const look = key.getState(state);
            if (!look) return DecorationSet.empty;
            const decos: Decoration[] = [];
            let pos = 0;
            state.doc.forEach((node, _offset, i) => {
              const source = i >= look.from && i < look.from + look.count;
              const shift = look.shifts[i] ?? 0;
              if (source) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-reorder-source' }));
              else decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-reorder-moving', style: shift ? `transform: translateY(${shift}px)` : '' }));
              pos += node.nodeSize;
            });
            return DecorationSet.create(state.doc, decos);
          },
          handleDOMEvents: {
            dragover: (view, e) => {
              // la maniglia sta fuori dall'editor: il trascinamento si riconosce al primo passaggio qui
              if (!drag) {
                drag = start(view);
                if (!drag) return false;
                show(view, { from: drag.from, count: drag.count, shifts: [] });
                // fine del trascinamento ovunque (anche fuori dal testo o con Esc): i blocchi tornano a posto
                window.addEventListener('dragend', () => stop(view), { once: true });
              }
              // le bande sono quelle d'inizio trascinamento: si aggiunge quanto la pagina e' scorsa da allora
              const dy = (drag.scroller?.scrollTop ?? 0) - drag.scroll0;
              const to = dropIndex(drag.bands, drag.from, e.clientY + dy, drag.count);
              if (to !== drag.to) {
                drag.to = to;
                show(view, { from: drag.from, count: drag.count, shifts: shiftsFor(drag.bands.length, drag.from, to, drag.gap, drag.count) });
              }
              e.preventDefault();
              return true;
            },
            drop: (view, e) => {
              if (!drag) return false;
              const { from, to, count } = drag;
              drag = null;
              e.preventDefault();
              const doc = view.state.doc;
              const tr = view.state.tr.setMeta(key, null);
              if (!(to >= from && to <= from + count)) {
                let start = 0;
                for (let i = 0; i < from; i++) start += doc.child(i).nodeSize;
                let end = start;
                for (let i = from; i < from + count; i++) end += doc.child(i).nodeSize;
                const moved = doc.slice(start, end).content;
                tr.delete(start, end);
                const at = finalIndex(from, to, count);
                let pos = 0;
                for (let i = 0; i < at; i++) pos += tr.doc.child(i).nodeSize;
                tr.insert(pos, moved);
                tr.setSelection(NodeSelection.create(tr.doc, pos)).scrollIntoView();
              }
              view.dispatch(tr);
              view.dragging = null;
              return true;
            },
            dragend: (view) => {
              stop(view);
              return false;
            },
          },
        },
      }),
    ];
  },
});
