// Confini di pagina nel testo senza bordi: una linea tenue dove finirebbe una pagina A4. La pagina
// e' quella del Layout predefinito di Alexandria (specchio di stampa in proporzione alla colonna del
// testo); un blocco non si spezza: se non ci sta, la pagina finisce prima (come nella vista pagina di
// Alexandria). Le linee sono widget di altezza zero: non spostano il testo, quindi la misura e'
// stabile. paginate() e' pura (misure in pixel).
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { defaultLayout } from 'logos/layout/model';

export interface BlockBox {
  top: number;
  bottom: number;
}

/** Indici dei blocchi che aprono una pagina nuova, e quante pagine in tutto. */
export function paginate(blocks: BlockBox[], pageHeight: number): { breaks: number[]; pages: number } {
  const breaks: number[] = [];
  if (pageHeight <= 0 || !blocks.length) return { breaks, pages: 1 };
  let pageTop = blocks[0].top;
  let pageEnd = pageTop + pageHeight;
  // pagine aggiunte da blocchi piu' alti di una pagina
  let extra = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.bottom > pageEnd + 0.5 && b.top > pageTop + 0.5) {
      breaks.push(i);
      pageTop = b.top;
      pageEnd = b.top + pageHeight;
    }
    // un blocco piu' alto della pagina la allunga
    while (b.bottom > pageEnd + 0.5) {
      pageEnd += pageHeight;
      extra++;
    }
  }
  return { breaks, pages: breaks.length + 1 + extra };
}

/** Altezza di una pagina, in px, per una colonna di testo larga `columnWidth`. */
export function pageHeightFor(columnWidth: number): number {
  const L = defaultLayout();
  const textW = L.widthMm - L.marginInnerMm - L.marginOuterMm;
  const textH = L.heightMm - L.marginTopMm - L.marginBottomMm;
  return textW > 0 ? (columnWidth * textH) / textW : 0;
}

const key = new PluginKey<{ deco: DecorationSet; sig: string }>('columnPageHints');

/** Chi vuole sapere quante pagine ci sono (il contatore). */
let onPages: ((n: number) => void) | null = null;
export function setPagesListener(f: typeof onPages) {
  onPages = f;
}

function hint(n: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'fx-page-hint';
  el.contentEditable = 'false';
  el.setAttribute('aria-hidden', 'true');
  el.dataset.page = String(n);
  return el;
}

function measure(view: EditorView) {
  const dom = view.dom as HTMLElement;
  if (!dom.offsetWidth) return;
  const origin = dom.getBoundingClientRect();
  const scale = origin.width / dom.offsetWidth || 1;
  const boxes: BlockBox[] = [];
  for (const el of Array.from(dom.children) as HTMLElement[]) {
    if (el.classList.contains('fx-page-hint') || el.classList.contains('ProseMirror-widget') || el.classList.contains('ProseMirror-gapcursor')) continue;
    const r = el.getBoundingClientRect();
    boxes.push({ top: (r.top - origin.top) / scale, bottom: (r.bottom - origin.top) / scale });
  }
  if (boxes.length !== view.state.doc.childCount) return;
  const p = paginate(boxes, pageHeightFor(dom.offsetWidth));
  onPages?.(p.pages);
  const sig = p.breaks.join(',');
  if (key.getState(view.state)?.sig !== sig) {
    const offsets: number[] = [];
    view.state.doc.forEach((_n, offset) => offsets.push(offset));
    const decos = p.breaks.map((i, k) => Decoration.widget(offsets[i], () => hint(k + 2), { side: -1, key: `ph${k}-${i}`, ignoreSelection: true }));
    view.dispatch(view.state.tr.setMeta(key, { deco: DecorationSet.create(view.state.doc, decos), sig }).setMeta('addToHistory', false));
  }
  centerHints(dom, scale);
}

/**
 * Mette la linea a meta' fra il blocco prima e quello dopo: il confine ha altezza zero e i margini
 * dei due blocchi lo attraversano, quindi la sua posizione da sola non dice dove sta il centro.
 */
function centerHints(dom: HTMLElement, scale: number) {
  for (const el of Array.from(dom.querySelectorAll<HTMLElement>(':scope > .fx-page-hint'))) {
    const prev = el.previousElementSibling;
    const next = el.nextElementSibling;
    if (!prev || !next) continue;
    const mid = (prev.getBoundingClientRect().bottom + next.getBoundingClientRect().top) / 2;
    const y = `${((mid - el.getBoundingClientRect().top) / scale).toFixed(1)}px`;
    if (el.style.getPropertyValue('--hint-y') !== y) el.style.setProperty('--hint-y', y);
  }
}

export const PageHints = Extension.create({
  name: 'pageHints',
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
        props: { decorations: (state) => key.getState(state)?.deco ?? DecorationSet.empty },
        view(view) {
          let raf = 0;
          const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => measure(view));
          };
          const ro = new ResizeObserver(schedule);
          ro.observe(view.dom);
          schedule();
          return {
            update: schedule,
            destroy: () => {
              cancelAnimationFrame(raf);
              ro.disconnect();
            },
          };
        },
      }),
    ];
  },
});
