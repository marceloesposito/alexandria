// Posizione della barretta flottante: libera dove la si lascia (in frazioni della finestra, cosi'
// regge al ridimensionamento) oppure agganciata alla barra in alto. Trascinata vicino alla barra in
// alto e' magnetica: entro `MAGNET` px dal suo bordo inferiore si aggancia da sola. Funzioni pure.

export interface BarPos {
  /** agganciata alla barra in alto */
  docked: boolean;
  /** centro orizzontale e bordo superiore, in frazioni della finestra; null = in basso al centro */
  x: number | null;
  y: number | null;
}

export const DEFAULT_BAR: BarPos = { docked: false, x: null, y: null };

/** Distanza (px) dal bordo inferiore della barra in alto entro cui la barretta si aggancia. */
export const MAGNET = 36;

/** Margine (px) dai bordi della finestra per la barretta libera. */
export const EDGE = 8;

export function normalizeBar(raw: unknown): BarPos {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<BarPos>;
  const frac = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);
  return { docked: r.docked === true, x: frac(r.x), y: frac(r.y) };
}

/** La barretta trascinata con il bordo superiore a `top` (px) va agganciata? */
export function shouldDock(top: number, headerH: number, magnet = MAGNET): boolean {
  return top <= headerH + magnet;
}

/**
 * Posizione libera (px del bordo superiore sinistro) tenuta dentro la finestra e sotto la barra in
 * alto, per una barretta larga w e alta h in una finestra W x H.
 */
export function clampBar(left: number, top: number, w: number, h: number, W: number, H: number, headerH: number): { left: number; top: number } {
  return {
    left: Math.min(Math.max(EDGE, W - w - EDGE), Math.max(EDGE, left)),
    top: Math.min(Math.max(headerH + EDGE, H - h - EDGE), Math.max(headerH + EDGE, top)),
  };
}

/** Px -> frazioni (centro orizzontale, bordo superiore). */
export function toBarPos(left: number, top: number, w: number, W: number, H: number): BarPos {
  return { docked: false, x: W > 0 ? (left + w / 2) / W : 0.5, y: H > 0 ? top / H : 1 };
}

/** Frazioni -> px del bordo superiore sinistro (null = in basso al centro). */
export function fromBarPos(p: BarPos, w: number, h: number, W: number, H: number, headerH: number, bottomGap = 16): { left: number; top: number } {
  const left = p.x === null ? W / 2 - w / 2 : p.x * W - w / 2;
  const top = p.y === null ? H - h - bottomGap : p.y * H;
  return clampBar(left, top, w, h, W, H, headerH);
}

/** I menu della barretta si aprono verso il centro: sotto se sta nella meta' alta, sopra altrimenti. */
export function popoverSide(p: BarPos): 'above' | 'below' {
  if (p.docked) return 'below';
  return p.y !== null && p.y < 0.5 ? 'below' : 'above';
}
