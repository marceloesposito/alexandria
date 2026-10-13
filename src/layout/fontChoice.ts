// Scelta del carattere del documento: id di TEXT_FONTS -> impostazioni del Layout. `font` (serif/sans)
// segue la scelta, perche' lo usano le stime e i documenti aperti con versioni vecchie dell'app.
import { textFont, type LayoutSettings } from 'logos/layout/model';

const SANS = new Set(['inter', 'helvetica', 'arial', 'verdana', 'sans-serif']);

export function withFont(id: string): Partial<LayoutSettings> {
  const f = textFont(id);
  if (!f) return {};
  return { fontFamily: f.id, font: SANS.has(f.id) ? 'sans' : 'serif' };
}

/** Corpo del testo: quello del documento e dello stile "corpo" insieme (come in Layout > Testo). */
export function withFontSize(L: LayoutSettings, pt: number): Partial<LayoutSettings> {
  const v = Math.max(6, Math.min(36, Math.round(pt * 2) / 2));
  return { fontSizePt: v, styles: { ...L.styles, body: { ...L.styles.body, sizePt: v } } };
}
