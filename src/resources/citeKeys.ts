// Chiave di citazione disponibile subito (anche durante un trascinamento): se la risorsa non e'
// ancora una fonte, la diventa e la chiave si salva in background.
import { useResources } from './store';
import { makeCiteKey } from '../doc/citeSyntax';
import { firstAuthorFamily, yearOf, type Resource } from './model';

export function ensureCiteKey(r: Resource): string {
  if (r.citeKey) {
    if (!r.isSource) void useResources.getState().update(r.id, { isSource: true });
    return r.citeKey;
  }
  const st = useResources.getState();
  const taken = new Set([...st.resources, ...st.libraryItems].map((x) => x.citeKey).filter(Boolean) as string[]);
  const name = firstAuthorFamily(r) || r.title.split(/\s+/).find((w) => w.length > 3) || 'fonte';
  const key = makeCiteKey(name, yearOf(r) ?? undefined, taken);
  void st.update(r.id, { isSource: true, citeKey: key });
  return key;
}
