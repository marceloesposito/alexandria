import { describe, it, expect } from 'vitest';
import { splitLetter, changesMarkdown, responseLetter, normalizeRound, type ReviewRound } from './model';
import { docDiff } from '../versions/docDiff';
import { parseMarkdown } from '../doc/parse';

describe('lettera dei revisori', () => {
  it('divide per revisore e per punto numerato', () => {
    const letter = 'Reviewer 1\n1. The method is unclear.\nIt needs detail.\n2) Cite Nora.\n\nReviewer 2:\n- Shorten the intro.\n- Fix typos.';
    expect(splitLetter(letter)).toEqual([
      { reviewer: 'Reviewer 1', text: 'The method is unclear.\nIt needs detail.' },
      { reviewer: 'Reviewer 1', text: 'Cite Nora.' },
      { reviewer: 'Reviewer 2', text: 'Shorten the intro.' },
      { reviewer: 'Reviewer 2', text: 'Fix typos.' },
    ]);
  });
  it('senza numerazione: un punto per paragrafo', () => {
    expect(splitLetter('Primo paragrafo\nsu due righe.\n\nSecondo.', 'Revisore').map((x) => x.text)).toEqual(['Primo paragrafo\nsu due righe.', 'Secondo.']);
  });
});

describe('versione con modifiche evidenziate', () => {
  it('parole cambiate, paragrafi aggiunti e tolti diventano revisioni', () => {
    const before = '# Titolo\n\nLa memoria è sempre sociale.\n\nParagrafo tolto.';
    const after = '# Titolo\n\nLa memoria è spesso sociale.\n\nParagrafo nuovo.';
    const md = changesMarkdown(docDiff(before, after), 'Autrice', '2026-10-07');
    expect(md).toContain('# Titolo');
    expect(md).toContain('<del data-author="Autrice" data-date="2026-10-07">sempre</del><ins data-author="Autrice" data-date="2026-10-07">spesso</ins>');
    const doc = parseMarkdown(md);
    const marks = JSON.stringify(doc);
    expect(marks).toContain('"insertion"');
    expect(marks).toContain('"deletion"');
  });
});

describe('lettera di risposta', () => {
  const round: ReviewRound = {
    version: 1,
    id: 'r1',
    name: 'Rivista X',
    created: '',
    baseSha: null,
    items: [
      { id: 'a', reviewer: 'Reviewer 1', text: 'Cite Nora.', response: 'Added in section 2.', status: 'done', commits: ['abc'] },
      { id: 'b', reviewer: 'Reviewer 2', text: 'Shorten.', response: '', status: 'declined', commits: [] },
    ],
  };
  it('raggruppa per revisore con risposta e modifiche', () => {
    const md = responseLetter(round, { title: 'Response', response: 'Response:', changes: 'Changes:', declined: 'Not addressed.' }, (s) => `commit ${s}`);
    expect(md).toContain('## Reviewer 1');
    expect(md).toContain('> **1.** Cite Nora.');
    expect(md).toContain('**Response:** Added in section 2.');
    expect(md).toContain('*Changes:* commit abc');
    expect(md).toContain('Not addressed.');
  });
  it('normalizza un file salvato', () => {
    expect(normalizeRound({ id: 'x', items: [{ id: 'i', status: 'boh' }] })?.items[0]).toMatchObject({ status: 'todo', commits: [] });
    expect(normalizeRound(null)).toBeNull();
  });
});
