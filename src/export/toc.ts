// Indice dei contenuti nell'export: se la pergamena non ha gia' un blocco indice, se ne mette uno
// in testa al documento esportato (il .md non cambia).
import type { PMNode } from '../doc/types';

export function hasToc(doc: PMNode): boolean {
  return doc.type === 'toc' || (doc.content ?? []).some(hasToc);
}

export function withToc(doc: PMNode): PMNode {
  if (hasToc(doc)) return doc;
  return { ...doc, content: [{ type: 'toc' }, ...(doc.content ?? [])] };
}
