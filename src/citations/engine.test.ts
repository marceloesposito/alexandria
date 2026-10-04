// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CitationEngine, parseLocator } from './engine';
import type { CslItem } from '../resources/model';

const style = (id: string) => readFileSync(`public/csl/${id}.csl`, 'utf8');
const locales = {
  'it-IT': readFileSync('public/csl/locales-it-IT.xml', 'utf8'),
  'en-US': readFileSync('public/csl/locales-en-US.xml', 'utf8'),
};

const items = new Map<string, CslItem>([
  [
    'halbwachs1950',
    {
      type: 'book',
      title: 'La mémoire collective',
      author: [{ family: 'Halbwachs', given: 'Maurice' }],
      issued: { 'date-parts': [[1950]] },
      publisher: 'Presses Universitaires de France',
      'publisher-place': 'Paris',
    },
  ],
  [
    'nora1984',
    {
      type: 'chapter',
      title: 'Entre mémoire et histoire',
      author: [{ family: 'Nora', given: 'Pierre' }],
      issued: { 'date-parts': [[1984]] },
      'container-title': 'Les lieux de mémoire',
      publisher: 'Gallimard',
      page: '15-42',
    },
  ],
]);

describe('locator', () => {
  it('etichette italiane e inglesi', () => {
    expect(parseLocator('p. 12')).toEqual({ label: 'page', locator: '12' });
    expect(parseLocator('pp. 3-5')).toEqual({ label: 'page', locator: '3-5' });
    expect(parseLocator('cap. 2')).toEqual({ label: 'chapter', locator: '2' });
    expect(parseLocator('1:15')).toEqual({ suffix: '1:15' });
    expect(parseLocator('45')).toEqual({ label: 'page', locator: '45' });
  });
});

describe('APA', () => {
  const e = new CitationEngine({ style: style('apa'), locales, lang: 'en-US', items });
  it('citazione con pagina', () => {
    expect(e.cluster([{ key: 'halbwachs1950', locator: 'p. 12' }])).toBe('(Halbwachs, 1950, p. 12)');
  });
  it('due fonti e autore omesso', () => {
    expect(e.cluster([{ key: 'halbwachs1950' }, { key: 'nora1984' }])).toBe('(Halbwachs, 1950; Nora, 1984)');
    expect(e.cluster([{ key: 'nora1984', suppressAuthor: true }])).toBe('(1984)');
  });
  it('bibliografia in ordine alfabetico', () => {
    const b = e.bibliography(['nora1984', 'halbwachs1950'], 'text');
    expect(b).toHaveLength(2);
    expect(b[0]).toMatch(/^Halbwachs, M\. \(1950\)\. La mémoire collective\. Presses Universitaires de France\./);
    expect(b[1]).toMatch(/^Nora, P\. \(1984\)/);
  });
});

describe('IEEE', () => {
  const e = new CitationEngine({ style: style('ieee'), locales, lang: 'en-US', items });
  it('numeri nell ordine di comparsa', () => {
    e.setOrder(['nora1984', 'halbwachs1950']);
    expect(e.cluster([{ key: 'nora1984' }])).toBe('[1]');
    expect(e.cluster([{ key: 'halbwachs1950' }])).toBe('[2]');
  });
});

describe('Chicago note e lingua italiana', () => {
  const e = new CitationEngine({ style: style('chicago-notes-bibliography'), locales, lang: 'it-IT', items });
  it('stile a note', () => {
    expect(e.isNote).toBe(true);
    const note = e.cluster([{ key: 'halbwachs1950', locator: 'p. 12' }]);
    expect(note).toContain('Halbwachs');
    expect(note).toContain('12');
  });
});
