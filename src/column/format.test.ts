import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { FormatError, displayName, fileStem, mediaName, newSheet, normalizeMeta, pack, sheetFiles, sheetFromFiles, unpack, type Sheet } from './format';
import { record } from './versions/tree';

function sample(): Sheet {
  const s = newSheet('f1', new Date('2026-10-17T10:00:00Z'), 'Saggio');
  s.markdown = '# Titolo\n\nUn paragrafo con **grassetto**.\n';
  s.comments.comments.push({
    id: 'c1',
    author: 'M',
    body: 'Rivedere',
    created: '2026-10-17T10:00:00Z',
    anchor: { kind: 'text', from: 10, to: 20, quote: 'paragrafo', prefix: 'Un ', suffix: ' con' },
    offsetX: null,
    offsetY: null,
    resolved: false,
    status: 'open',
    commits: [],
    replies: [],
  });
  s.tabula.blocks.push({ id: 'b1', kind: 'note', text: 'idea', x: 0, y: 0, w: 220, h: 80 });
  s.tree = record(s.tree, { id: 'v1', at: 1, auto: false, label: 'Prima' });
  s.versions.v1 = '# Titolo\n';
  s.media['foto.png'] = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  return s;
}

describe('formato .clmn', () => {
  it("andata e ritorno dallo zip", async () => {
    const s = sample();
    const back = await unpack(await pack(s), 'x');
    expect(back).toEqual(s);
  });

  it('andata e ritorno dai file della cartella di lavoro', () => {
    const s = sample();
    expect(sheetFromFiles(sheetFiles(s), 'x')).toEqual(s);
  });

  it('un formato piu nuovo o un file qualsiasi si rifiutano', async () => {
    expect(() => normalizeMeta({ format: 99 }, 'x')).toThrow(FormatError);
    const zip = new JSZip();
    zip.file('altro.txt', 'ciao');
    await expect(unpack(await zip.generateAsync({ type: 'uint8array' }), 'x')).rejects.toMatchObject({ code: 'notColumn' });
    await expect(unpack(new Uint8Array([1, 2, 3]), 'x')).rejects.toMatchObject({ code: 'notColumn' });
  });

  it('un vecchio foglio di Folium (folium.json) si legge ancora', () => {
    const s = sheetFromFiles(new Map([['folium.json', JSON.stringify({ format: 1, id: 'v', name: 'Vecchio' })], ['testo.md', 'ciao']]), 'x');
    expect(s.meta.name).toBe('Vecchio');
  });

  it('un foglio con il solo testo e meta incompleti si apre', () => {
    const s = sheetFromFiles(new Map([['testo.md', 'ciao']]), 'id9');
    expect(s.meta).toMatchObject({ id: 'id9', font: 'serif', view: 'write', split: 0.55 });
    expect(s.markdown).toBe('ciao');
    expect(s.tabula.blocks).toEqual([]);
  });

  it('nomi', () => {
    expect(displayName({ meta: { ...newSheet('a', new Date()).meta }, markdown: '\n\n## Il *mio* capitolo\ntesto' }, 'Senza titolo')).toBe('Il mio capitolo');
    expect(displayName({ meta: { ...newSheet('a', new Date()).meta }, markdown: '' }, 'Senza titolo')).toBe('Senza titolo');
    expect(displayName({ meta: { ...newSheet('a', new Date()).meta }, markdown: '\\# Non un titolo <span data-color="red">rosso</span>' }, 'x')).toBe('# Non un titolo rosso');
    expect(displayName({ meta: { ...newSheet('a', new Date()).meta }, markdown: '|  |  |\n| --- | --- |\n| Anno | Dato |' }, 'x')).toBe('Anno Dato');
    expect(mediaName('a/b:c.png', ['b-c.png'])).toBe('a-b-c.png');
    expect(mediaName('x.png', ['x.png', 'x-2.png'])).toBe('x-3.png');
    expect(fileStem('  Tesi: capitolo 1?  ')).toBe('Tesi capitolo 1');
  });
});
