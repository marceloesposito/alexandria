import { describe, it, expect } from 'vitest';
import { codexOrder, codexRoot, allCodices, neighbours, relinkAsChain, removeFromCodex, normalizeCodexSettings } from './model';
import type { Link } from '../resources/storage';

const d = (n: string) => `documents/${n}.md`;
let k = 0;
const L = (a: string, b: string): Link => ({ id: `l${k++}`, from: `doc:${d(a)}`, to: `doc:${d(b)}` });
const names = (xs: string[]) => xs.map((x) => x.replace('documents/', '').replace('.md', ''));
let n = 0;
const newId = () => `n${n++}`;

describe('Codex', () => {
  const links = [L('a', 'b'), L('b', 'c'), L('a', 'x'), { id: 'r', from: 'res1', to: `doc:${d('a')}` }, L('q', 'r')];
  it('legge in profondità nell\'ordine dei legami', () => {
    expect(names(codexOrder(links, d('a')))).toEqual(['a', 'b', 'c', 'x']);
  });
  it('trova la radice risalendo, anche da metà catena', () => {
    expect(names([codexRoot(links, d('c'))])).toEqual(['a']);
    expect(names([codexRoot(links, d('a'))])).toEqual(['a']);
  });
  it('i cicli non bloccano la lettura', () => {
    const cyc = [L('a', 'b'), L('b', 'c'), L('c', 'a')];
    expect(names(codexOrder(cyc, d('b')))).toEqual(['b', 'c', 'a']);
    expect(codexRoot(cyc, d('b'))).toBeTruthy();
  });
  it('elenca i Codex del Compendium, ignorando i legami con le risorse e le pergamene sparite', () => {
    expect(allCodices(links).map((c) => names(c.members))).toEqual([['a', 'b', 'c', 'x'], ['q', 'r']]);
    const exist = new Set([d('a'), d('b'), d('q')]);
    expect(allCodices(links, exist).map((c) => names(c.members))).toEqual([['a', 'b']]);
  });
  it('precedente e successiva', () => {
    const nb = neighbours(links, d('c'));
    expect(names([nb.prev!, nb.next!])).toEqual(['b', 'x']);
    expect(neighbours(links, d('x')).next).toBeNull();
  });
  it('riordinare riscrive i legami interni come catena e lascia gli altri', () => {
    const out = relinkAsChain(links, [d('c'), d('a'), d('b'), d('x')], newId);
    expect(names(codexOrder(out, d('c')))).toEqual(['c', 'a', 'b', 'x']);
    expect(out.some((l) => l.id === 'r')).toBe(true);
    expect(names(codexOrder(out, d('q')))).toEqual(['q', 'r']);
  });
  it('togliere una pergamena ricuce la catena', () => {
    const out = removeFromCodex(links, [d('a'), d('b'), d('c')], d('b'), newId);
    expect(names(codexOrder(out, d('a')))).toEqual(['a', 'x', 'c']);
  });
  it('impostazioni con valori predefiniti', () => {
    expect(normalizeCodexSettings(null, 'Tesi')).toEqual({ version: 1, name: 'Tesi', separator: 'pagebreak', titlesAsHeadings: false });
  });
});
