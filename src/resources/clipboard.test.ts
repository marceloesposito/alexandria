import { describe, expect, it } from 'vitest';
import { classifyClipboard, guessLanguage, looksLikeCode, titleFromText } from './clipboard';

const clip = (plain: string, fileCount = 0) => classifyClipboard({ fileCount, plain });

describe('incolla nella Bookshelf', () => {
  it('file e immagini (anche uno screenshot copiato)', () => {
    expect(clip('', 1)).toEqual({ kind: 'files' });
  });

  it('link, uno o piu', () => {
    expect(clip('https://example.org/a')).toEqual({ kind: 'links', urls: ['https://example.org/a'] });
    expect(clip('https://a.org\nhttps://youtu.be/dQw4w9WgXcQ')?.kind).toBe('links');
  });

  it('DOI e ISBN diventano voci bibliografiche', () => {
    expect(clip('10.1093/mind/LIX.236.433')).toEqual({ kind: 'doi', doi: '10.1093/mind/LIX.236.433' });
    expect(clip('978-88-452-9255-1')).toEqual({ kind: 'isbn', isbn: '9788845292551' });
    expect(clip('ISBN 0-306-40615-2')).toEqual({ kind: 'isbn', isbn: '0306406152' });
  });

  it('BibTeX e RIS', () => {
    expect(clip('@book{eco1962, title={Opera aperta}}')?.kind).toBe('bibliography');
    expect(clip('TY  - JOUR\nTI  - Titolo\nER  - ')?.kind).toBe('bibliography');
  });

  it('codice: snippet con il linguaggio indovinato', () => {
    const ts = 'export function sum(a: number, b: number) {\n  return a + b;\n}';
    expect(clip(ts)).toEqual({ kind: 'code', code: ts, language: 'ts' });
    expect(guessLanguage('def f(x):\n    return x * 2\n')).toBe('python');
    expect(guessLanguage('fn main() {\n    let mut v = Vec::new();\n}')).toBe('rust');
    expect(guessLanguage('SELECT * FROM libri WHERE anno > 1960;')).toBe('sql');
    expect(guessLanguage('{\n  "nome": "Alexandria"\n}')).toBe('json');
  });

  it('testo normale resta una nota, anche con punteggiatura', () => {
    const prosa = 'Il libro è un oggetto strano; lo si apre, lo si chiude.\nEppure resta.';
    expect(looksLikeCode(prosa)).toBe(false);
    expect(clip(prosa)).toEqual({ kind: 'text', text: prosa });
    expect(clip('   ')).toBeNull();
  });

  it('titolo dalla prima riga', () => {
    expect(titleFromText('# Appunti sul capitolo\nsecondo')).toBe('Appunti sul capitolo');
    expect(titleFromText('x'.repeat(80), 20)).toHaveLength(20);
  });
});
