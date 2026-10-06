import { describe, it, expect } from 'vitest';
import { dropIndex, shiftsFor, finalIndex } from './blockReorder';

// quattro blocchi alti 40 con 10 di spazio: 0-40, 50-90, 100-140, 150-190
const bands = [0, 50, 100, 150].map((top) => ({ top, bottom: top + 40 }));

describe('spostamento dei blocchi', () => {
  it('posto d\'arrivo dal puntatore, saltando il blocco trascinato', () => {
    expect(dropIndex(bands, 1, 5)).toBe(0); // sopra la meta' del primo
    expect(dropIndex(bands, 1, 60)).toBe(2); // sopra se stesso: conta il blocco dopo
    expect(dropIndex(bands, 1, 125)).toBe(3);
    expect(dropIndex(bands, 1, 400)).toBe(4); // in fondo
  });

  it('chi sta in mezzo scorre per fare posto', () => {
    expect(shiftsFor(4, 0, 3, 50)).toEqual([0, -50, -50, 0]); // il primo scende sotto il terzo
    expect(shiftsFor(4, 3, 1, 50)).toEqual([0, 50, 50, 0]); // l'ultimo sale al secondo posto
    expect(shiftsFor(4, 1, 1, 50)).toEqual([0, 0, 0, 0]);
    expect(shiftsFor(4, 1, 2, 50)).toEqual([0, 0, 0, 0]); // subito dopo se stesso: fermo
  });

  it('piu\' blocchi insieme (selezione a intervallo della maniglia)', () => {
    expect(dropIndex(bands, 0, 60, 2)).toBe(2); // sopra se stessi: restano
    expect(dropIndex(bands, 0, 165, 2)).toBe(3);
    expect(shiftsFor(4, 0, 4, 100, 2)).toEqual([0, 0, -100, -100]); // i primi due vanno in fondo
    expect(shiftsFor(4, 2, 0, 100, 2)).toEqual([100, 100, 0, 0]); // gli ultimi due salgono in cima
    expect(finalIndex(0, 4, 2)).toBe(2);
  });

  it('indice finale dopo lo spostamento', () => {
    expect(finalIndex(0, 3)).toBe(2);
    expect(finalIndex(3, 1)).toBe(1);
    expect(finalIndex(0, 4)).toBe(3);
  });
});
