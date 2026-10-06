import { describe, it, expect } from 'vitest';
import { paginate } from './pagination';

const blocks = (...h: number[]) => {
  let y = 0;
  return h.map((x) => {
    const b = { top: y, bottom: y + x };
    y += x;
    return b;
  });
};

describe('impaginazione della vista pagina', () => {
  it('una pagina sola: si completa fino in fondo', () => {
    expect(paginate(blocks(100, 100), 1000)).toEqual({ breaks: [], endRest: 800, pages: 1 });
  });
  it('il blocco che non ci sta apre la pagina dopo', () => {
    const p = paginate(blocks(400, 400, 400), 1000);
    expect(p.breaks).toEqual([{ index: 2, rest: 200 }]);
    expect(p.pages).toBe(2);
    expect(p.endRest).toBe(600);
  });
  it('un blocco più alto della pagina la allunga, senza spezzarsi', () => {
    const p = paginate(blocks(100, 2500, 100), 1000);
    expect(p.breaks).toEqual([{ index: 1, rest: 900 }]);
    // il blocco lungo occupa tre altezze di pagina; il successivo ci sta ancora
    expect(p.pages).toBe(2);
    expect(p.endRest).toBe(400);
  });
  it('documento vuoto', () => {
    expect(paginate([], 1000)).toEqual({ breaks: [], endRest: 1000, pages: 1 });
  });
});
