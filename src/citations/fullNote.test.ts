import { describe, it, expect } from 'vitest';
import { fullNote } from './fullNote';

const refs: Record<string, string> = {
  halb: 'Halbwachs, M. (1950). La mémoire collective. PUF.',
  nora: 'Nora, P. (1984). Les lieux de mémoire. Gallimard.',
};
const entry = (k: string) => refs[k] ?? null;

describe('fonte per esteso in nota', () => {
  it('voce di bibliografia con la pagina', () => {
    expect(fullNote([{ key: 'halb', locator: '12' }], entry)).toBe('Halbwachs, M. (1950). La mémoire collective. PUF, p. 12.');
  });
  it('piu\' fonti, etichette diverse e fonti sconosciute', () => {
    expect(fullNote([{ key: 'halb', locator: 'cap. 2' }, { key: 'nora' }, { key: 'boh' }], entry)).toBe(
      'Halbwachs, M. (1950). La mémoire collective. PUF, cap. 2; Nora, P. (1984). Les lieux de mémoire. Gallimard; @boh.',
    );
  });
});
