// Posti d'equilibrio della Tabula: flusso dall'alto in basso dai collegamenti dell'utente. Radici in
// alto, figli sotto, fratelli affiancati; se non entrano nella larghezza massima si impilano in
// verticale (rientrati sotto il padre). Componenti separate una sotto l'altra, blocchi non collegati
// in coda. L'ordine dei fratelli viene dalla loro posizione attuale: l'utente riordina trascinando.
// Funzione pura, usata anche per l'albero del Palimpsestus (senza fisica).

export interface FlowItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlowEdge {
  from: string;
  to: string;
}

export interface FlowOptions {
  /** larghezza massima disponibile (la colonna della Tabula) */
  maxWidth: number;
  gapX: number;
  gapY: number;
  /** rientro dei figli impilati */
  indent: number;
  /** oltre questo numero i fratelli si impilano anche se entrerebbero */
  maxSiblings: number;
}

export const FLOW_DEFAULTS: FlowOptions = { maxWidth: 900, gapX: 20, gapY: 28, indent: 28, maxSiblings: 4 };

export type Positions = Map<string, { x: number; y: number }>;

interface Sub {
  w: number;
  h: number;
  place(x: number, y: number, out: Positions): void;
}

export function flowLayout(items: FlowItem[], edges: FlowEdge[], opts: Partial<FlowOptions> = {}): Positions {
  const o = { ...FLOW_DEFAULTS, ...opts };
  const byId = new Map(items.map((i) => [i.id, i]));
  const kids = new Map<string, FlowItem[]>();
  const hasParent = new Set<string>();
  for (const e of edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    // un solo padre per blocco: vale il primo collegamento
    if (!a || !b || a === b || hasParent.has(b.id)) continue;
    hasParent.add(b.id);
    kids.set(a.id, [...(kids.get(a.id) ?? []), b]);
  }

  const visiting = new Set<string>();
  const sub = (it: FlowItem): Sub => {
    visiting.add(it.id);
    const ch = (kids.get(it.id) ?? []).filter((c) => !visiting.has(c.id));
    const subs = ch.map((c) => ({ c, s: sub(c) }));
    visiting.delete(it.id);
    if (!subs.length) return { w: it.w, h: it.h, place: (x, y, out) => out.set(it.id, { x, y }) };
    const rowW = subs.reduce((a, k) => a + k.s.w, 0) + o.gapX * (subs.length - 1);
    if (subs.length <= o.maxSiblings && rowW <= o.maxWidth) {
      // fratelli affiancati, in ordine di x attuale
      subs.sort((a, b) => a.c.x - b.c.x || a.c.y - b.c.y || a.c.id.localeCompare(b.c.id));
      const w = Math.max(it.w, rowW);
      const h = it.h + o.gapY + Math.max(...subs.map((k) => k.s.h));
      return {
        w,
        h,
        place(x, y, out) {
          out.set(it.id, { x: x + (w - it.w) / 2, y });
          let cx = x + (w - rowW) / 2;
          for (const k of subs) {
            k.s.place(cx, y + it.h + o.gapY, out);
            cx += k.s.w + o.gapX;
          }
        },
      };
    }
    // fratelli impilati, in ordine di y attuale
    subs.sort((a, b) => a.c.y - b.c.y || a.c.x - b.c.x || a.c.id.localeCompare(b.c.id));
    const w = Math.max(it.w, o.indent + Math.max(...subs.map((k) => k.s.w)));
    const h = it.h + subs.reduce((a, k) => a + o.gapY + k.s.h, 0);
    return {
      w,
      h,
      place(x, y, out) {
        out.set(it.id, { x, y });
        let cy = y + it.h;
        for (const k of subs) {
          cy += o.gapY;
          k.s.place(x + o.indent, cy, out);
          cy += k.s.h;
        }
      },
    };
  };

  const out: Positions = new Map();
  const roots = items.filter((i) => !hasParent.has(i.id));
  const trees = roots.filter((r) => kids.has(r.id)).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  const loose = roots.filter((r) => !kids.has(r.id)).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  let y = 0;
  for (const r of trees) {
    const s = sub(r);
    s.place(0, y, out);
    y += s.h + o.gapY * 2;
  }
  // blocchi non collegati in coda, a righe che vanno a capo
  let x = 0;
  let rowH = 0;
  for (const it of loose) {
    if (x > 0 && x + it.w > o.maxWidth) {
      x = 0;
      y += rowH + o.gapY;
      rowH = 0;
    }
    out.set(it.id, { x, y });
    x += it.w + o.gapX;
    rowH = Math.max(rowH, it.h);
  }
  // blocchi in un ciclo (non dovrebbero esistere): restano dove sono
  for (const it of items) if (!out.has(it.id)) out.set(it.id, { x: it.x, y: it.y });
  return out;
}

/** Due rettangoli si sovrappongono (con un margine)? */
export function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, margin = 0): boolean {
  return a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;
}

/**
 * Collegare come in Scratch: un blocco lasciato poco sotto un altro (entro `reach` dal suo bordo
 * inferiore e sovrapposto in orizzontale) diventa suo figlio; allontanato con decisione dal padre
 * (oltre `breakAway` dal posto d'equilibrio) se ne stacca. Altrimenti nulla cambia.
 */
export function attachRule(
  dropped: FlowItem,
  others: FlowItem[],
  current: { parent: string | null; home: { x: number; y: number } | null },
  opts: { reach?: number; breakAway?: number } = {},
): { attach: string } | { detach: true } | null {
  const reach = opts.reach ?? 56;
  const breakAway = opts.breakAway ?? 140;
  let best: { id: string; d: number } | null = null;
  for (const p of others) {
    if (p.id === dropped.id) continue;
    const gap = dropped.y - (p.y + p.h);
    const overlapX = Math.min(dropped.x + dropped.w, p.x + p.w) - Math.max(dropped.x, p.x);
    if (gap < -p.h / 2 || gap > reach || overlapX < Math.min(dropped.w, p.w) * 0.3) continue;
    const d = Math.abs(gap) + Math.abs(dropped.x - p.x) / 4;
    if (!best || d < best.d) best = { id: p.id, d };
  }
  if (best && best.id !== current.parent) return { attach: best.id };
  if (best) return null;
  if (current.parent && current.home && Math.hypot(dropped.x - current.home.x, dropped.y - current.home.y) > breakAway) return { detach: true };
  return null;
}
