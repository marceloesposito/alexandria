// Sintassi delle citazioni di Pandoc: [@chiave, p. 12; vedi -@altra cap. 3]
// e dei collegamenti interni [[Pagina|alias]].
import type { CitationItem } from './types';

const KEY = String.raw`[\p{L}\p{N}_][\p{L}\p{N}_:.#$%&+?<>~/-]*`;
export const CITATION_RE = new RegExp(String.raw`\[([^\[\]]*?-?@${KEY}[^\[\]]*)\]`, 'gu');
export const WIKILINK_RE = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;
const ITEM_RE = new RegExp(String.raw`^(.*?)(-?)@(${KEY})(.*)$`, 'u');

// Etichette di locator riconosciute (italiano e inglese, come in Pandoc/CSL)
const LOCATOR_RE =
  /^,?\s*((?:pagg|pag|pp|p|capp|cap|chap|ch|sez|sec|vols|vol|nn|n|figg|fig|para|par|vv|v|ll|l|t|min)\.?\s*[\divxlcdm][\w\-–:.]*(?:\s*[-–]\s*\w+)?)\s*(.*)$/iu;

export function parseCitation(inner: string): CitationItem[] | null {
  const parts = inner.split(';');
  const items: CitationItem[] = [];
  for (const raw of parts) {
    const m = ITEM_RE.exec(raw.trim());
    if (!m) return null;
    const [, prefix, dash, key, rest] = m;
    const item: CitationItem = { key };
    if (prefix.trim()) item.prefix = prefix.trim();
    if (dash) item.suppressAuthor = true;
    const r = rest.trim();
    if (r) {
      const lm = LOCATOR_RE.exec(r);
      if (lm) {
        item.locator = lm[1].trim();
        if (lm[2].trim()) item.suffix = lm[2].trim();
      } else {
        item.suffix = r.replace(/^,\s*/, '');
      }
    }
    items.push(item);
  }
  return items.length ? items : null;
}

export function formatCitation(items: CitationItem[]): string {
  const parts = items.map((it) => {
    let s = '';
    if (it.prefix) s += it.prefix + ' ';
    s += (it.suppressAuthor ? '-@' : '@') + it.key;
    if (it.locator) s += ', ' + it.locator;
    if (it.suffix) s += (it.locator ? ' ' : ', ') + it.suffix;
    return s;
  });
  return `[${parts.join('; ')}]`;
}

/** Chiave di citazione leggibile da autore e anno: rossi2020, rossi2020a ... */
export function makeCiteKey(author: string, year: string | number | undefined, taken: Set<string>): string {
  const base =
    (author || 'anon')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20) || 'anon';
  const stem = `${base}${year ?? ''}`;
  if (!taken.has(stem)) return stem;
  for (let i = 0; i < 26 * 27; i++) {
    const suffix = i < 26 ? String.fromCharCode(97 + i) : String.fromCharCode(97 + Math.floor(i / 26) - 1) + String.fromCharCode(97 + (i % 26));
    if (!taken.has(stem + suffix)) return stem + suffix;
  }
  return stem + Date.now();
}
