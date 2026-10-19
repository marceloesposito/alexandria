import { describe, it, expect } from 'vitest';
import { tokenize } from './tokens';

describe('parole e offset', () => {
  it("gli offset restano quelli del testo originale (virgolette curve, spazi, a capo)", () => {
    const text = 'It’s  a  “test”,\nreally.';
    const t = tokenize(text);
    expect(t.map((x) => x.w)).toEqual(["it's", 'a', 'test', 'really']);
    for (const x of t) expect(text.slice(x.start, x.end).toLowerCase().replace('’', "'")).toBe(x.w);
    expect(text.slice(t[0].start, t[0].end)).toBe('It’s');
  });

  it('punteggiatura, frasi e paragrafi', () => {
    const t = tokenize('One two, three. Four\n\nfive "six"');
    expect(t.map((x) => [x.w, x.brk, x.sent, x.para])).toEqual([
      ['one', true, true, false],
      ['two', false, false, false],
      ['three', true, false, false],
      ['four', true, true, false],
      ['five', true, true, true],
      // le virgolette non spezzano una locuzione
      ['six', false, false, false],
    ]);
  });

  it('trattini e apostrofi interni restano nella parola', () => {
    expect(tokenize("well-known don't John's").map((x) => x.w)).toEqual(['well-known', "don't", "john's"]);
  });

  it("elisione italiana: dell'analisi -> dell' + analisi, con gli offset giusti", () => {
    const text = "Dell’analisi, un po' l'altro";
    const t = tokenize(text, true);
    expect(t.map((x) => x.w)).toEqual(["dell'", 'analisi', 'un', "po'", "l'", 'altro']);
    expect(text.slice(t[1].start, t[1].end)).toBe('analisi');
    expect(t[1].brk).toBe(false);
    expect(text.slice(t[0].start, t[0].end)).toBe('Dell’');
  });
});
