import { describe, expect, it } from 'vitest';
import { removeBoardItems } from './boardEdit';
import type { Link, Whiteboard } from 'logos/resources/boardModel';

const wb: Whiteboard = {
  version: 1,
  nodes: { r1: { x: 0, y: 0 }, 'doc:a.md': { x: 10, y: 10 } },
  notes: [
    { id: 'n1', x: 0, y: 0, w: 200, h: 120, text: 'uno' },
    { id: 'n2', x: 0, y: 0, w: 200, h: 120, text: 'due' },
  ],
  frames: [{ id: 'f1', x: 0, y: 0, w: 600, h: 400, title: 'Gruppo' }],
};
const links: Link[] = [
  { id: 'k1', from: 'n1', to: 'r1' },
  { id: 'k2', from: 'doc:a.md', to: 'n1' },
  { id: 'k3', from: 'r1', to: 'doc:a.md' },
  { id: 'k4', from: 'f1', to: 'n2' },
];

describe('removeBoardItems', () => {
  it('toglie note e cornici con i loro collegamenti', () => {
    const r = removeBoardItems(wb, links, ['n1', 'f1']);
    expect(r.whiteboard.notes.map((n) => n.id)).toEqual(['n2']);
    expect(r.whiteboard.frames).toEqual([]);
    expect(r.links.map((l) => l.id)).toEqual(['k3']);
  });

  it('lascia stare pergamene e risorse', () => {
    const r = removeBoardItems(wb, links, ['doc:a.md', 'r1']);
    expect(r.whiteboard).toBe(wb);
    expect(r.links).toBe(links);
  });

  it('non tocca le posizioni degli altri nodi', () => {
    expect(removeBoardItems(wb, links, ['n2']).whiteboard.nodes).toEqual(wb.nodes);
  });
});
