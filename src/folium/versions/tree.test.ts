import { describe, expect, it } from 'vitest';
import { emptyTree, forkDiffTarget, isFork, normalizeTree, prune, record, rename, resumeFrom, tipOf, treeLayout, type VersionTree } from './tree';

const H = 3_600_000;
const D = 24 * H;

function chain(n: number, step = 1000, auto = true): VersionTree {
  let t = emptyTree();
  for (let i = 0; i < n; i++) t = record(t, { id: `v${i}`, at: i * step, auto });
  return t;
}

describe('albero delle versioni', () => {
  it('le versioni si accodano sul tronco', () => {
    const t = chain(3);
    expect(t.nodes.map((n) => [n.id, n.parent, n.branch])).toEqual([
      ['v0', null, 0],
      ['v1', 'v0', 0],
      ['v2', 'v1', 0],
    ]);
    expect(t.head).toBe('v2');
  });

  it('Riprendi da qui apre un ramo nuovo e lascia le versioni successive', () => {
    let t = resumeFrom(chain(3), 'v0');
    t = record(t, { id: 'b1', at: 5000, auto: false, label: 'Altra strada' });
    t = record(t, { id: 'b2', at: 6000, auto: true });
    expect(t.nodes.find((n) => n.id === 'b1')).toMatchObject({ parent: 'v0', branch: 1, label: 'Altra strada' });
    expect(t.nodes.find((n) => n.id === 'b2')).toMatchObject({ parent: 'b1', branch: 1 });
    expect(t.nodes.map((n) => n.id)).toContain('v2');
    expect(isFork(t, 'v0')).toBe(true);
    // un terzo ramo dalla stessa biforcazione
    t = record(resumeFrom(t, 'v0'), { id: 'c1', at: 7000, auto: true });
    expect(t.nodes.find((n) => n.id === 'c1')?.branch).toBe(2);
  });

  it('dalla punta di un ramo si continua sullo stesso ramo', () => {
    const t = record(resumeFrom(chain(3), 'v2'), { id: 'v3', at: 9000, auto: true });
    expect(t.nodes.find((n) => n.id === 'v3')).toMatchObject({ parent: 'v2', branch: 0 });
  });

  it('al passaggio sulla biforcazione si confrontano le punte dei rami', () => {
    let t = resumeFrom(chain(3), 'v0');
    t = record(t, { id: 'b1', at: 5000, auto: true });
    t = record(t, { id: 'b2', at: 6000, auto: true });
    expect(forkDiffTarget(t, 'v0')).toEqual({ kind: 'fork', tips: ['v2', 'b2'] });
    expect(forkDiffTarget(t, 'v1')).toEqual({ kind: 'preview', id: 'v1' });
    expect(tipOf(t, 'b1')).toBe('b2');
  });

  it('la potatura toglie le automatiche vecchie e conserva quelle importanti', () => {
    const now = 30 * D;
    let t = emptyTree();
    // 12 versioni automatiche nella stessa ora di 20 giorni fa, poi una con un nome e una di oggi
    for (let i = 0; i < 12; i++) t = record(t, { id: `a${i}`, at: 10 * D + i * 60_000, auto: true });
    t = record(t, { id: 'named', at: 10 * D + 13 * 60_000, auto: false, label: 'Bozza' });
    t = record(t, { id: 'today', at: now - H, auto: true });
    const { tree, removed } = prune(t, now);
    // resta la radice, la piu' recente del secchio, il nome e la testa
    expect(tree.nodes.map((n) => n.id)).toEqual(['a0', 'a11', 'named', 'today']);
    expect(removed).toHaveLength(10);
    expect(tree.nodes.find((n) => n.id === 'a11')?.parent).toBe('a0');
  });

  it('non pota le biforcazioni', () => {
    const now = 30 * D;
    let t = emptyTree();
    for (let i = 0; i < 4; i++) t = record(t, { id: `a${i}`, at: D + i * 1000, auto: true });
    t = record(resumeFrom(t, 'a1'), { id: 'b', at: D + 9000, auto: true });
    const ids = prune(t, now).tree.nodes.map((n) => n.id);
    expect(ids).toContain('a1');
    expect(ids).toContain('b');
    expect(ids).toContain('a3');
  });

  it('nomi, normalizzazione e disposizione', () => {
    let t = rename(chain(2), 'v0', 'Prima');
    expect(t.nodes[0]).toMatchObject({ label: 'Prima', auto: false });
    t = record(resumeFrom(t, 'v0'), { id: 'b', at: 5000, auto: true });
    expect(normalizeTree(JSON.parse(JSON.stringify(t)))).toEqual(t);
    expect(normalizeTree({ nodes: 'x' })).toEqual(emptyTree());
    const { slots, lanes } = treeLayout(t);
    expect(lanes).toBe(2);
    expect(slots[0]).toEqual({ id: 'b', lane: 1, row: 0 });
    expect(slots.find((s) => s.id === 'v0')?.row).toBe(2);
  });
});
