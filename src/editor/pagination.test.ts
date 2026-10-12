import { describe, it, expect } from 'vitest';
import { paginate, samePagination, marginOverlap } from './pagination';

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

describe('samePagination', () => {
  const p = paginate(blocks(400, 400, 400), 1000);
  it('differenze sotto il pixel non contano (niente ridisegno che rincorre la misura)', () => {
    const q = { ...p, breaks: p.breaks.map((b) => ({ ...b, rest: b.rest + 0.5 })), endRest: p.endRest - 0.5 };
    expect(samePagination(p, q)).toBe(true);
  });
  it('un salto spostato o uno spazio diverso di un pixel si', () => {
    expect(samePagination(p, paginate(blocks(400, 400, 500), 1000))).toBe(false);
    expect(samePagination(p, { ...p, endRest: p.endRest + 1 })).toBe(false);
    expect(samePagination(p, paginate(blocks(400, 700, 400), 1000))).toBe(false);
  });
});

describe('marginOverlap', () => {
  it('margini positivi: il salto aggiunge il piu\' piccolo', () => {
    expect(marginOverlap(6, 18)).toBe(6);
    expect(marginOverlap(18, 6)).toBe(6);
  });
  it('un margine nullo non aggiunge niente', () => {
    expect(marginOverlap(0, 18)).toBe(0);
    expect(marginOverlap(0, 0)).toBe(0);
  });
  it('margini negativi', () => {
    expect(marginOverlap(10, -4)).toBe(0);
    expect(marginOverlap(-4, -6)).toBe(-4);
  });
});
