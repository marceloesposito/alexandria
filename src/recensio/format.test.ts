import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { packRecensio, unpackRecensio, returnedName, reviewBranch, RECENSIO_FORMAT, type RecensioContent } from './format';

const content: RecensioContent = {
  manifest: {
    format: RECENSIO_FORMAT,
    version: 1,
    title: 'Tesi',
    author: 'M. E.',
    compendium: 'Il mio Compendium',
    created: '2026-10-05T10:00:00Z',
    baseSha: 'abc123',
    docs: [
      { rel: 'documents/Capitolo 1.md', title: 'Capitolo 1' },
      { rel: 'documents/Parte/Capitolo 2.md', title: 'Capitolo 2' },
    ],
  },
  texts: { 'documents/Capitolo 1.md': 'Uno <ins data-author="R">nuovo</ins>.', 'documents/Parte/Capitolo 2.md': 'Due.' },
  comments: { 'documents/Capitolo 1.md': { version: 1, comments: [{ id: 'c1', body: 'ok' }] } },
  sources: { r1: { meta: { id: 'r1', title: 'Halbwachs' }, files: { 'thumb.webp': new Uint8Array([1, 2, 3]) } } },
};

describe('copia per revisione (.recensio)', () => {
  it('Compendium con le cartelle nuove: i percorsi tornano uguali, qualunque Compendium sia aperto', async () => {
    const dirs = { docs: 'Pergamene', res: 'Armarium' };
    const nuovo: RecensioContent = {
      ...content,
      manifest: { ...content.manifest, dirs, docs: [{ rel: 'Pergamene/Parte/Capitolo.md', title: 'Capitolo' }] },
      texts: { 'Pergamene/Parte/Capitolo.md': 'Testo.' },
      comments: { 'Pergamene/Parte/Capitolo.md': { version: 1, comments: [] } },
    };
    const back = await unpackRecensio(await packRecensio(nuovo));
    expect(back.manifest.dirs).toEqual(dirs);
    expect(back.manifest.docs.map((d) => d.rel)).toEqual(['Pergamene/Parte/Capitolo.md']);
    expect(back.texts['Pergamene/Parte/Capitolo.md']).toBe('Testo.');
    expect(back.comments['Pergamene/Parte/Capitolo.md']).toEqual({ version: 1, comments: [] });
  });

  it('impacchetta e rilegge tutto', async () => {
    const back = await unpackRecensio(await packRecensio(content));
    expect(back.manifest.docs.map((d) => d.title)).toEqual(['Capitolo 1', 'Capitolo 2']);
    expect(back.texts['documents/Parte/Capitolo 2.md']).toBe('Due.');
    expect(back.comments['documents/Capitolo 1.md']).toEqual(content.comments['documents/Capitolo 1.md']);
    expect([...back.sources.r1.files['thumb.webp']]).toEqual([1, 2, 3]);
  });
  it('rifiuta file estranei e percorsi che escono dal Compendium', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ ...content.manifest, docs: [{ rel: 'documents/../../evil.md', title: 'x' }] }));
    zip.file('armarium/../x/meta.json', '{}');
    const back = await unpackRecensio(await zip.generateAsync({ type: 'uint8array' }));
    expect(back.manifest.docs).toEqual([]);
    expect(back.sources).toEqual({});
    const bad = new JSZip();
    bad.file('manifest.json', JSON.stringify({ format: 'altro', docs: [] }));
    await expect(unpackRecensio(await bad.generateAsync({ type: 'uint8array' }))).rejects.toThrow();
  });
  it('nomi del file restituito e del branch', () => {
    expect(returnedName('Tesi: cap. 1', 'Prof. Rossi')).toBe('Tesi cap. 1 - rev Prof. Rossi.recensio');
    expect(reviewBranch('Prof. Rossì', '2026-10-05T12:00:00Z')).toBe('revisione-prof-rossi-2026-10-05');
  });
});
