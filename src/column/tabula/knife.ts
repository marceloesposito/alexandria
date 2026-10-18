// Coltello della Tabula: con Ctrl premuto il puntatore traccia una scia e i collegamenti che la scia
// attraversa si tagliano; un clic su un collegamento taglia quello. Geometria pura (coordinate dello
// schermo): i tracciati dei collegamenti arrivano gia' campionati come spezzate.

export interface Pt {
  x: number;
  y: number;
}

export interface EdgeLine {
  id: string;
  points: Pt[];
}

const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** I segmenti p1-p2 e p3-p4 si toccano (estremi compresi)? */
export function segmentsIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (a: Pt, b: Pt, c: Pt) => Math.min(a.x, b.x) <= c.x && c.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= c.y && c.y <= Math.max(a.y, b.y);
  return (d1 === 0 && on(p3, p4, p1)) || (d2 === 0 && on(p3, p4, p2)) || (d3 === 0 && on(p1, p2, p3)) || (d4 === 0 && on(p1, p2, p4));
}

export function polylinesIntersect(a: Pt[], b: Pt[]): boolean {
  for (let i = 1; i < a.length; i++) for (let j = 1; j < b.length; j++) if (segmentsIntersect(a[i - 1], a[i], b[j - 1], b[j])) return true;
  return false;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Collegamenti da tagliare: quelli attraversati dalla scia, o (scia di un punto, un clic) il piu' vicino entro `tol` px. */
export function edgesToCut(trail: Pt[], edges: EdgeLine[], tol = 6): string[] {
  if (trail.length >= 2 && Math.hypot(trail[trail.length - 1].x - trail[0].x, trail[trail.length - 1].y - trail[0].y) > 3) {
    return edges.filter((e) => polylinesIntersect(trail, e.points)).map((e) => e.id);
  }
  const p = trail[trail.length - 1];
  if (!p) return [];
  let best: { id: string; d: number } | null = null;
  for (const e of edges) {
    for (let i = 1; i < e.points.length; i++) {
      const d = distToSegment(p, e.points[i - 1], e.points[i]);
      if (d <= tol && (!best || d < best.d)) best = { id: e.id, d };
    }
  }
  return best ? [best.id] : [];
}
