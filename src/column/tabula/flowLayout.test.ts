import { describe, expect, it } from 'vitest';
import { attachRule, flowLayout, overlaps, type FlowItem } from './flowLayout';

const item = (id: string, x = 0, y = 0, w = 100, h = 50): FlowItem => ({ id, x, y, w, h });

function noOverlaps(items: FlowItem[], pos: Map<string, { x: number; y: number }>) {
  const r = items.map((i) => ({ ...i, ...pos.get(i.id)! }));
  for (let a = 0; a < r.length; a++) for (let b = a + 1; b < r.length; b++) expect(overlaps(r[a], r[b]), `${r[a].id}/${r[b].id}`).toBe(false);
}

describe('flowLayout', () => {
  it('radice in alto, figli sotto affiancati in ordine di x', () => {
    const items = [item('r'), item('b', 500), item('a', 10)];
    const pos = flowLayout(items, [
      { from: 'r', to: 'b' },
      { from: 'r', to: 'a' },
    ]);
    expect(pos.get('r')!.y).toBe(0);
    expect(pos.get('a')!.y).toBeGreaterThan(50);
    expect(pos.get('a')!.y).toBe(pos.get('b')!.y);
    expect(pos.get('a')!.x).toBeLessThan(pos.get('b')!.x);
    // il padre sta al centro sopra i figli
    const mid = (pos.get('a')!.x + pos.get('b')!.x + 100) / 2;
    expect(pos.get('r')!.x + 50).toBeCloseTo(mid);
    noOverlaps(items, pos);
  });

  it('in una colonna stretta i fratelli si impilano in verticale, in ordine di y', () => {
    const items = [item('r'), item('a', 0, 300), item('b', 0, 100), item('c', 0, 200)];
    const edges = ['a', 'b', 'c'].map((to) => ({ from: 'r', to }));
    const pos = flowLayout(items, edges, { maxWidth: 260 });
    const ys = ['b', 'c', 'a'].map((id) => pos.get(id)!.y);
    expect(ys).toEqual([...ys].sort((p, q) => p - q));
    expect(new Set(['a', 'b', 'c'].map((id) => pos.get(id)!.x)).size).toBe(1);
    expect(pos.get('a')!.x).toBeGreaterThan(pos.get('r')!.x);
    noOverlaps(items, pos);
  });

  it("troppi fratelli si impilano anche se c'e' spazio", () => {
    const items = [item('r'), ...[1, 2, 3, 4, 5].map((i) => item(`k${i}`, i * 10))];
    const pos = flowLayout(items, [1, 2, 3, 4, 5].map((i) => ({ from: 'r', to: `k${i}` })), { maxWidth: 5000, maxSiblings: 4 });
    expect(new Set([1, 2, 3, 4, 5].map((i) => pos.get(`k${i}`)!.x)).size).toBe(1);
  });

  it('componenti separate una sotto l altra, blocchi sciolti in coda', () => {
    const items = [item('a'), item('a1'), item('b', 0, 400), item('b1'), item('z', 0, -100), item('y', 0, -200)];
    const pos = flowLayout(items, [
      { from: 'a', to: 'a1' },
      { from: 'b', to: 'b1' },
    ]);
    expect(pos.get('b')!.y).toBeGreaterThan(pos.get('a1')!.y);
    expect(pos.get('y')!.y).toBeGreaterThan(pos.get('b1')!.y);
    expect(pos.get('y')!.x).toBeLessThan(pos.get('z')!.x);
    noOverlaps(items, pos);
  });

  it('alberi profondi e un ciclo non si rompono', () => {
    const items = [item('a'), item('b'), item('c'), item('d')];
    const pos = flowLayout(items, [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' },
      { from: 'b', to: 'd' },
    ]);
    expect(pos.size).toBe(4);
  });
});

describe('attachRule', () => {
  const parent = item('p', 0, 0, 200, 80);
  it('lasciato poco sotto un blocco ci si attacca', () => {
    expect(attachRule(item('x', 20, 110), [parent], { parent: null, home: null })).toEqual({ attach: 'p' });
  });
  it('lontano o di lato non succede nulla', () => {
    expect(attachRule(item('x', 20, 300), [parent], { parent: null, home: null })).toBeNull();
    expect(attachRule(item('x', 400, 100), [parent], { parent: null, home: null })).toBeNull();
  });
  it('allontanato con decisione dal padre se ne stacca', () => {
    expect(attachRule(item('x', 600, 600), [parent], { parent: 'p', home: { x: 0, y: 108 } })).toEqual({ detach: true });
    expect(attachRule(item('x', 30, 140), [parent], { parent: 'p', home: { x: 0, y: 108 } })).toBeNull();
  });
});
