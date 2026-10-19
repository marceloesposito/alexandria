import { describe, expect, it } from 'vitest';
import { handlePosition } from './dragHandlePosition';

describe('handlePosition', () => {
  it('senza zoom lascia la posizione di floating-ui', () => {
    expect(handlePosition(100, 40, 1, 18)).toEqual({ x: 100, y: 40 });
  });

  it('con lo zoom riporta in pixel della pagina', () => {
    // testo a 200 px dello schermo dal bordo, maniglia larga 18 px CSS: floating-ui da' 200 - 18
    const { x, y } = handlePosition(200 - 18, 100, 0.5, 18);
    expect(x + 18).toBe(400); // il bordo destro della maniglia tocca il testo (400 px della pagina)
    expect(y).toBe(200);
  });

  it('ignora zoom non validi', () => {
    expect(handlePosition(50, 10, 0)).toEqual({ x: 50, y: 10 });
    expect(handlePosition(50, 10, Number.NaN)).toEqual({ x: 50, y: 10 });
  });
});
