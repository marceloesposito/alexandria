// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, InsertedTextRun, DeletedTextRun, CommentRangeStart, CommentRangeEnd, CommentReference } from 'docx';
import { importFile, textToMarkdown } from './importDoc';
import { newSheet, pack } from './format';

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const enc = (s: string) => new TextEncoder().encode(s);

async function wordFile(): Promise<Uint8Array> {
  const d = new Document({
    comments: { children: [{ id: 0, author: 'Relatrice', date: new Date('2026-10-01'), children: [new Paragraph('Da chiarire')] }] },
    sections: [
      {
        children: [
          new Paragraph({ text: 'Introduzione', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            children: [
              new TextRun('Il testo '),
              new InsertedTextRun({ text: 'nuovo ', id: 1, author: 'R', date: '2026-10-01T10:00:00Z' }),
              new DeletedTextRun({ text: 'vecchio ', id: 2, author: 'R', date: '2026-10-01T10:00:00Z' }),
              new TextRun('resta. '),
              new CommentRangeStart(0),
              new TextRun('Frase commentata'),
              new CommentRangeEnd(0),
              new TextRun({ children: [new CommentReference(0)] }),
              new TextRun(' e fine.'),
            ],
          }),
          new Paragraph({ children: [new ImageRun({ type: 'png', data: PNG, transformation: { width: 10, height: 10 } })] }),
        ],
      },
    ],
  });
  return new Uint8Array(await Packer.toArrayBuffer(d));
}

describe('Apri', () => {
  it('un .docx diventa un foglio: revisioni accettate, commenti e immagini', async () => {
    const s = await importFile('C:/Tesi/Capitolo.docx', await wordFile());
    expect(s.meta.name).toBe('Capitolo');
    expect(s.markdown).toContain('# Introduzione');
    expect(s.markdown).toContain('Il testo nuovo resta.');
    expect(s.markdown).not.toContain('vecchio');
    expect(Object.keys(s.media)).toEqual(['immagine-1.png']);
    expect(s.markdown).toContain('media/immagine-1.png');
    expect(s.comments.comments).toHaveLength(1);
    const c = s.comments.comments[0];
    expect(c).toMatchObject({ author: 'Relatrice', body: 'Da chiarire', origin: { kind: 'word' } });
    expect(c.anchor?.quote).toBe('Frase commentata');
  });

  it('un .clmn torna com e', async () => {
    const orig = newSheet('f1', new Date('2026-10-17T10:00:00Z'), 'Saggio');
    orig.markdown = 'ciao\n';
    const s = await importFile('/x/Saggio.clmn', await pack(orig));
    expect(s.markdown).toBe('ciao\n');
    expect(s.meta.name).toBe('Saggio');
  });

  it('Markdown e testo', async () => {
    expect((await importFile('/a/Note.md', enc('# Titolo\n'))).markdown).toBe('# Titolo\n');
    const txt = await importFile('/a/appunti.txt', enc('riga uno\nriga due\n\nsecondo'));
    expect(txt.meta.name).toBe('appunti');
    expect(txt.markdown).toBe(textToMarkdown('riga uno\nriga due\n\nsecondo'));
    expect(txt.markdown).toContain('secondo');
  });

  it('un file sconosciuto o rovinato da un errore chiaro', async () => {
    await expect(importFile('/a/foto.png', PNG)).rejects.toThrow();
    await expect(importFile('/a/rotto.clmn', enc('nulla'))).rejects.toThrow();
  });
});
