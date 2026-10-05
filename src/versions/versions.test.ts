import { describe, it, expect } from 'vitest';
import { lineStats, summarize, plainLine, suggestCommitMessage } from './diffSummary';
import { mergeText, resolveText, conflictsLeft, mergeJson, mergeJsonText } from './merge';
import { layoutGraph } from './graph';
import type { GitLog } from '../platform/types';
import { setLang } from '../i18n';

setLang('it');

describe('statistiche delle righe', () => {
  it('aggiunte, modificate, rimosse', () => {
    const s = lineStats('a\n\nb\n\nc\n', 'a\n\nB nuovo\n\nc\n\nd\n');
    expect(s).toMatchObject({ added: 1, modified: 1, removed: 0 });
    expect(s.samples[0]).toBe('B nuovo');
  });

  it('file nuovo e cancellato', () => {
    expect(lineStats(null, 'uno\n\ndue\n').added).toBe(2);
    expect(lineStats('uno\n', null).removed).toBe(1);
  });

  it('estratti senza sintassi', () => {
    expect(plainLine('## **Titolo** con [link](http://x)')).toBe('Titolo con link');
    expect(plainLine('- [x] fatto')).toBe('fatto');
  });
});

describe('riassunto e messaggio', () => {
  const changes = [
    { path: 'documents/Introduzione.md', status: 'modified' as const, binary: false, before: 'Uno.\n', after: 'Uno.\n\nDue [@rossi2020].\n' },
    { path: 'documents/Note.md', status: 'added' as const, binary: false, before: null, after: 'x\n' },
    {
      path: '.alexandria/comments/Introduzione.json',
      status: 'modified' as const,
      binary: false,
      before: '{"comments":[]}',
      after: '{"comments":[{"id":"a"},{"id":"b"}]}',
    },
  ];
  it('riassume documenti e commenti', () => {
    const s = summarize(changes);
    expect(s.added).toBe(2);
    expect(s.commentsDelta).toBe(2);
    expect(s.excerpt).toBe('Due [@rossi2020].');
  });
  it('propone un messaggio deterministico', () => {
    expect(suggestCommitMessage(summarize(changes))).toBe('Introduzione: +1 paragrafo, +1 citazione; nuovo Scroll «Note»; +2 commenti');
  });
});

describe('merge a tre vie', () => {
  const base = 'Titolo\n\nUno.\n\nDue.\n\nTre.\n';
  it('modifiche in punti diversi: nessun conflitto', () => {
    const chunks = mergeText(base, 'Titolo\n\nUno mio.\n\nDue.\n\nTre.\n', 'Titolo\n\nUno.\n\nDue.\n\nTre loro.\n');
    expect(conflictsLeft(chunks)).toBe(0);
    expect(resolveText(chunks)).toBe('Titolo\n\nUno mio.\n\nDue.\n\nTre loro.\n');
  });
  it('stesso paragrafo: conflitto da risolvere', () => {
    const chunks = mergeText(base, 'Titolo\n\nUno A.\n\nDue.\n\nTre.\n', 'Titolo\n\nUno B.\n\nDue.\n\nTre.\n');
    expect(conflictsLeft(chunks)).toBe(1);
    expect(resolveText(chunks)).toBeNull();
    const c = chunks.find((x) => x.kind === 'conflict')!;
    if (c.kind !== 'conflict') throw new Error();
    c.choice = 'both';
    expect(resolveText(chunks)).toBe('Titolo\n\nUno A.\n\nUno B.\n\nDue.\n\nTre.\n');
    c.choice = 'custom';
    c.custom = 'Uno A e B.';
    expect(resolveText(chunks)).toBe('Titolo\n\nUno A e B.\n\nDue.\n\nTre.\n');
  });
});

describe('merge JSON', () => {
  it('unisce i commenti per id', () => {
    const base = { comments: [{ id: 'a', body: 'x' }, { id: 'b', body: 'y' }] };
    const ours = { comments: [{ id: 'a', body: 'x mod' }, { id: 'b', body: 'y' }, { id: 'c', body: 'nuovo mio' }] };
    const theirs = { comments: [{ id: 'a', body: 'x' }, { id: 'd', body: 'nuovo loro' }] }; // b tolto da loro
    expect(mergeJson(base, ours, theirs)).toEqual({
      comments: [{ id: 'a', body: 'x mod' }, { id: 'c', body: 'nuovo mio' }, { id: 'd', body: 'nuovo loro' }],
    });
  });
  it('testo non JSON: null', () => {
    expect(mergeJsonText('{', '{', '{')).toBeNull();
  });
});

describe('timeline', () => {
  const log: GitLog = {
    head: 'm3',
    branch: 'main',
    branches: [
      { name: 'main', sha: 'm3' },
      { name: 'idea', sha: 'i2' },
    ],
    commits: [
      { sha: 'm3', parents: ['m2', 'i1'], message: 'Merge', author: '', time: 6, refs: ['main'] },
      { sha: 'i2', parents: ['i1'], message: 'idea 2', author: '', time: 5, refs: ['idea'] },
      { sha: 'm2', parents: ['m1'], message: 'checkpoint: auto', author: '', time: 4, refs: [] },
      { sha: 'i1', parents: ['m1'], message: 'idea 1', author: '', time: 3, refs: [] },
      { sha: 'm1', parents: [], message: 'inizio', author: '', time: 1, refs: [] },
    ],
  };
  it('main sulla prima corsia, il branch su una parallela dal punto di divergenza', () => {
    const g = layoutGraph(log);
    expect(g.bySha.get('m1')!.lane).toBe(0);
    expect(g.bySha.get('m2')!.lane).toBe(0);
    expect(g.bySha.get('m3')!.lane).toBe(0);
    expect(g.bySha.get('i1')!.lane).toBe(1);
    expect(g.bySha.get('i2')!.lane).toBe(1);
    expect(g.bySha.get('m1')!.col).toBe(0);
    expect(g.bySha.get('m2')!.checkpoint).toBe(true);
    expect(g.edges.filter((e) => e.merge)).toEqual([{ from: 'i1', to: 'm3', merge: true }]);
    expect(g.lanes.map((l) => l.branch)).toEqual(['main', 'idea']);
  });
});
