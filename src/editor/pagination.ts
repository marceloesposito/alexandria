// Impaginazione della vista pagina: dove cade la fine di ogni pagina, dati l'altezza dello specchio
// di stampa e le misure dei blocchi. Un blocco non si spezza: se non ci sta passa alla pagina dopo;
// un blocco più alto di una pagina la allunga. paginate() è pura (misure in pixel CSS); il plugin
// disegna gli spazi fra i fogli come widget e si rimisura a ogni modifica.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';


export interface BlockBox {
  /** inizio e fine del blocco dall'inizio dello specchio di stampa, senza gli spazi fra pagine */
  top: number;
  bottom: number;
}

export interface PageBreak {
  /** indice del blocco che apre la pagina nuova */
  index: number;
  /** spazio vuoto lasciato in fondo alla pagina che finisce */
  rest: number;
}

export interface Pagination {
  breaks: PageBreak[];
  /** spazio vuoto in fondo all'ultima pagina, per completarla */
  endRest: number;
  pages: number;
}

export function paginate(blocks: BlockBox[], textHeight: number): Pagination {
  const breaks: PageBreak[] = [];
  if (textHeight <= 0) return { breaks, endRest: 0, pages: 1 };
  let pageTop = 0;
  let pageEnd = textHeight;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.bottom > pageEnd + 0.5 && b.top > pageTop + 0.5) {
      // il blocco non ci sta: la pagina finisce dove finiva il blocco prima
      breaks.push({ index: i, rest: Math.max(0, pageEnd - b.top) });
      pageTop = b.top;
      pageEnd = b.top + textHeight;
    }
    // un blocco più alto della pagina la allunga fino a contenerlo
    while (b.bottom > pageEnd + 0.5) pageEnd += textHeight;
  }
  const last = blocks.length ? blocks[blocks.length - 1].bottom : 0;
  return { breaks, endRest: Math.max(0, pageEnd - last), pages: breaks.length + 1 };
}

/**
 * Due impaginazioni uguali a meno di `tol` pixel: stessi salti, spazi quasi uguali. Il plugin non
 * ridisegna per differenze sotto il pixel, altrimenti misura e ridisegno si inseguono (l'altezza dei
 * fogli oscilla di mezzo pixel all'infinito e in WebKit lo scorrimento si trascina).
 */
export function samePagination(a: Pagination, b: Pagination, tol = 1): boolean {
  return (
    a.pages === b.pages &&
    a.breaks.length === b.breaks.length &&
    a.breaks.every((x, i) => x.index === b.breaks[i].index && Math.abs(x.rest - b.breaks[i].rest) < tol) &&
    Math.abs(a.endRest - b.endRest) < tol
  );
}

/**
 * Spazio in piu' che un salto crea fra due blocchi: senza il salto il margine inferiore del primo
 * (`below`) e quello superiore del secondo (`above`) si fondono (il piu' grande dei positivi piu' il
 * piu' negativo dei negativi), con il salto in mezzo si sommano. Senza questa correzione la stessa
 * pergamena arriva a salti diversi a seconda di dove cadevano prima (per esempio dopo un annulla).
 */
export function marginOverlap(below: number, above: number): number {
  const collapsed = Math.max(below, above, 0) + Math.min(below, above, 0);
  return below + above - collapsed;
}

export const MM = 96 / 25.4;

// ---------------------------------------------------------------- plugin dell'editor

/**
 * Geometria della pagina in pixel CSS; enabled = vista pagina (non senza bordi, non Silentium);
 * hints = vista senza bordi con i confini di pagina: una linea tenue di altezza zero dove finirebbe
 * ogni pagina (stessa impaginazione, il testo non si sposta).
 */
export const pageGeometry = { enabled: false, hints: false, textHeight: 0, padTop: 0, padBottom: 0, gap: 28 };

const views = new Set<EditorView>();
const listeners = new Set<() => void>();

/** Avvisa quando i fogli cambiano (numeri di riga, righelli): restituisce la funzione per smettere. */
export function onPaginate(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const key = new PluginKey<{ deco: DecorationSet; sig: string }>('pagination');
/** ultima impaginazione disegnata per ogni editor (per `samePagination`) */
const drawn = new WeakMap<EditorView, { p: Pagination; geo: string }>();

export function setPageGeometry(g: Partial<typeof pageGeometry>) {
  Object.assign(pageGeometry, g);
  views.forEach(schedule);
}

const pending = new WeakMap<EditorView, number>();
function schedule(view: EditorView) {
  if (pending.has(view)) return;
  pending.set(
    view,
    requestAnimationFrame(() => {
      pending.delete(view);
      measure(view);
    }),
  );
}

function gapEl(height: number, page: number, rest: number, last: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = `page-gap ${last ? 'is-end' : ''}`;
  el.contentEditable = 'false';
  el.style.height = `${height}px`;
  el.setAttribute('aria-hidden', 'true');
  const num = document.createElement('span');
  num.className = 'page-gap__num';
  num.textContent = String(page);
  num.style.top = `${rest + pageGeometry.padBottom / 2}px`;
  el.appendChild(num);
  if (!last) {
    const band = document.createElement('div');
    band.className = 'page-gap__band';
    band.style.top = `${rest + pageGeometry.padBottom}px`;
    band.style.height = `${pageGeometry.gap}px`;
    el.appendChild(band);
  }
  return el;
}

function hintEl(page: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'page-hint';
  el.contentEditable = 'false';
  el.setAttribute('aria-hidden', 'true');
  el.dataset.page = String(page);
  return el;
}

function buildHints(state: EditorState, p: Pagination): DecorationSet {
  const offsets: number[] = [];
  state.doc.forEach((_n, offset) => offsets.push(offset));
  return DecorationSet.create(
    state.doc,
    p.breaks.map((b, k) => Decoration.widget(offsets[b.index], () => hintEl(k + 2), { side: -1, key: `ph${k}-${b.index}`, ignoreSelection: true })),
  );
}

/** Confini di pagina nella vista senza bordi: i widget non hanno altezza, si misura il testo com'e'. */
function measureHints(view: EditorView, st: { sig: string }) {
  const g = pageGeometry;
  const dom = view.dom as HTMLElement;
  if (!dom.offsetWidth) return;
  const r0 = dom.getBoundingClientRect();
  const scale = r0.width / dom.offsetWidth || 1;
  const boxes: BlockBox[] = [];
  for (const el of Array.from(dom.children) as HTMLElement[]) {
    if (el.classList.contains('page-hint') || el.classList.contains('page-gap') || el.classList.contains('ProseMirror-widget') || el.classList.contains('ProseMirror-gapcursor')) continue;
    const r = el.getBoundingClientRect();
    boxes.push({ top: (r.top - r0.top) / scale, bottom: (r.bottom - r0.top) / scale });
  }
  if (boxes.length !== view.state.doc.childCount) return;
  const p = paginate(boxes, g.textHeight);
  const sig = `hints|${p.breaks.map((b) => b.index).join(',')}`;
  if (st.sig === sig) return;
  view.dispatch(view.state.tr.setMeta(key, { deco: buildHints(view.state, p), sig }).setMeta('addToHistory', false));
}

function build(state: EditorState, p: Pagination): DecorationSet {
  const g = pageGeometry;
  const offsets: number[] = [];
  state.doc.forEach((_n, offset) => offsets.push(offset));
  const decos = p.breaks.map((b, k) =>
    Decoration.widget(offsets[b.index], () => gapEl(b.rest + g.padBottom + g.gap + g.padTop, k + 1, b.rest, false), {
      side: -1,
      key: `pg${k}-${Math.round(b.rest)}`,
      ignoreSelection: true,
    }),
  );
  decos.push(
    Decoration.widget(state.doc.content.size, () => gapEl(p.endRest, p.pages, p.endRest, true), {
      side: 1,
      key: `pgend${p.pages}-${Math.round(p.endRest)}`,
      ignoreSelection: true,
    }),
  );
  return DecorationSet.create(state.doc, decos);
}

function measure(view: EditorView) {
  const st = key.getState(view.state);
  if (!st) return;
  const g = pageGeometry;
  if (!g.enabled && g.hints && g.textHeight > 0) {
    measureHints(view, st);
    return;
  }
  if (!g.enabled || g.textHeight <= 0) {
    if (st.sig !== '') view.dispatch(view.state.tr.setMeta(key, { deco: DecorationSet.empty, sig: '' }).setMeta('addToHistory', false));
    return;
  }
  const page = view.dom.closest('.page') as HTMLElement | null;
  if (!page || !page.offsetWidth) return;
  const pr = page.getBoundingClientRect();
  const scale = pr.width / page.offsetWidth || 1;
  const origin = pr.top + g.padTop * scale;
  const boxes: BlockBox[] = [];
  // spazio aggiunto dai salti gia' disegnati, da togliere per avere le posizioni del testo continuo
  let gaps = 0;
  let prevBottom: number | null = null;
  let gap: DOMRect | null = null;
  for (const el of Array.from(view.dom.children) as HTMLElement[]) {
    if (el.classList.contains('page-gap')) {
      if (!el.classList.contains('is-end')) gap = el.getBoundingClientRect();
      continue;
    }
    if (el.classList.contains('ProseMirror-widget') || el.classList.contains('ProseMirror-gapcursor')) continue;
    const r = el.getBoundingClientRect();
    if (gap) {
      // altezza vera, con i decimali (`offsetHeight` arrotonda), piu' i margini che il salto separa
      gaps += gap.height / scale;
      if (prevBottom !== null) gaps += marginOverlap((gap.top - prevBottom) / scale, (r.top - gap.bottom) / scale);
      gap = null;
    }
    boxes.push({ top: (r.top - origin) / scale - gaps, bottom: (r.bottom - origin) / scale - gaps });
    prevBottom = r.bottom;
  }
  // i blocchi misurati devono corrispondere ai nodi del documento
  if (boxes.length !== view.state.doc.childCount) return;
  const p = paginate(boxes, g.textHeight);
  const geo = `${g.padTop}|${g.padBottom}|${g.gap}`;
  const prev = drawn.get(view);
  if (st.sig !== '' && st.sig !== 'stale' && prev && prev.geo === geo && samePagination(prev.p, p)) return;
  const sig = `${p.breaks.map((b) => `${b.index}:${Math.round(b.rest)}`).join(',')}|${Math.round(p.endRest)}|${geo}`;
  drawn.set(view, { p, geo });
  view.dispatch(view.state.tr.setMeta(key, { deco: build(view.state, p), sig }).setMeta('addToHistory', false));
  listeners.forEach((cb) => cb());
}

/** Vista pagina con fogli veri: formato, margini e interruzioni di pagina dal Layout. */
export const PageView = Extension.create({
  name: 'pageView',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: () => ({ deco: DecorationSet.empty, sig: '' }),
          apply(tr, old) {
            const meta = tr.getMeta(key) as { deco: DecorationSet; sig: string } | undefined;
            if (meta) return meta;
            return tr.docChanged ? { deco: old.deco.map(tr.mapping, tr.doc), sig: 'stale' } : old;
          },
        },
        props: {
          decorations: (state) => key.getState(state)?.deco ?? DecorationSet.empty,
        },
        view(view) {
          views.add(view);
          const ro = new ResizeObserver(() => schedule(view));
          ro.observe(view.dom);
          schedule(view);
          return {
            update: () => schedule(view),
            destroy: () => {
              views.delete(view);
              ro.disconnect();
            },
          };
        },
      }),
    ];
  },
});
