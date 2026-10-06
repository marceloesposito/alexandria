import { describe, it, expect } from 'vitest';
import { parseEntry, lookupWord, matchCase, findBlock, thesaurusLang, baseForms, inflectLike } from './model';

describe('thesaurus', () => {
  it('blocco italiano: categorie e sinonimi', () => {
    const e = parseEntry('bello|2\n(agg.)|carino|grazioso|bello\n(s.m.)|bellezza\n')!;
    expect(e.word).toBe('bello');
    expect(e.meanings).toEqual([
      { pos: 'agg.', synonyms: ['carino', 'grazioso'], related: [], antonyms: [] },
      { pos: 's.m.', synonyms: ['bellezza'], related: [], antonyms: [] },
    ]);
  });

  it('blocco inglese: termini generali, simili e contrari a parte', () => {
    const e = parseEntry('happy|1\n(adj)|glad|felicitous (similar term)|happy (similar term)|unhappy (antonym)|emotional (generic term)\n')!;
    expect(e.meanings[0]).toEqual({ pos: 'adj', synonyms: ['glad'], related: ['felicitous', 'emotional'], antonyms: ['unhappy'] });
  });

  it('parola dalla selezione', () => {
    expect(lookupWord('  «bello», ')).toBe('bello');
    expect(lookupWord('in front of')).toBe('in front of');
    expect(lookupWord('una frase troppo lunga per essere cercata')).toBeNull();
    expect(lookupWord(' ... ')).toBeNull();
  });

  it('il sostituto prende le maiuscole della parola', () => {
    expect(matchCase('Bello', 'carino')).toBe('Carino');
    expect(matchCase('BELLO', 'carino')).toBe('CARINO');
    expect(matchCase('bello', 'carino')).toBe('carino');
    expect(matchCase('Happy', 'glad')).toBe('Glad');
  });

  it('ricerca nel file intero (versione nel browser)', () => {
    const file = 'UTF-8\nabate|1\n(s.m.)|priore\nBello|2\n(agg.)|carino\n(s.m.)|bellezza\nzero|1\n(num.)|nulla\n';
    expect(findBlock(file, 'bello')).toBe('Bello|2\n(agg.)|carino\n(s.m.)|bellezza\n');
    // le righe dei significati non vengono scambiate per intestazioni
    expect(findBlock(file, '(agg.)')).toBeNull();
    expect(findBlock(file, 'nulla')).toBeNull();
  });

  it('forme base da provare', () => {
    expect(baseForms('bella', 'it')[0]).toBe('bello');
    expect(baseForms('case', 'it')).toContain('casa');
    expect(baseForms('fiori', 'it')).toContain('fiore');
    expect(baseForms('bianchi', 'it')).toContain('bianco');
    expect(baseForms('cities', 'en')).toContain('city');
    expect(baseForms('walked', 'en')).toContain('walk');
    expect(baseForms('writing', 'en')).toContain('write');
    expect(baseForms('running', 'en')).toContain('run');
    expect(baseForms('happier', 'en')).toContain('happy');
  });

  it('accordo del sinonimo con la parola nel testo (italiano)', () => {
    expect(inflectLike('bella', 'bello', 'carino', 'it')).toBe('carina');
    expect(inflectLike('belli', 'bello', 'grazioso', 'it')).toBe('graziosi');
    expect(inflectLike('belle', 'bello', 'carino', 'it')).toBe('carine');
    expect(inflectLike('bella', 'bello', 'avvenente', 'it')).toBe('avvenente'); // non finisce in -o
    expect(inflectLike('bella', 'bello', 'di bell\'aspetto', 'it')).toBe("di bell'aspetto");
    expect(inflectLike('cities', 'city', 'town', 'en')).toBe('town');
  });

  it('solo italiano e inglese', () => {
    expect(thesaurusLang('it')).toBe('it');
    expect(thesaurusLang('en')).toBe('en');
    expect(thesaurusLang('de')).toBeNull();
  });
});
