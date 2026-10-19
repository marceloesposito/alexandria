import { describe, it, expect } from 'vitest';
import { parseMarkdown as parse } from 'logos/doc/parse';
import { serializeMarkdown as serialize } from 'logos/doc/serialize';
import type { PMNode } from 'logos/doc/types';
import { dragBorder, parseSize, resizeTable, tableSize, withColumnAlign } from './tableModel';

const md = '| A | B |\n| :---: | --- |\n| 1 | 2 |\n| 3 | 4 |';
const table = () => parse(md).content!.find((n) => n.type === 'table')!;
const roundTrip = (t: PMNode) => serialize({ type: 'doc', content: [t] }).trim();

describe('tabelle', () => {
  it('conta righe e colonne', () => {
    expect(tableSize(table())).toEqual({ rows: 3, cols: 2 });
  });

  it('aggiunge righe e colonne vuote tenendo il testo', () => {
    const t = resizeTable(table(), 4, 3);
    expect(tableSize(t)).toEqual({ rows: 4, cols: 3 });
    expect(t.content![0].content![2].type).toBe('tableHeader');
    expect(t.content![3].content![0].type).toBe('tableCell');
    expect(roundTrip(t)).toBe('| A | B |  |\n| :---: | --- | --- |\n| 1 | 2 |  |\n| 3 | 4 |  |\n|  |  |  |');
  });

  it('toglie righe dal fondo e colonne da destra, con il loro allineamento', () => {
    const t = resizeTable(table(), 2, 1);
    expect(roundTrip(t)).toBe('| A |\n| :---: |\n| 1 |');
  });

  it('non scende sotto una riga e una colonna', () => {
    expect(tableSize(resizeTable(table(), 0, -3))).toEqual({ rows: 1, cols: 1 });
  });

  it("cambia l'allineamento di una colonna e torna nel Markdown", () => {
    expect(withColumnAlign([], 2, 'right')).toEqual([null, null, 'right']);
    const t = table();
    t.attrs = { ...t.attrs, align: withColumnAlign(t.attrs?.align as never, 1, 'right') };
    expect(roundTrip(t).split('\n')[1]).toBe('| :---: | ---: |');
  });

  it('legge la misura scritta', () => {
    expect(parseSize('3x4')).toEqual({ rows: 3, cols: 4 });
    expect(parseSize(' 5 × 2 ')).toEqual({ rows: 5, cols: 2 });
    expect(parseSize('tre')).toBeNull();
  });

  it('le larghezze seguono il numero di colonne', () => {
    const t = { ...table(), attrs: { ...table().attrs, widths: [20, 80] } };
    expect(resizeTable(t, 3, 3).attrs?.widths).toEqual([13.3, 53.3, 33.3]);
    expect(resizeTable(t, 3, 1).attrs?.widths).toEqual([100]);
    expect(resizeTable(table(), 3, 3).attrs?.widths).toBeNull();
  });

  it('il bordo trascinato cambia solo le due colonne vicine, senza scendere sotto il minimo', () => {
    expect(dragBorder([30, 40, 30], 0, 10)).toEqual([40, 30, 30]);
    expect(dragBorder([30, 40, 30], 1, 50)).toEqual([30, 65, 5]);
    expect(dragBorder([30, 40, 30], 2, 10)).toEqual([30, 40, 30]);
  });
});
