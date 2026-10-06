import { describe, it, expect } from 'vitest';
import { buildGraph, citedKeys } from './graphModel';
import type { Resource } from './model';

const res = (id: string, p: Partial<Resource>): Resource => ({
  id,
  kind: 'pdf',
  title: id,
  csl: null,
  citeKey: null,
  isSource: false,
  tags: [],
  layers: [],
  created: '',
  meta: {},
  pins: [],
  ...p,
});

describe('grafo', () => {
  it('chiavi citate', () => {
    expect([...citedKeys('Vedi [@a, p. 2; -@b] e [mail@x.it] ma non @c.')]).toEqual(['a', 'b', 'x.it']);
  });

  it('citazioni, wikilink, url, collegamenti e tag', () => {
    const docs = [
      { rel: 'documents/Cap1.md', title: 'Cap1', md: 'Testo [@halb1950]. Vedi [[Cap2]] e https://ex.org/p.' },
      { rel: 'documents/Cap2.md', title: 'Cap2', md: 'Niente.' },
    ];
    const rs = [
      res('r1', { citeKey: 'halb1950', tags: ['memoria'] }),
      res('r2', { url: 'https://ex.org/p', tags: ['Memoria'] }),
      res('r3', {}),
    ];
    const g = buildGraph(docs, rs, [{ id: 'k', from: 'r2', to: 'r3' }], { tags: true });
    const kinds = g.edges.map((e) => `${e.source}>${e.target}:${e.kind}`).sort();
    expect(kinds).toEqual(
      [
        'doc:documents/Cap1.md>doc:documents/Cap2.md:wiki',
        'doc:documents/Cap1.md>r1:cite',
        'doc:documents/Cap1.md>r2:url',
        'r1>tag:memoria:tag',
        'r2>r3:link',
        'r2>tag:memoria:tag',
      ].sort(),
    );
    expect(g.nodes.find((n) => n.id === 'r2')!.degree).toBe(3);
  });

  it('i collegamenti della Tabula fra fonti e pergamene entrano nel grafo', () => {
    const docs = [{ rel: 'documents/Cap1.md', title: 'Cap1', md: 'Niente citazioni.' }];
    const g = buildGraph(docs, [res('r1', {})], [{ id: 'k', from: 'r1', to: 'doc:documents/Cap1.md' }]);
    expect(g.edges).toEqual([{ source: 'r1', target: 'doc:documents/Cap1.md', kind: 'link' }]);
  });
});
