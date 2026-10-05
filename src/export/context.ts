// Contesto comune agli esportatori: impostazioni, citazioni gia' formattate, immagini e formule.
import type { DocSettings } from '../layout/model';
import type { CitationItem, PMNode } from '../doc/types';

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
  lang: 'it' | 'en';
  cite(items: CitationItem[]): CiteOut;
  image(src: string): ImageAsset | null;
  math(latex: string, display: boolean): MathAsset | null;
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
