// Impostazioni del documento: stile di citazione e impaginazione (stile InDesign semplificato).
// Salvate in .alexandria/doc-settings/<doc>.json e usate da editor, anteprima ed export.

export type Paper = 'a4' | 'a5' | 'letter' | 'b5' | 'custom';
export type MasterId = 'title' | 'body' | 'appendix';
export type PageNumberPos = 'none' | 'bottom-center' | 'bottom-outer' | 'top-outer' | 'top-center';
export type ParaStyleId = 'body' | 'h1' | 'h2' | 'h3' | 'quote' | 'caption' | 'footnote';

export interface MasterPage {
  header: string; // testo con variabili {title} {author} {chapter} {page} {pages} {date}
  footer: string;
  pageNumbers: PageNumberPos;
  numbering: '1' | 'i' | 'I' | 'a';
  /** la prima pagina della sezione senza intestazione */
  firstPagePlain: boolean;
}

export interface ParaStyle {
  sizePt: number;
  weight: 'regular' | 'bold';
  italic: boolean;
  align: 'left' | 'center' | 'right' | 'justify' | 'inherit';
  spaceBeforePt: number;
  spaceAfterPt: number;
  indentFirstMm: number;
  leading: number | null; // null = quello del documento
  smallCaps: boolean;
}

export interface LayoutSettings {
  paper: Paper;
  widthMm: number;
  heightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginInnerMm: number;
  marginOuterMm: number;
  facingPages: boolean;
  columns: 1 | 2 | 3;
  columnGapMm: number;
  font: 'serif' | 'sans';
  fontSizePt: number;
  leading: number; // interlinea (multiplo del corpo)
  justify: boolean;
  hyphenate: boolean;
  /** righe minime prima/dopo un salto di pagina (vedove e orfane) */
  widowsOrphans: boolean;
  baselineGrid: boolean;
  lineNumbersInPdf: boolean;
  headingNumbers: boolean;
  masters: Record<MasterId, MasterPage>;
  styles: Record<ParaStyleId, ParaStyle>;
}

export interface DocSettings {
  version: 1;
  title: string;
  author: string;
  date: string;
  citationStyle: string; // id CSL
  citationLocale: string; // 'it-IT' | 'en-US' ...
  bibliographyTitle: string;
  layout: LayoutSettings;
}

export const PAPERS: Record<Exclude<Paper, 'custom'>, [number, number]> = {
  a4: [210, 297],
  a5: [148, 210],
  letter: [215.9, 279.4],
  b5: [176, 250],
};

const style = (p: Partial<ParaStyle>): ParaStyle => ({
  sizePt: 12,
  weight: 'regular',
  italic: false,
  align: 'inherit',
  spaceBeforePt: 0,
  spaceAfterPt: 0,
  indentFirstMm: 0,
  leading: null,
  smallCaps: false,
  ...p,
});

export function defaultLayout(): LayoutSettings {
  return {
    paper: 'a4',
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 25,
    marginBottomMm: 25,
    marginInnerMm: 25,
    marginOuterMm: 25,
    facingPages: false,
    columns: 1,
    columnGapMm: 8,
    font: 'serif',
    fontSizePt: 12,
    leading: 1.5,
    justify: true,
    hyphenate: true,
    widowsOrphans: true,
    baselineGrid: false,
    lineNumbersInPdf: false,
    headingNumbers: false,
    masters: {
      title: { header: '', footer: '', pageNumbers: 'none', numbering: '1', firstPagePlain: true },
      body: { header: '{title}', footer: '', pageNumbers: 'bottom-center', numbering: '1', firstPagePlain: true },
      appendix: { header: '{title}', footer: '', pageNumbers: 'bottom-center', numbering: '1', firstPagePlain: false },
    },
    styles: {
      body: style({ sizePt: 12, spaceAfterPt: 0, indentFirstMm: 0 }),
      h1: style({ sizePt: 20, weight: 'bold', spaceBeforePt: 18, spaceAfterPt: 10 }),
      h2: style({ sizePt: 15, weight: 'bold', spaceBeforePt: 14, spaceAfterPt: 8 }),
      h3: style({ sizePt: 13, weight: 'bold', italic: false, spaceBeforePt: 12, spaceAfterPt: 6 }),
      quote: style({ sizePt: 11, italic: false, spaceBeforePt: 6, spaceAfterPt: 6, indentFirstMm: 0 }),
      caption: style({ sizePt: 10, italic: true, align: 'center', spaceBeforePt: 4, spaceAfterPt: 10 }),
      footnote: style({ sizePt: 9.5 }),
    },
  };
}

export function defaultDocSettings(lang: 'it' | 'en' = 'it'): DocSettings {
  return {
    version: 1,
    title: '',
    author: '',
    date: '',
    citationStyle: 'apa',
    citationLocale: lang === 'it' ? 'it-IT' : 'en-US',
    bibliographyTitle: lang === 'it' ? 'Bibliografia' : 'References',
    layout: defaultLayout(),
  };
}

/** Unisce impostazioni salvate (anche di versioni vecchie) con i valori predefiniti. */
export function normalizeDocSettings(raw: unknown, lang: 'it' | 'en' = 'it'): DocSettings {
  const d = defaultDocSettings(lang);
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<DocSettings>;
  const l = (r.layout ?? {}) as Partial<LayoutSettings>;
  const masters = { ...d.layout.masters };
  for (const k of Object.keys(masters) as MasterId[]) masters[k] = { ...masters[k], ...(l.masters?.[k] ?? {}) };
  const styles = { ...d.layout.styles };
  for (const k of Object.keys(styles) as ParaStyleId[]) styles[k] = { ...styles[k], ...(l.styles?.[k] ?? {}) };
  return { ...d, ...r, version: 1, layout: { ...d.layout, ...l, masters, styles } };
}

export function withPaper(l: LayoutSettings, paper: Paper): LayoutSettings {
  if (paper === 'custom') return { ...l, paper };
  const [w, h] = PAPERS[paper];
  return { ...l, paper, widthMm: w, heightMm: h };
}

export interface PageMetrics {
  textWidthMm: number;
  textHeightMm: number;
  padXmm: number;
  /** righe di corpo per pagina e parole per pagina stimate */
  linesPerPage: number;
  wordsPerPage: number;
}

export function pageMetrics(l: LayoutSettings): PageMetrics {
  const textWidthMm = Math.max(40, l.widthMm - l.marginInnerMm - l.marginOuterMm);
  const textHeightMm = Math.max(40, l.heightMm - l.marginTopMm - l.marginBottomMm);
  const lineMm = (l.fontSizePt * l.leading * 25.4) / 72;
  const linesPerPage = Math.floor(textHeightMm / lineMm);
  // circa 0.5 em per carattere medio, 6 caratteri per parola con lo spazio
  const charsPerLine = (textWidthMm / ((l.fontSizePt * 25.4) / 72 / 2)) * l.columns * 0.98;
  const wordsPerPage = Math.max(50, Math.round((linesPerPage * charsPerLine) / 6.1));
  return {
    textWidthMm: l.columns > 1 ? textWidthMm : textWidthMm,
    textHeightMm,
    padXmm: Math.max(18, (l.marginInnerMm + l.marginOuterMm) / 2),
    linesPerPage,
    wordsPerPage,
  };
}
