import { describe, expect, it } from 'vitest';
import { edgesToCut, polylinesIntersect, segmentsIntersect } from './knife';

const P = (x: number, y: number) => ({ x, y });

describe('coltello della Tabula', () => {
  it('segmenti che si incrociano, si toccano o no', () => {
    expect(segmentsIntersect(P(0, 0), P(10, 10), P(0, 10), P(10, 0))).toBe(true);
    expect(segmentsIntersect(P(0, 0), P(10, 0), P(5, 0), P(5, 5))).toBe(true);
    expect(segmentsIntersect(P(0, 0), P(10, 0), P(0, 1), P(10, 1))).toBe(false);
    expect(segmentsIntersect(P(0, 0), P(1, 1), P(5, 5), P(6, 7))).toBe(false);
  });

  it('spezzate', () => {
    expect(polylinesIntersect([P(0, 5), P(20, 5)], [P(10, 0), P(12, 3), P(10, 10)])).toBe(true);
    expect(polylinesIntersect([P(0, 50), P(20, 50)], [P(10, 0), P(10, 10)])).toBe(false);
  });

  it('la scia taglia tutti i collegamenti che attraversa', () => {
    const edges = [
      { id: 'a', points: [P(0, 0), P(0, 100)] },
      { id: 'b', points: [P(50, 0), P(50, 100)] },
      { id: 'c', points: [P(200, 0), P(200, 100)] },
    ];
    expect(edgesToCut([P(-10, 50), P(30, 52), P(60, 48)], edges)).toEqual(['a', 'b']);
  });

  it('un clic taglia il collegamento piu vicino, se abbastanza vicino', () => {
    const edges = [
      { id: 'a', points: [P(0, 0), P(0, 100)] },
      { id: 'b', points: [P(10, 0), P(10, 100)] },
    ];
    expect(edgesToCut([P(3, 50)], edges)).toEqual(['a']);
    expect(edgesToCut([P(8, 50), P(8.5, 50)], edges)).toEqual(['b']);
    expect(edgesToCut([P(40, 50)], edges)).toEqual([]);
    expect(edgesToCut([], edges)).toEqual([]);
  });
});
