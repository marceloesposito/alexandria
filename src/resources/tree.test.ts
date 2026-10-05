import { describe, expect, it } from 'vitest';
import { matchesQuery, sortResources, directMembers, ungrouped, layerHasMatch } from './tree';
import type { Layer, Resource } from './model';

const res = (id: string, p: Partial<Resource> = {}): Resource => ({
  id,
  kind: 'pdf',
  title: id,
  csl: null,
  citeKey: null,
  isSource: false,
  tags: [],
  layers: [],
  created: '2026-01-01T00:00:00Z',
  meta: {},
  pins: [],
  ...p,
});

const layer = (id: string, p: Partial<Layer> = {}): Layer => ({ id, name: id, parent: null, color: '', visible: true, locked: false, kind: 'group', ...p });

const eco = res('a', { title: 'Opera aperta', csl: { author: [{ family: 'Eco', given: 'Umberto' }], issued: { 'date-parts': [[1962]] } }, tags: ['semiotica'] });
const calvino = res('b', { title: 'Lezioni americane', csl: { author: [{ family: 'Calvino', given: 'Italo' }], issued: { 'date-parts': [[1988]] } }, created: '2026-03-01T00:00:00Z' });
const anon = res('c', { title: 'appunti', kind: 'snippet', created: '2026-02-01T00:00:00Z' });

describe('albero della Bookshelf', () => {
  it('filtra per titolo, autore e tag, anche con piu parole', () => {
    expect(matchesQuery(eco, 'eco')).toBe(true);
    expect(matchesQuery(eco, 'SEMIOTICA')).toBe(true);
    expect(matchesQuery(eco, 'opera umberto')).toBe(true);
    expect(matchesQuery(eco, 'calvino')).toBe(false);
    expect(matchesQuery(eco, '  ')).toBe(true);
  });

  it('ordina per titolo, data di aggiunta, autore, anno e tipo', () => {
    const list = [eco, calvino, anon];
    expect(sortResources(list, 'title').map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(sortResources(list, 'added').map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(sortResources(list, 'author').map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(sortResources(list, 'year').map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(sortResources(list, 'kind').map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('un gruppo mostra le sue risorse, un filtro quelle che soddisfano la regola', () => {
    const g = layer('g');
    const f = layer('f', { kind: 'filter', rule: { match: 'all', conditions: [{ field: 'tag', op: 'is', value: 'semiotica' }] } });
    const inG = { ...calvino, layers: ['g'] };
    expect(directMembers(g, [eco, inG, anon]).map((r) => r.id)).toEqual(['b']);
    expect(directMembers(f, [eco, inG, anon]).map((r) => r.id)).toEqual(['a']);
    expect(ungrouped([eco, inG, anon], [g, f]).map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('durante la ricerca un gruppo resta se un sottogruppo ha risultati', () => {
    const parent = layer('p');
    const child = layer('k', { parent: 'p' });
    const inChild = { ...eco, layers: ['k'] };
    expect(layerHasMatch(parent, [parent, child], [inChild, calvino], 'eco')).toBe(true);
    expect(layerHasMatch(parent, [parent, child], [inChild, calvino], 'calvino')).toBe(false);
  });
});
