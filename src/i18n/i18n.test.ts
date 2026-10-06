import { describe, it, expect } from 'vitest';
import { it as itDict } from './it';
import { en } from './en';
import { glossaryViolations } from './glossary';
// @ts-expect-error modulo JavaScript di servizio senza tipi
import { usedKeys } from '../../scripts/i18n-keys.mjs';

describe('i18n', () => {
  it('le due lingue hanno le stesse chiavi', () => {
    const a = Object.keys(itDict).sort();
    const b = Object.keys(en).sort();
    expect(a.filter((k) => !(k in en))).toEqual([]);
    expect(b.filter((k) => !(k in itDict))).toEqual([]);
  });

  it('ogni chiave usata nel codice esiste', () => {
    const missing = [...(usedKeys('src') as Set<string>)].filter((k) => !(k in itDict));
    expect(missing).toEqual([]);
  });

  it('i nomi del glossario sono gli stessi in tutte le lingue', () => {
    expect(glossaryViolations(en, en)).toEqual([]);
    expect(glossaryViolations(en, itDict, 'it')).toEqual([]);
  });

  it('le variabili coincidono fra le lingue', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    const diff = Object.keys(itDict).filter((k) => k in en && vars(itDict[k]) !== vars(en[k]));
    expect(diff).toEqual([]);
  });
});
