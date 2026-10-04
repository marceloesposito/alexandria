import { describe, it, expect } from 'vitest';
import { isVisible, membersOf, matchRule, layerOn, isLocked, timeLocator, yearOf, type Layer, type Resource } from './model';

function res(p: Partial<Resource>): Resource {
  return {
    id: p.id ?? 'x',
    kind: p.kind ?? 'pdf',
    title: p.title ?? 'T',
    csl: p.csl ?? null,
    citeKey: null,
    isSource: p.isSource ?? false,
    tags: p.tags ?? [],
    layers: p.layers ?? [],
    created: '',
    meta: {},
    pins: p.pins ?? [],
    url: p.url,
  };
}

const halb = res({ id: 'a', tags: ['memoria'], isSource: true, csl: { author: [{ family: 'Halbwachs', given: 'Maurice' }], issued: { 'date-parts': [[1950]] } }, layers: ['g1'] });
const nora = res({ id: 'b', tags: ['Memoria', 'luoghi'], isSource: true, csl: { author: [{ family: 'Nora' }], issued: { 'date-parts': [['1984']] } }, layers: ['g2'] });
const img = res({ id: 'c', kind: 'image', tags: ['ispirazione'], layers: ['g1'] });
const web = res({ id: 'd', kind: 'web', url: 'https://www.treccani.it/x', layers: [] });
const all = [halb, nora, img, web];

const layers: Layer[] = [
  { id: 'g1', name: 'Capitolo 1', parent: null, color: 'var(--series-1)', visible: true, locked: false, kind: 'group' },
  { id: 'g2', name: 'Sezione', parent: 'g1', color: 'var(--series-2)', visible: true, locked: false, kind: 'group' },
  {
    id: 'f1',
    name: 'Fonti recenti',
    parent: null,
    color: 'var(--series-3)',
    visible: true,
    locked: false,
    kind: 'filter',
    rule: { match: 'all', conditions: [{ field: 'source', op: 'is', value: 'true' }, { field: 'year', op: 'gte', value: '1980' }] },
  },
];

describe('filtri', () => {
  it('regole sulle proprieta', () => {
    expect(matchRule(nora, layers[2].rule!)).toBe(true);
    expect(matchRule(halb, layers[2].rule!)).toBe(false);
    expect(matchRule(img, { match: 'any', conditions: [{ field: 'kind', op: 'is', value: 'image' }] })).toBe(true);
    expect(matchRule(halb, { match: 'all', conditions: [{ field: 'tag', op: 'is', value: 'MEMORIA' }] })).toBe(true);
    expect(matchRule(web, { match: 'all', conditions: [{ field: 'domain', op: 'is', value: 'treccani.it' }] })).toBe(true);
    expect(matchRule(halb, { match: 'all', conditions: [{ field: 'author', op: 'is', value: 'halbwachs' }] })).toBe(true);
    expect(matchRule(halb, { match: 'all', conditions: [] })).toBe(false);
  });

  it('anno da stringa', () => {
    expect(yearOf(nora)).toBe(1984);
  });
});

describe('layer stile AutoCAD', () => {
  it('membri di un gruppo includono i sottogruppi', () => {
    expect(membersOf(layers[0], layers, all).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(membersOf(layers[2], layers, all).map((r) => r.id)).toEqual(['b']);
  });

  it('spegnere un genitore spegne i figli', () => {
    const off = layers.map((l) => (l.id === 'g1' ? { ...l, visible: false } : l));
    expect(layerOn(off, 'g2')).toBe(false);
    expect(isVisible(nora, off, null, all)).toBe(false);
    expect(isVisible(web, off, null, all)).toBe(true);
  });

  it('filtro spento nasconde chi lo soddisfa', () => {
    const off = layers.map((l) => (l.id === 'f1' ? { ...l, visible: false } : l));
    expect(isVisible(nora, off, null, all)).toBe(false);
    expect(isVisible(halb, off, null, all)).toBe(true);
  });

  it('layer attivo: si vedono solo i suoi membri', () => {
    expect(all.filter((r) => isVisible(r, layers, 'g2', all)).map((r) => r.id)).toEqual(['b']);
    expect(all.filter((r) => isVisible(r, layers, 'f1', all)).map((r) => r.id)).toEqual(['b']);
  });

  it('blocco ereditato', () => {
    const locked = layers.map((l) => (l.id === 'g1' ? { ...l, locked: true } : l));
    expect(isLocked(nora, locked)).toBe(true);
    expect(isLocked(web, locked)).toBe(false);
  });
});

describe('locator', () => {
  it('tempo in minuti e secondi', () => {
    expect(timeLocator(75)).toBe('1:15');
    expect(timeLocator(3725)).toBe('1:02:05');
  });
});
