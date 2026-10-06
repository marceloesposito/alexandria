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
  /** colore del testo (attrs: color, uno di TEXT_COLORS) */
  | 'textColor'
  | 'subscript'
  | 'superscript'
  | 'code'
  /** revisioni tracciate: testo proposto / testo da togliere (attrs: author, date) */
  | 'insertion'
  | 'deletion';

/** Ordine di annidamento in Markdown: il primo e' il piu' esterno. */
export const MARK_ORDER: MarkType[] = [
  'insertion',
  'deletion',
  'link',
  'bold',
  'italic',
  'strike',
  'underline',
  'textColor',
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
  'callout',
  'bulletList',
  'orderedList',
  'taskList',
  'codeBlock',
  'horizontalRule',
  'figure',
  'embed',
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

/**
 * Gli embed (schede di link e risorse) diventano paragrafi con un link: gli esportatori
 * non devono conoscerli e il testo esportato resta pulito.
 */
export function embedsToLinks(n: PMNode): PMNode {
  if (n.type === 'embed') {
    const href = String(n.attrs?.url ?? '');
    const text = String(n.attrs?.title || href);
    return { type: 'paragraph', content: text ? [{ type: 'text', text, marks: href ? [{ type: 'link', attrs: { href, title: null } }] : undefined }] : undefined };
  }
  return n.content ? { ...n, content: n.content.map(embedsToLinks) } : n;
}
