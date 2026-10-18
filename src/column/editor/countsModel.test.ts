import { describe, expect, it } from 'vitest';
import { countsLabel, countValue, normalizeShown, toggleShown } from './countsModel';

const c = { chars: 1234, charsNoSpaces: 1000, words: 210, paragraphs: 4, cartelle: 0.7, pages: 1, readingMinutes: 1 };
const unit = (k: string, n: number) => `${k}${n === 1 ? '' : 's'}`;

describe('contatore a scelta', () => {
  it('di partenza le parole; valori strani ripuliti', () => {
    expect(normalizeShown(undefined)).toEqual(['words']);
    expect(normalizeShown(['pages', 'x', 'words'])).toEqual(['words', 'pages']);
    expect(normalizeShown([])).toEqual(['words']);
  });

  it('accende e spegne, sempre almeno uno, nello stesso ordine', () => {
    expect(toggleShown(['words'], 'pages')).toEqual(['words', 'pages']);
    expect(toggleShown(['pages', 'words'], 'chars')).toEqual(['words', 'chars', 'pages']);
    expect(toggleShown(['words'], 'words')).toEqual(['words']);
  });

  it('le pagine vere vincono sulla stima', () => {
    expect(countValue(c, 'pages', null)).toBe(1);
    expect(countValue(c, 'pages', 3)).toBe(3);
    expect(countValue(null, 'words', null)).toBe(0);
  });

  it('etichetta', () => {
    expect(countsLabel(c, ['words', 'pages'], 3, unit, 'it')).toBe('210 wordss · 3 pagess');
    expect(countsLabel(c, ['cartelle'], null, unit, 'it')).toBe('0,7 cartelles');
  });
});
