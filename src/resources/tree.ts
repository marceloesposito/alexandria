// Albero della Bookshelf: quali risorse stanno sotto ogni layer, filtro testuale e ordinamento.
import { authorsOf, yearOf, matchRule, type Layer, type Resource } from './model';

export type ResourceSort = 'title' | 'added' | 'author' | 'year' | 'kind';

export const RESOURCE_SORTS: ResourceSort[] = ['title', 'added', 'author', 'year', 'kind'];

/** Il testo cercato compare nel titolo, negli autori, nella chiave, nei tag o nel dominio. */
export function matchesQuery(r: Resource, q: string): boolean {
  const k = q.trim().toLowerCase();
  if (!k) return true;
  const hay = [r.title, r.citeKey ?? '', r.url ?? '', ...authorsOf(r), ...r.tags, r.meta.language ?? ''].join(' ').toLowerCase();
  return k.split(/\s+/).every((w) => hay.includes(w));
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function sortResources(list: Resource[], by: ResourceSort): Resource[] {
  const title = (a: Resource, b: Resource) => collator.compare(a.title, b.title);
  const cmp: Record<ResourceSort, (a: Resource, b: Resource) => number> = {
    title,
    // le piu' recenti in alto
    added: (a, b) => b.created.localeCompare(a.created) || title(a, b),
    author: (a, b) => {
      const x = authorsOf(a)[0];
      const y = authorsOf(b)[0];
      if (!x !== !y) return x ? -1 : 1; // senza autore in fondo
      return collator.compare(x ?? '', y ?? '') || title(a, b);
    },
    year: (a, b) => {
      const x = yearOf(a);
      const y = yearOf(b);
      if ((x === null) !== (y === null)) return x === null ? 1 : -1;
      return (y ?? 0) - (x ?? 0) || title(a, b);
    },
    kind: (a, b) => a.kind.localeCompare(b.kind) || title(a, b),
  };
  return [...list].sort(cmp[by]);
}

/** Risorse mostrate direttamente sotto un layer: per un gruppo quelle assegnate a lui (non ai sottogruppi), per un filtro chi soddisfa la regola. */
export function directMembers(layer: Layer, resources: Resource[], texts?: Map<string, string>): Resource[] {
  if (layer.kind === 'filter') return layer.rule ? resources.filter((r) => matchRule(r, layer.rule!, texts?.get(r.id))) : [];
  return resources.filter((r) => r.layers.includes(layer.id));
}

/** Risorse che non stanno in nessun gruppo (i filtri non contano: sono viste, non contenitori). */
export function ungrouped(resources: Resource[], layers: Layer[]): Resource[] {
  const groups = new Set(layers.filter((l) => l.kind === 'group').map((l) => l.id));
  return resources.filter((r) => !r.layers.some((id) => groups.has(id)));
}

/** Un layer resta visibile durante una ricerca se lui o un discendente ha risorse che corrispondono. */
export function layerHasMatch(layer: Layer, layers: Layer[], resources: Resource[], q: string, texts?: Map<string, string>): boolean {
  if (directMembers(layer, resources, texts).some((r) => matchesQuery(r, q))) return true;
  return layers.filter((l) => l.parent === layer.id).some((c) => layerHasMatch(c, layers, resources, q, texts));
}
