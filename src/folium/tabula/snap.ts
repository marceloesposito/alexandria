// Aggancio della Tabula flottante, come quello delle finestre di Windows: metà sinistra o destra,
// quadranti negli angoli, tutto lo spazio in alto. Poco sensibile: la zona si attiva solo col
// puntatore molto vicino al bordo e fermo per un attimo (`armed`), cosi' la finestra si sposta
// liberamente. Funzioni pure; la finestra e' in frazioni dello spazio disponibile (0..1).

export type SnapZone = 'left' | 'right' | 'top' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapOptions {
  /** distanza dal bordo (px) entro cui il puntatore entra in una zona */
  edge: number;
  /** lato degli angoli (px) che valgono come quadrante */
  corner: number;
  /** tempo (ms) da fermo vicino al bordo prima che l'aggancio si armi */
  dwell: number;
  /** spostamento (px) oltre il quale il puntatore non e' piu' "fermo" */
  still: number;
}

export const SNAP: SnapOptions = { edge: 10, corner: 90, dwell: 280, still: 6 };

/** Zona sotto il puntatore (coordinate dentro lo spazio di larghezza w e altezza h), o null. */
export function zoneAt(px: number, py: number, w: number, h: number, o: SnapOptions = SNAP): SnapZone | null {
  const left = px <= o.edge;
  const right = px >= w - o.edge;
  const top = py <= o.edge;
  const bottom = py >= h - o.edge;
  const nearTop = py <= o.corner;
  const nearBottom = py >= h - o.corner;
  const nearLeft = px <= o.corner;
  const nearRight = px >= w - o.corner;
  if ((left && nearTop) || (top && nearLeft)) return 'top-left';
  if ((right && nearTop) || (top && nearRight)) return 'top-right';
  if ((left && nearBottom) || (bottom && nearLeft)) return 'bottom-left';
  if ((right && nearBottom) || (bottom && nearRight)) return 'bottom-right';
  if (left) return 'left';
  if (right) return 'right';
  if (top) return 'top';
  return null;
}

/** Riquadro (in frazioni) di una zona. */
export function zoneFrame(z: SnapZone): Frame {
  switch (z) {
    case 'left':
      return { x: 0, y: 0, w: 0.5, h: 1 };
    case 'right':
      return { x: 0.5, y: 0, w: 0.5, h: 1 };
    case 'top':
      return { x: 0, y: 0, w: 1, h: 1 };
    case 'top-left':
      return { x: 0, y: 0, w: 0.5, h: 0.5 };
    case 'top-right':
      return { x: 0.5, y: 0, w: 0.5, h: 0.5 };
    case 'bottom-left':
      return { x: 0, y: 0.5, w: 0.5, h: 0.5 };
    case 'bottom-right':
      return { x: 0.5, y: 0.5, w: 0.5, h: 0.5 };
  }
}

/**
 * Stato dell'aggancio durante il trascinamento. Si arma solo dopo `dwell` ms nella stessa zona
 * senza spostarsi piu' di `still` px; uscire dalla zona lo disarma.
 */
export interface SnapState {
  zone: SnapZone | null;
  since: number;
  at: { x: number; y: number } | null;
  armed: boolean;
}

export const NO_SNAP: SnapState = { zone: null, since: 0, at: null, armed: false };

export function trackSnap(prev: SnapState, px: number, py: number, w: number, h: number, now: number, o: SnapOptions = SNAP): SnapState {
  const zone = zoneAt(px, py, w, h, o);
  if (!zone) return NO_SNAP;
  const moved = !prev.at || Math.hypot(px - prev.at.x, py - prev.at.y) > o.still;
  if (zone !== prev.zone || (moved && !prev.armed)) return { zone, since: now, at: { x: px, y: py }, armed: false };
  return { ...prev, armed: prev.armed || now - prev.since >= o.dwell };
}

/** Finestra libera: dentro lo spazio, non piu' piccola del minimo. */
export function clampFrame(f: Frame, minW = 0.18, minH = 0.2): Frame {
  const w = Math.min(1, Math.max(minW, f.w));
  const h = Math.min(1, Math.max(minH, f.h));
  return { x: Math.min(1 - w, Math.max(0, f.x)), y: Math.min(1 - h, Math.max(0, f.y)), w, h };
}

/**
 * Staccare una finestra agganciata: torna alle misure di prima e resta sotto il puntatore nello
 * stesso punto relativo della barra, come in Windows.
 */
export function unsnap(free: Frame, snapped: Frame, px: number, py: number): Frame {
  const rel = snapped.w > 0 ? (px - snapped.x) / snapped.w : 0.5;
  return clampFrame({ x: px - rel * free.w, y: py - 0.01, w: free.w, h: free.h });
}

/** Quasi tutta l'altezza: la Tabula sta accanto al testo come un foglio appoggiato al bordo. */
export const DEFAULT_FRAME: Frame = { x: 0.52, y: 0.02, w: 0.42, h: 0.96 };

// ---------------------------------------------------------------- parcheggio oltre il bordo
// "Chiusa", la Tabula non sparisce: scorre oltre il bordo sinistro e ne resta fuori solo una
// striscia, che si afferra per tirarla di nuovo dentro. E' sempre la stessa finestra che si sposta.

/** Finestra parcheggiata: stesse misure, fuori a sinistra tranne una striscia larga `sliver`. */
export function parkedFrame(f: Frame, sliver: number): Frame {
  return { ...f, x: -f.w + sliver };
}

/** Durante il trascinamento la finestra puo' uscire a sinistra fino a lasciare la sola striscia. */
export function dragClamp(f: Frame, sliver: number): Frame {
  const w = Math.min(1, f.w);
  const h = Math.min(1, f.h);
  return { x: Math.min(1 - w, Math.max(-w + sliver, f.x)), y: Math.min(1 - h, Math.max(0, f.y)), w, h };
}

/** Parte visibile della larghezza (0..1 della finestra stessa). */
export function visibleShare(f: Frame): number {
  return f.w > 0 ? Math.max(0, Math.min(f.x + f.w, 1) - Math.max(f.x, 0)) / f.w : 0;
}

/** Al rilascio: oltre il bordo per piu' di meta' si parcheggia, altrimenti resta (tutta dentro). */
export function shouldPark(f: Frame): boolean {
  return visibleShare(f) < 0.5;
}
