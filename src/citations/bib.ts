// Import ed export di bibliografie (BibTeX, RIS, CSL-JSON) con citation-js.
import { Cite } from '@citation-js/core';
import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-ris';
import type { CslItem } from '../resources/model';

/** Voci CSL da un testo BibTeX, RIS o CSL-JSON. La chiave originale resta in `citation-key`. */
export function parseBibliography(text: string): CslItem[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const cite = new Cite(trimmed);
  return (cite.data as unknown as CslItem[]).map((it) => {
    const copy = { ...it } as CslItem & { _graph?: unknown };
    delete copy._graph;
    return copy;
  });
}

/** BibTeX delle voci date (id = chiave di citazione). */
export function toBibtex(items: (CslItem & { id: string })[]): string {
  if (!items.length) return '';
  // la chiave BibTeX e' quella usata nel testo ([@chiave])
  const withKeys = items.map((it) => ({ ...it, 'citation-key': it.id }));
  return new Cite(withKeys as unknown as ConstructorParameters<typeof Cite>[0]).format('bibtex', { format: 'text' });
}
