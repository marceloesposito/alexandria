import { describe, it, expect } from 'vitest';
import { fuzzyScore, fuzzyFilter } from './fuzzy';

describe('ricerca approssimata', () => {
  it('trova le lettere in ordine e scarta il resto', () => {
    expect(fuzzyScore('cap1', 'Capitolo 1')).not.toBeNull();
    expect(fuzzyScore('1cap', 'Capitolo 1')).toBeNull();
    expect(fuzzyScore('', 'qualsiasi')).toBe(0);
  });
  it('ignora maiuscole e accenti', () => {
    expect(fuzzyScore('perche', 'Perché scrivere')).not.toBeNull();
  });
  it('la sottostringa esatta batte le lettere sparse, l\'inizio di parola batte il mezzo', () => {
    const items = ['Introduzione storica', 'Note sul metodo', 'Metodologia'];
    expect(fuzzyFilter(items, 'metodo', (x) => x)).toEqual(['Metodologia', 'Note sul metodo']);
    expect(fuzzyFilter(['abcxdef', 'abc def'], 'def', (x) => x)[0]).toBe('abc def');
  });
  it('a parità di punteggio conserva l\'ordine e rispetta il limite', () => {
    expect(fuzzyFilter(['a', 'b', 'c'], '', (x) => x, 2)).toEqual(['a', 'b']);
  });
});
