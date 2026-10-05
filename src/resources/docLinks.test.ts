import { describe, expect, it } from 'vitest';
import { linkedDocs, renameDocRefs, dropDocRefs, docNodeId, relOfNode } from './docLinks';
import type { Link, Whiteboard } from './storage';

const L = (from: string, to: string, id = `${from}>${to}`): Link => ({ id, from, to });
const wb = (): Whiteboard => ({ version: 1, nodes: { 'doc:documents/a.md': { x: 1, y: 2 } }, notes: [], frames: [], docs: ['documents/a.md', 'documents/b.md'] });

describe('pergamene collegate', () => {
  it('id dei nodi', () => {
    expect(docNodeId('documents/a.md')).toBe('doc:documents/a.md');
    expect(relOfNode('doc:documents/a.md')).toBe('documents/a.md');
    expect(relOfNode('r123')).toBeNull();
  });

  it('collegate in entrambi i versi, senza doppioni e senza risorse', () => {
    const links = [L('doc:documents/a.md', 'doc:documents/b.md'), L('doc:documents/c.md', 'doc:documents/a.md'), L('doc:documents/b.md', 'doc:documents/a.md', 'dup'), L('doc:documents/a.md', 'r1')];
    expect(linkedDocs(links, 'documents/a.md')).toEqual(['documents/b.md', 'documents/c.md']);
    expect(linkedDocs(links, 'documents/z.md')).toEqual([]);
  });

  it('una pergamena rinominata si porta dietro legami e posizione', () => {
    const r = renameDocRefs([L('doc:documents/a.md', 'doc:documents/b.md')], wb(), 'documents/a.md', 'documents/A2.md');
    expect(r.links[0].from).toBe('doc:documents/A2.md');
    expect(r.whiteboard.nodes['doc:documents/A2.md']).toEqual({ x: 1, y: 2 });
    expect(r.whiteboard.nodes['doc:documents/a.md']).toBeUndefined();
    expect(r.whiteboard.docs).toEqual(['documents/A2.md', 'documents/b.md']);
  });

  it('una pergamena eliminata sparisce dalla Tabula e dai legami', () => {
    const r = dropDocRefs([L('doc:documents/a.md', 'doc:documents/b.md'), L('r1', 'r2')], wb(), 'documents/a.md');
    expect(r.links.map((l) => l.id)).toEqual(['r1>r2']);
    expect(r.whiteboard.docs).toEqual(['documents/b.md']);
  });
});
