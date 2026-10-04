// Modello del documento: lo stesso JSON di TipTap/ProseMirror (JSONContent),
// con i nodi e le marcature che Alexandria sa scrivere in Markdown.

export interface PMMark {
  type: MarkType;
  attrs?: Record<string, unknown>;
}

export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  marks?: PMMark[];
  text?: string;
}

export type MarkType =
  | 'link'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'underline'
  | 'highlight'
  | 'subscript'
  | 'superscript'
  | 'code';

/** Ordine di annidamento in Markdown: il primo e' il piu' esterno. */
export const MARK_ORDER: MarkType[] = [
  'link',
  'bold',
  'italic',
  'strike',
  'underline',
  'highlight',
  'subscript',
  'superscript',
  'code',
];

export interface CitationItem {
  key: string;
  locator?: string; // "p. 12", "cap. 3"
  prefix?: string;
  suffix?: string;
  suppressAuthor?: boolean;
}

export type FigurePlacement = 'inline' | 'top' | 'bottom' | 'full';

export const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'taskList',
  'codeBlock',
  'horizontalRule',
  'figure',
  'mathBlock',
  'table',
  'pageBreak',
  'sectionBreak',
  'toc',
  'bibliography',
]);

export function emptyDoc(): PMNode {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function text(t: string, marks?: PMMark[]): PMNode {
  return marks && marks.length ? { type: 'text', text: t, marks } : { type: 'text', text: t };
}
