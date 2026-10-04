import { describe, it, expect } from 'vitest';
import { clusterLines, lineAt } from './lines';

describe('righe visive', () => {
  it('unisce i frammenti sulla stessa riga', () => {
    const lines = clusterLines([
      { top: 0, bottom: 20 },
      { top: 2, bottom: 18 }, // corsivo piu' basso, stessa riga
      { top: 24, bottom: 44 },
      { top: 0, bottom: 20 },
      { top: 50, bottom: 51 }, // troppo sottile: ignorato
    ]);
    expect(lines).toEqual([
      { top: 0, bottom: 20 },
      { top: 24, bottom: 44 },
    ]);
  });

  it('un apice non crea una riga nuova', () => {
    const lines = clusterLines([
      { top: 0, bottom: 20 },
      { top: -4, bottom: 10 },
    ]);
    expect(lines.length).toBe(1);
  });

  it('trova la riga sotto il mouse', () => {
    const lines = [
      { n: 1, top: 0, bottom: 20 },
      { n: 2, top: 24, bottom: 44 },
      { n: 3, top: 48, bottom: 68 },
    ];
    expect(lineAt(lines, 30)?.n).toBe(2);
    expect(lineAt(lines, 46)?.n).toBe(2);
    expect(lineAt(lines, 500)).toBeNull();
  });
});
