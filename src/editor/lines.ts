// Righe visive del testo: ogni riga a schermo riceve un numero. La pagina ha larghezza fissa,
// quindi le righe non cambiano con la finestra (solo con zoom, font o testo).
import { useSyncExternalStore } from 'react';

export interface VisualLine {
  n: number;
  top: number; // relativo al contenitore della pagina, in px
  bottom: number;
}

export interface Rect {
  top: number;
  bottom: number;
}

/** Raggruppa i rettangoli dei frammenti di testo in righe (sovrapposizione verticale > meta'). */
export function clusterLines(rects: Rect[]): Rect[] {
  const sorted = rects.filter((r) => r.bottom - r.top > 1).sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  const out: Rect[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last) {
      const overlap = Math.min(last.bottom, r.bottom) - Math.max(last.top, r.top);
      const minH = Math.min(last.bottom - last.top, r.bottom - r.top);
      if (overlap > minH * 0.5) {
        last.top = Math.min(last.top, r.top);
        last.bottom = Math.max(last.bottom, r.bottom);
        continue;
      }
    }
    out.push({ ...r });
  }
  return out;
}

const SKIP_SELECTOR = '.nv-figure, .nv-footnote, .nv-toc, [data-lines="skip"], .nv-bibliography__bar, .ProseMirror-widget';

/** Misura le righe del contenuto di `root` (l'elemento .ProseMirror) rispetto a `origin`. */
export function measureLines(root: HTMLElement, origin: HTMLElement): VisualLine[] {
  const o = origin.getBoundingClientRect();
  const rects: Rect[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent || !node.textContent.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP_SELECTOR)) continue;
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) {
      if (r.width === 0 && r.height === 0) continue;
      rects.push({ top: r.top - o.top, bottom: r.bottom - o.top });
    }
  }
  // formule a blocco: una riga ciascuna
  root.querySelectorAll('.nv-math-block').forEach((el) => {
    const r = el.getBoundingClientRect();
    rects.push({ top: r.top - o.top, bottom: r.bottom - o.top });
  });
  return clusterLines(rects).map((r, i) => ({ n: i + 1, top: r.top, bottom: r.bottom }));
}

export function lineAt(lines: VisualLine[], y: number): VisualLine | null {
  // ricerca binaria della riga che contiene y, altrimenti la piu' vicina
  let lo = 0;
  let hi = lines.length - 1;
  let best: VisualLine | null = null;
  let bestD = Infinity;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const l = lines[mid];
    if (y < l.top) hi = mid - 1;
    else if (y > l.bottom) lo = mid + 1;
    else return l;
    const d = Math.min(Math.abs(y - l.top), Math.abs(y - l.bottom));
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return bestD < 24 ? best : null;
}

// --- store delle righe correnti (gutter, commenti, "vai a riga")
let current: VisualLine[] = [];
let zoom = 1;
const listeners = new Set<() => void>();

/**
 * Le righe sono in pixel dello schermo (servono anche alla colonna dei Marginalia, fuori dalla
 * pagina); dentro la pagina, che ha lo zoom, vanno divise per `pageZoom()`.
 */
export function pageZoom(): number {
  return zoom;
}

export function setLines(lines: VisualLine[], pageScale = 1) {
  const zoomChanged = Math.abs(pageScale - zoom) > 0.001;
  zoom = pageScale;
  const same =
    !zoomChanged &&
    lines.length === current.length &&
    lines.every((l, i) => Math.abs(l.top - current[i].top) < 0.5 && Math.abs(l.bottom - current[i].bottom) < 0.5);
  if (same) return;
  current = lines;
  listeners.forEach((l) => l());
}

export function getLines(): VisualLine[] {
  return current;
}

export function useLines(): VisualLine[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
