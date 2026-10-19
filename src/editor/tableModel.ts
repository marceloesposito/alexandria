// Tabelle dello Scriptorium: numero di righe e colonne, allineamento delle colonne. Il Markdown (GFM)
// conosce solo questo: la prima riga e' sempre l'intestazione, l'allineamento e' per colonna.
import type { PMNode } from 'logos/doc/types';
import { columnWidths } from 'logos/doc/tables';

export type ColumnAlign = 'left' | 'center' | 'right' | null;

export const MAX_ROWS = 200;
export const MAX_COLS = 20;

/** Righe (intestazione compresa) e colonne della tabella. */
export function tableSize(table: PMNode): { rows: number; cols: number } {
  const rows = table.content ?? [];
  return { rows: rows.length, cols: Math.max(0, ...rows.map((r) => r.content?.length ?? 0)) };
}

const emptyCell = (header: boolean): PMNode => ({ type: header ? 'tableHeader' : 'tableCell', content: [{ type: 'paragraph' }] });

/** La tabella con `rows` righe e `cols` colonne: le celle che restano tengono il testo, quelle nuove
 *  sono vuote, righe e colonne in piu' si tolgono dal fondo e da destra. */
export function resizeTable(table: PMNode, rows: number, cols: number): PMNode {
  const r = Math.max(1, Math.min(MAX_ROWS, Math.round(rows)));
  const c = Math.max(1, Math.min(MAX_COLS, Math.round(cols)));
  const old = table.content ?? [];
  const content: PMNode[] = Array.from({ length: r }, (_, i) => {
    const row = old[i];
    const cells = row?.content ?? [];
    return {
      ...(row ?? { type: 'tableRow' }),
      content: Array.from({ length: c }, (_, j) => cells[j] ?? emptyCell(i === 0)),
    };
  });
  const align = ((table.attrs?.align as ColumnAlign[] | undefined) ?? []).slice(0, c);
  // le larghezze scelte restano; le colonne nuove prendono la media delle altre
  const oldWidths = columnWidths(table.attrs, tableSize(table).cols);
  let widths: number[] | null = null;
  if (oldWidths) {
    const kept = oldWidths.slice(0, c);
    const avg = kept.reduce((a, b) => a + b, 0) / kept.length;
    widths = normalizeWidths([...kept, ...Array.from({ length: c - kept.length }, () => avg)]);
  }
  return { ...table, attrs: { ...table.attrs, align, widths }, content };
}

/** Allineamento delle colonne con quello della colonna `col` cambiato (gli altri restano). */
export function withColumnAlign(align: ColumnAlign[] | undefined, col: number, value: ColumnAlign): ColumnAlign[] {
  const out = [...(align ?? [])];
  while (out.length <= col) out.push(null);
  out[col] = value;
  return out;
}

/** Testo "righe x colonne" scritto dall'utente (3x4, 3 x 4, 3*4, 3,4). */
export function parseSize(s: string): { rows: number; cols: number } | null {
  const m = /^\s*(\d+)\s*[x×*,;]\s*(\d+)\s*$/i.exec(s);
  return m ? { rows: Number(m[1]), cols: Number(m[2]) } : null;
}

/** Percentuali con un decimale che sommano 100. */
export function normalizeWidths(w: number[]): number[] {
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => Math.round((x / sum) * 1000) / 10);
}

export const MIN_WIDTH = 5;

/** Sposta il bordo fra la colonna `i` e la `i + 1` di `delta` punti percentuali (le altre restano). */
export function dragBorder(w: number[], i: number, delta: number): number[] {
  if (i < 0 || i >= w.length - 1) return w;
  const d = Math.max(MIN_WIDTH - w[i], Math.min(w[i + 1] - MIN_WIDTH, delta));
  const out = [...w];
  out[i] += d;
  out[i + 1] -= d;
  return out;
}
