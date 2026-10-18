import { describe, expect, it } from 'vitest';
import { planToCompendium, safeFileName, type CompendiumInfo } from './toCompendium';
import { newSheet } from './format';
import { record } from './versions/tree';

const now = new Date('2026-10-17T12:00:00Z');
const idOf = (i: number) => `r${i}`;

function info(over: Partial<CompendiumInfo> = {}): CompendiumInfo {
  return { dirs: { docs: 'Pergamene', res: 'Armarium' }, docNames: [], resourceIds: [], whiteboard: null, links: [], ...over };
}

describe('Porta in un Compendium', () => {
  it('scrive la pergamena con un nome libero e solo il testo attuale', () => {
    const s = newSheet('f', now, 'Saggio');
    s.markdown = 'Testo attuale\n';
    s.tree = record(s.tree, { id: 'v1', at: 1, auto: true });
    s.versions.v1 = 'vecchio';
    const plan = planToCompendium(s, 'Saggio', info({ docNames: ['Saggio.md', 'saggio 2.md'] }), { now, idOf });
    expect(plan.docRel).toBe('Pergamene/Saggio 3.md');
    expect(plan.writes).toEqual([{ path: 'Pergamene/Saggio 3.md', data: 'Testo attuale\n' }]);
  });

  it('i media diventano risorse e le figure puntano li', () => {
    const s = newSheet('f', now);
    s.markdown = '![Una foto](media/foto.png)\n';
    s.media['foto.png'] = new Uint8Array([1, 2, 3]);
    const plan = planToCompendium(s, 'Foto', info({ resourceIds: ['r0'] }), { now, idOf });
    const paths = plan.writes.map((w) => w.path);
    expect(paths).toContain('Armarium/r1/foto.png');
    const meta = JSON.parse(plan.writes.find((w) => w.path === 'Armarium/r1/meta.json')!.data as string);
    expect(meta).toMatchObject({ id: 'r1', kind: 'image', file: 'foto.png', meta: { mime: 'image/png', size: 3 } });
    expect(plan.writes.find((w) => w.path === plan.docRel)!.data).toContain('../Armarium/r1/foto.png');
  });

  it('Marginalia e Tabula passano ad Alexandria senza toccare quello che c era', () => {
    const s = newSheet('f', now);
    s.markdown = 'ciao\n';
    s.comments.comments.push({ id: 'c1', author: 'M', body: 'x', created: '', anchor: null, offsetX: null, offsetY: null, resolved: false, status: 'open', commits: [], replies: [] });
    s.tabula.blocks.push(
      { id: 'a', kind: 'note', text: 'idea', x: 10, y: 10, w: 220, h: 80 },
      { id: 'b', kind: 'excerpt', text: '', anchor: { kind: 'text', from: 1, to: 5, quote: 'ciao', prefix: '', suffix: '' }, x: 10, y: 130, w: 220, h: 80 },
      { id: 'c', kind: 'link', text: 'Sito', url: 'https://example.org', x: 300, y: 130, w: 220, h: 80 },
    );
    s.tabula.links.push({ id: 'k', from: 'a', to: 'b' }, { id: 'k2', from: 'a', to: 'c' });
    const old = { version: 1 as const, nodes: { x: { x: 0, y: 0 } }, notes: [{ id: 'old', x: 0, y: 0, w: 100, h: 100, text: 'vecchio' }], frames: [] };
    const plan = planToCompendium(s, 'Nota', info({ dirs: undefined, whiteboard: old, links: [{ id: 'k0', from: 'x', to: 'old' }] }), { now, idOf });
    expect(plan.docRel).toBe('documents/Nota.md');
    const get = (p: string) => JSON.parse(plan.writes.find((w) => w.path === p)!.data as string);
    expect(get('.alexandria/comments/Nota.json').comments).toHaveLength(1);
    const wb = get('.alexandria/whiteboard.json');
    expect(wb.notes.map((n: { text: string }) => n.text)).toEqual(['vecchio', 'idea', '«ciao»']);
    expect(wb.notes[1].x).toBeGreaterThan(100);
    expect(Object.keys(wb.nodes)).toEqual(['x', 'r2']);
    expect(get('resources/r2/meta.json')).toMatchObject({ kind: 'web', url: 'https://example.org', title: 'Sito' });
    const links = get('.alexandria/links.json').links;
    expect(links).toHaveLength(3);
    expect(links[0].id).toBe('k0');
  });

  it('nomi di file validi', () => {
    expect(safeFileName('Tesi: cap. 1?')).toBe('Tesi cap. 1');
    expect(safeFileName('con')).toBe('_con');
    expect(safeFileName('...')).toBe('Column');
  });
});
