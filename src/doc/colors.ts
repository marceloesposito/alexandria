// Colori del testo e dell'evidenziazione: una tavolozza con nomi, uguale nel Markdown
// (<span data-color="red">, <mark data-color="green">), nell'editor (token del tema) e negli export.

export const TEXT_COLORS = ['red', 'orange', 'green', 'blue', 'purple', 'grey'] as const;
export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange', 'purple'] as const;

export type TextColor = (typeof TEXT_COLORS)[number];
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export function isTextColor(x: unknown): x is TextColor {
  return (TEXT_COLORS as readonly unknown[]).includes(x);
}

export function isHighlightColor(x: unknown): x is HighlightColor {
  return (HIGHLIGHT_COLORS as readonly unknown[]).includes(x);
}

/** Colori di stampa (PDF, HTML, Word): gli stessi della serie dei token del tema chiaro. */
export const TEXT_HEX: Record<TextColor, string> = {
  red: '#a83a2c',
  orange: '#a8741a',
  green: '#3f7d4e',
  blue: '#3a6ea5',
  purple: '#8e4a8a',
  grey: '#5b5f6b',
};

export const HIGHLIGHT_HEX: Record<HighlightColor, string> = {
  yellow: '#f3dc8a',
  green: '#cfe5c8',
  blue: '#cfe0f2',
  pink: '#f4cfd9',
  orange: '#f6dcbc',
  purple: '#e3d3ee',
};

/** Evidenziatori di Word (accetta solo nomi fissi): il piu' vicino a ciascun colore. */
export const HIGHLIGHT_WORD: Record<HighlightColor, string> = {
  yellow: 'yellow',
  green: 'green',
  blue: 'cyan',
  pink: 'magenta',
  orange: 'yellow',
  purple: 'magenta',
};

/** Colore di un segno (evidenziazione o testo) se e' uno della tavolozza, altrimenti null. */
export function markColor(m: { type: string; attrs?: Record<string, unknown> }): string | null {
  const c = m.attrs?.color;
  if (m.type === 'highlight') return isHighlightColor(c) ? c : null;
  if (m.type === 'textColor') return isTextColor(c) ? c : null;
  return null;
}
