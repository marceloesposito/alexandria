// Contesto comune agli esportatori: impostazioni, citazioni gia' formattate, immagini e formule.
import type { DocSettings } from '../layout/model';
import type { CitationItem, PMNode } from '../doc/types';
import type { ExportComment } from './comments';
import type { WritingLang } from '../i18n/writing';

export interface CiteOut {
  /** testo nel corpo (stili autore-data e numerici) oppure testo della nota (stili a note) */
  text: string;
  note: boolean;
}

export interface MathAsset {
  path: string;
  svg: string;
  widthEm: number;
  heightEm: number;
  depthEm: number;
}

export interface ImageAsset {
  path: string;
  data: Uint8Array;
  mime: string;
}

export interface ExportContext {
  settings: DocSettings;
  title: string;
  /** lingua di scrittura del Compendium */
  lang: WritingLang;
  cite(items: CitationItem[]): CiteOut;
  image(src: string): ImageAsset | null;
  math(latex: string, display: boolean): MathAsset | null;
  /** header con tipo e proprietà, se l'autore l'ha incluso nell'export */
  header?: ExportHeader;
  /** Marginalia da portare come commenti di Word (solo export .docx della pergamena aperta) */
  comments?: ExportComment[];
}

export interface ExportHeader {
  rows: { label: string; value: string }[];
  layout: 'line' | 'table' | 'block';
  align: 'left' | 'center';
}

/** Immagini e formule usate dal documento (note comprese), da preparare prima dell'export. */
export function collectAssets(doc: PMNode, footnoteDoc: (md: string) => PMNode) {
  const images = new Set<string>();
  const math = new Map<string, { latex: string; display: boolean }>();
  const walk = (n: PMNode) => {
    if (n.type === 'figure' && n.attrs?.src) images.add(String(n.attrs.src));
    if (n.type === 'mathBlock') math.set(mathKey(String(n.attrs?.latex ?? ''), true), { latex: String(n.attrs?.latex ?? ''), display: true });
    if (n.type === 'mathInline') math.set(mathKey(String(n.attrs?.latex ?? ''), false), { latex: String(n.attrs?.latex ?? ''), display: false });
    if (n.type === 'footnote' && n.attrs?.text) walk(footnoteDoc(String(n.attrs.text)));
    n.content?.forEach(walk);
  };
  walk(doc);
  return { images: [...images], math: [...math.values()] };
}

export function mathKey(latex: string, display: boolean): string {
  return `${display ? 1 : 0}${latex}`;
}
