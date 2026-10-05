import { describe, expect, it } from 'vitest';
import { rulerLabels, pageStarts } from './rulerModel';

describe('righelli', () => {
  it('numera i centimetri a partire dalla colonna di testo, anche nei margini', () => {
    const l = rulerLabels(60, 25);
    expect(l.map((x) => x.cm)).toEqual([2, 1, 1, 2, 3]);
    expect(l.map((x) => x.at)).toEqual([5, 15, 35, 45, 55]);
  });

  it('non mette etichette sullo zero ne fuori dal righello', () => {
    const l = rulerLabels(20, 0);
    expect(l).toEqual([
      { at: 10, cm: 1 },
      { at: 20, cm: 2 },
    ]);
  });

  it('stima gli inizi di pagina ogni altezza di testo', () => {
    expect(pageStarts(600, 22, 240)).toEqual([
      { at: 262, page: 2 },
      { at: 502, page: 3 },
    ]);
    expect(pageStarts(100, 22, 240)).toEqual([]);
    expect(pageStarts(100, 22, 0)).toEqual([]);
  });
});
