import { describe, expect, it } from 'vitest';
import { pageHeightFor, paginate } from './pageHints';

const blocks = (hs: number[], gap = 10) => {
  let y = 0;
  return hs.map((h) => {
    const b = { top: y, bottom: y + h };
    y += h + gap;
    return b;
  });
};

describe('confini di pagina', () => {
  it('un blocco che non ci sta apre la pagina dopo', () => {
    // pagina da 100: 40 + 40 ci stanno (fino a 90), il terzo (100..140) no
    expect(paginate(blocks([40, 40, 40, 40]), 100)).toEqual({ breaks: [2], pages: 2 });
  });

  it('un blocco piu alto della pagina la allunga senza spezzarsi', () => {
    // 250 occupa tre pagine; il blocco dopo sta nella terza
    expect(paginate(blocks([250, 20]), 100)).toEqual({ breaks: [], pages: 3 });
    // il blocco lungo apre la seconda pagina e ne occupa tre
    expect(paginate(blocks([20, 250]), 100)).toEqual({ breaks: [1], pages: 4 });
  });

  it('testo corto: una pagina sola', () => {
    expect(paginate(blocks([10]), 100)).toEqual({ breaks: [], pages: 1 });
    expect(paginate([], 100).pages).toBe(1);
  });

  it('la pagina e in proporzione alla colonna (A4 del Layout predefinito)', () => {
    const h = pageHeightFor(600);
    expect(h).toBeGreaterThan(600);
    expect(pageHeightFor(1200)).toBeCloseTo(h * 2);
  });
});
