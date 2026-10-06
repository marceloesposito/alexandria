// Fonte per esteso in una nota a piè di pagina: la voce di bibliografia seguita dal punto citato.
// Funzione pura.
import { parseLocator } from './engine';
import type { CitationItem } from '../doc/types';

/** "Autore, Titolo, Editore, 2020" + ", p. 12" (il punto finale della voce si sposta in fondo). */
export function fullNote(items: CitationItem[], entry: (key: string) => string | null): string {
  return items
    .map((it) => {
      const ref = (entry(it.key) ?? `@${it.key}`).replace(/\s+/g, ' ').trim().replace(/\.$/, '');
      const loc = parseLocator(it.locator);
      const where = loc.locator ? (loc.label === 'page' ? `p. ${loc.locator}` : `${it.locator}`) : loc.suffix ?? '';
      return [it.prefix?.trim(), ref, where].filter(Boolean).join(', ');
    })
    .join('; ')
    .concat('.');
}
