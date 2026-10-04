// Conteggi del testo: battute (con e senza spazi), parole, paragrafi, cartelle, pagine stimate.
import type { PMNode } from './types';

export interface Counts {
  chars: number; // battute con spazi
  charsNoSpaces: number;
  words: number;
  paragraphs: number;
  /** cartelle editoriali da 1800 battute (uso italiano) */
  cartelle: number;
  /** pagine stimate: dal numero reale dell'anteprima se noto, altrimenti da parole per pagina */
  pages: number;
  readingMinutes: number;
}

const WORD_RE = /[\p{L}\p{N}]+(?:[’'\-.][\p{L}\p{N}]+)*/gu;

export function countText(text: string, wordsPerPage = 300): Omit<Counts, 'paragraphs'> {
  // grapheme: le lettere accentate composte contano una battuta
  const norm = text.normalize('NFC');
  const chars = [...norm.replace(/\n/g, '')].length;
  const charsNoSpaces = [...norm.replace(/\s/g, '')].length;
  const words = norm.match(WORD_RE)?.length ?? 0;
  return {
    chars,
    charsNoSpaces,
    words,
    cartelle: Math.round((chars / 1800) * 10) / 10,
    pages: words === 0 ? 0 : Math.max(1, Math.ceil(words / wordsPerPage)),
    readingMinutes: Math.max(words ? 1 : 0, Math.round(words / 230)),
  };
}

/** Testo leggibile di un blocco (con il testo delle note e delle formule escluso dal corpo). */
export function plainText(node: PMNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'footnote' || node.type === 'mathInline' || node.type === 'citation') return '';
  if (node.type === 'wikilink') return String(node.attrs?.alias || node.attrs?.target || '');
  return (node.content ?? []).map(plainText).join('');
}

/** Blocchi di testo (paragrafi, titoli, voci) in ordine, per conteggi e ricerca. */
export function textBlocks(doc: PMNode): string[] {
  const out: string[] = [];
  const walk = (n: PMNode) => {
    if (n.type === 'paragraph' || n.type === 'heading' || n.type === 'codeBlock') {
      out.push(plainText(n));
      return;
    }
    if (n.type === 'figure') {
      if (n.attrs?.caption) out.push(String(n.attrs.caption));
      return;
    }
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  return out;
}

export function countDoc(doc: PMNode, wordsPerPage = 300): Counts {
  const blocks = textBlocks(doc);
  const base = countText(blocks.join('\n'), wordsPerPage);
  return { ...base, paragraphs: blocks.filter((b) => b.trim()).length };
}
