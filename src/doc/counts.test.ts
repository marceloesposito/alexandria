import { describe, it, expect } from 'vitest';
import { countText, countDoc } from './counts';
import { parseMarkdown } from './parse';

describe('conteggi', () => {
  it('battute e parole', () => {
    const c = countText("L'aria è  fresca, vero?");
    // 23 caratteri (doppio spazio incluso), 19 senza spazi
    expect(c.chars).toBe(23);
    expect(c.charsNoSpaces).toBe(19);
    expect(c.words).toBe(4); // L'aria, è, fresca, vero
  });

  it('accenti composti contano una battuta', () => {
    expect(countText('é').chars).toBe(1);
  });

  it('cartelle da 1800 battute', () => {
    expect(countText('a'.repeat(3600)).cartelle).toBe(2);
    expect(countText('a'.repeat(900)).cartelle).toBe(0.5);
  });

  it('pagine stimate', () => {
    expect(countText('').pages).toBe(0);
    expect(countText('parola '.repeat(301), 300).pages).toBe(2);
  });

  it('documento: note e citazioni fuori dal conteggio', () => {
    const doc = parseMarkdown('# Titolo\n\nUno due[^1] [@rossi2020].\n\n[^1]: Nota lunga lunga.');
    const c = countDoc(doc);
    expect(c.words).toBe(3);
    expect(c.paragraphs).toBe(2);
  });
});
