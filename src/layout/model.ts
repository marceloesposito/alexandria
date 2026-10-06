// Impostazioni del documento: stile di citazione e impaginazione (stile InDesign semplificato).
// Salvate in .alexandria/doc-settings/<doc>.json e usate da editor, anteprima ed export.
import { type ObjectData, type HeaderSettings, emptyObject, defaultHeader, normalizeObject, normalizeHeader } from '../types/model';

export type Paper = 'a4' | 'a5' | 'letter' | 'b5' | 'custom';
/** master page: 'title', 'body', 'appendix' predefinite, piu' quelle create dall'utente */
export type MasterId = string;
export const BUILTIN_MASTERS = ['title', 'body', 'appendix'] as const;
export type PageNumberPos = 'none' | 'bottom-center' | 'bottom-outer' | 'top-outer' | 'top-center';
export type ParaStyleId = 'body' | 'h1' | 'h2' | 'h3' | 'quote' | 'caption' | 'footnote';

export interface MasterPage {
  /** nome scelto dall'utente (le predefinite usano la traduzione) */
  name?: string;
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
  /** indice dei contenuti in testa all'export (se la pergamena non ne ha gia' uno) */
  tocInExport: boolean;
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
  /** tipo e proprietà della pergamena (il testo .md non cambia) */
  object: ObjectData;
  /** header con tipo e proprietà: dove compare e come */
  header: HeaderSettings;
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
    tocInExport: false,
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
    object: emptyObject(),
    header: defaultHeader(),
  };
}

/** Unisce impostazioni salvate (anche di versioni vecchie) con i valori predefiniti. */
export function normalizeDocSettings(raw: unknown, lang: 'it' | 'en' = 'it'): DocSettings {
  const d = defaultDocSettings(lang);
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<DocSettings>;
  const l = (r.layout ?? {}) as Partial<LayoutSettings>;
  // le predefinite completano quelle salvate; le master create dall'utente restano
  const masters: Record<MasterId, MasterPage> = { ...d.layout.masters };
  for (const [k, m] of Object.entries(l.masters ?? {})) masters[k] = { ...(masters[k] ?? masters.body), ...m };
  const styles = { ...d.layout.styles };
  for (const k of Object.keys(styles) as ParaStyleId[]) styles[k] = { ...styles[k], ...(l.styles?.[k] ?? {}) };
  return { ...d, ...r, version: 1, layout: { ...d.layout, ...l, masters, styles }, object: normalizeObject(r.object), header: normalizeHeader(r.header) };
}

/** Nuova master page copiata da un'altra (di solito il corpo); restituisce anche il suo id. */
export function addMaster(l: LayoutSettings, name: string, from: MasterId = 'body'): { layout: LayoutSettings; id: MasterId } {
  const base = l.masters[from] ?? l.masters.body;
  let n = 1;
  while (l.masters[`m${n}`]) n++;
  const id = `m${n}`;
  return { layout: { ...l, masters: { ...l.masters, [id]: { ...base, name } } }, id };
}

export function renameMaster(l: LayoutSettings, id: MasterId, name: string): LayoutSettings {
  if (!l.masters[id]) return l;
  return { ...l, masters: { ...l.masters, [id]: { ...l.masters[id], name } } };
}

/** Il corpo non si elimina: e' la master di ripiego per le sezioni rimaste senza. */
export function removeMaster(l: LayoutSettings, id: MasterId): LayoutSettings {
  if (id === 'body' || !l.masters[id]) return l;
  const masters = { ...l.masters };
  delete masters[id];
  return { ...l, masters };
}

/** Master usata davvero: quella chiesta, o il corpo se non esiste piu'. */
export function resolveMaster(l: LayoutSettings, id: MasterId | undefined): MasterPage {
  return (id && l.masters[id]) || l.masters.body;
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
