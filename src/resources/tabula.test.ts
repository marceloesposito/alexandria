import { describe, it, expect } from 'vitest';
import { placeDocNodes, facingSides, DOC_X, DOC_STEP } from './tabula';

describe('Tabula: pergamene come nodi fissi', () => {
  it('la prima volta vanno in colonna a sinistra delle risorse', () => {
    const p = placeDocNodes(['documents/a.md', 'documents/b.md'], {});
    expect(p['doc:documents/a.md']).toEqual({ x: DOC_X, y: 0 });
    expect(p['doc:documents/b.md']).toEqual({ x: DOC_X, y: DOC_STEP });
  });

  it('quelle spostate restano, le nuove vanno sotto l\'ultima', () => {
    const saved = { 'doc:documents/a.md': { x: 100, y: 400 } };
    const p = placeDocNodes(['documents/a.md', 'documents/nuova.md'], saved);
    expect(p['doc:documents/a.md']).toEqual({ x: 100, y: 400 });
    expect(p['doc:documents/nuova.md']).toEqual({ x: 100, y: 400 + DOC_STEP });
  });
});

describe('Tabula: frecce dal lato giusto', () => {
  const box = (x: number, y: number) => ({ x, y, w: 240, h: 80 });

  it('accanto: da destra a sinistra, e al contrario', () => {
    expect(facingSides(box(0, 0), box(400, 20))).toMatchObject({ from: 'right', to: 'left', start: { x: 240, y: 40 }, end: { x: 400, y: 60 } });
    expect(facingSides(box(400, 0), box(0, 0))).toMatchObject({ from: 'left', to: 'right' });
  });

  it('uno sotto l\'altro: da sotto a sopra, e al contrario', () => {
    expect(facingSides(box(0, 0), box(30, 300))).toMatchObject({ from: 'bottom', to: 'top', start: { x: 120, y: 80 }, end: { x: 150, y: 300 } });
    expect(facingSides(box(0, 300), box(0, 0))).toMatchObject({ from: 'top', to: 'bottom' });
  });

  it('nodi larghi e bassi: conta lo spazio fra i bordi, non fra i centri', () => {
    // centri a 260 in orizzontale e 200 in verticale, ma i bordi si sovrappongono in orizzontale
    expect(facingSides(box(0, 0), box(200, 200))).toMatchObject({ from: 'bottom', to: 'top' });
  });
});
