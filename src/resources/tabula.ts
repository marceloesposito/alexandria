// Geometria della Tabula: posto delle pergamene (nodi fissi) e lato da cui parte e arriva una freccia.
import { docNodeId } from './docLinks';

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Side = 'top' | 'right' | 'bottom' | 'left';

/** Distanza verticale fra le pergamene messe in colonna. */
export const DOC_STEP = 130;
/** Colonna delle pergamene: a sinistra delle risorse, che partono da x = 0. */
export const DOC_X = -340;

/**
 * Ogni pergamena del Compendium ha il suo nodo. Quelle gia' spostate restano dove sono; le nuove
 * vanno in colonna sotto l'ultima pergamena piazzata (o in alto a sinistra, la prima volta).
 */
export function placeDocNodes(rels: string[], saved: Record<string, Pt>): Record<string, Pt> {
  const out: Record<string, Pt> = {};
  const placed = rels.map((r) => saved[docNodeId(r)]).filter((p): p is Pt => !!p);
  const x = placed.length ? Math.min(...placed.map((p) => p.x)) : DOC_X;
  let y = placed.length ? Math.max(...placed.map((p) => p.y)) + DOC_STEP : 0;
  for (const r of rels) {
    const id = docNodeId(r);
    if (saved[id]) out[id] = saved[id];
    else {
      out[id] = { x, y };
      y += DOC_STEP;
    }
  }
  return out;
}

const center = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function anchor(r: Rect, side: Side): Pt {
  const c = center(r);
  if (side === 'top') return { x: c.x, y: r.y };
  if (side === 'bottom') return { x: c.x, y: r.y + r.h };
  if (side === 'left') return { x: r.x, y: c.y };
  return { x: r.x + r.w, y: c.y };
}

/**
 * Lati che si guardano: se i nodi stanno piu' uno sopra l'altro che uno accanto all'altro la freccia
 * esce da sotto (o sopra) e arriva sopra (o sotto); altrimenti da destra a sinistra o viceversa.
 * Lo scarto si misura togliendo le mezze dimensioni, cosi' nodi larghi e bassi non sbagliano lato.
 */
export function facingSides(a: Rect, b: Rect): { from: Side; to: Side; start: Pt; end: Pt } {
  const ca = center(a);
  const cb = center(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const gapX = Math.abs(dx) - (a.w + b.w) / 2;
  const gapY = Math.abs(dy) - (a.h + b.h) / 2;
  const vertical = gapY > gapX;
  const from: Side = vertical ? (dy > 0 ? 'bottom' : 'top') : dx > 0 ? 'right' : 'left';
  const to: Side = vertical ? (dy > 0 ? 'top' : 'bottom') : dx > 0 ? 'left' : 'right';
  return { from, to, start: anchor(a, from), end: anchor(b, to) };
}
