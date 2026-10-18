import { describe, expect, it } from 'vitest';
import { createGravity, settle, type Body } from './gravity';
import { flowLayout, overlaps } from './flowLayout';

function bodies(n: number): Body[] {
  // tutti ammucchiati nello stesso punto: devono separarsi e raggiungere il loro posto
  return Array.from({ length: n }, (_, i) => ({ id: `b${i}`, w: 200, h: 60 + (i % 3) * 20, x: 5 * i, y: 3 * i, tx: 0, ty: 0 }));
}

describe('gravita della Tabula', () => {
  it('a riposo i blocchi sono ai loro posti e non si sovrappongono', () => {
    const bs = bodies(8);
    const pos = flowLayout(
      bs.map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h })),
      [1, 2, 3].map((i) => ({ from: 'b0', to: `b${i}` })),
      { maxWidth: 700 },
    );
    for (const b of bs) Object.assign(b, { tx: pos.get(b.id)!.x, ty: pos.get(b.id)!.y });
    const out = settle(createGravity(bs));
    for (const b of out) {
      expect(Math.abs(b.x - b.tx)).toBeLessThan(4);
      expect(Math.abs(b.y - b.ty)).toBeLessThan(4);
    }
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(overlaps(out[i], out[j])).toBe(false);
  });

  it('un blocco tenuto fermo spinge via gli altri', () => {
    const bs: Body[] = [
      { id: 'a', w: 200, h: 80, x: 0, y: 0, tx: 0, ty: 0 },
      { id: 'held', w: 200, h: 80, x: 20, y: 20, tx: 0, ty: 200, fx: 20, fy: 20 },
    ];
    const sim = createGravity(bs);
    for (let i = 0; i < 200; i++) sim.tick();
    const [a, held] = sim.nodes();
    expect(held.x).toBe(20);
    expect(overlaps(a, held)).toBe(false);
  });
});
