import { describe, expect, it } from 'vitest';
import { normalizeShown, toggleShown, DEFAULT_COUNTS_SHOWN } from './countsModel';

describe('conteggi in vista', () => {
  it('aggiunge e toglie mantenendo l\'ordine della lista', () => {
    expect(toggleShown(['words', 'pages'], 'chars')).toEqual(['words', 'chars', 'pages']);
    expect(toggleShown(['words', 'pages'], 'words')).toEqual(['pages']);
    expect(toggleShown([], 'reading')).toEqual(['reading']);
  });

  it('dallo stato salvato: predefiniti se manca, voci sconosciute scartate, anche nessuna voce', () => {
    expect(normalizeShown(undefined)).toEqual(DEFAULT_COUNTS_SHOWN);
    expect(normalizeShown(['pages', 'boh', 'words'])).toEqual(['words', 'pages']);
    expect(normalizeShown([])).toEqual([]);
  });
});
