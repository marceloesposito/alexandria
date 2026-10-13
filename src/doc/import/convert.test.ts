// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, FootnoteReferenceRun, Table, TableRow, TableCell,
  ImageRun, InsertedTextRun, DeletedTextRun, CommentRangeStart, CommentRangeEnd, CommentReference,
} from 'docx';
import { serializeMarkdown } from 'logos/doc/serialize';
import { parseMarkdown } from 'logos/doc/parse';
import { convertFile, detectFormat, replaceImageKeys, textToDoc, IMAGE_KEY } from './convert';

const fixture = (n: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', n)));
const md = (d: Parameters<typeof serializeMarkdown>[0] | null) => serializeMarkdown(d!);
const enc = (s: string) => new TextEncoder().encode(s);

// PNG 1x1
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

async function wordFile(): Promise<Uint8Array> {
  const d = new Document({
    footnotes: { 1: { children: [new Paragraph({ children: [new TextRun('Fonte della '), new TextRun({ text: 'nota', italics: true })] })] } },
    comments: { children: [{ id: 0, author: 'Relatrice', date: new Date('2026-10-01'), children: [new Paragraph('Da chiarire')] }] },
    sections: [
      {
        children: [
          new Paragraph({ text: 'Introduzione', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            children: [
              new TextRun('Testo con '),
              new TextRun({ text: 'grassetto', bold: true }),
              new TextRun(' e una nota'),
              new FootnoteReferenceRun(1),
              new TextRun('. Vedi '),
              new ExternalHyperlink({ link: 'https://codeberg.org', children: [new TextRun('Codeberg')] }),
              new TextRun('.'),
            ],
          }),
          new Paragraph({ text: 'Metodo', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: 'primo punto', bullet: { level: 0 } }),
          new Paragraph({ text: 'secondo punto', bullet: { level: 0 } }),
          new Table({
            rows: [
              new TableRow({ children: [new TableCell({ children: [new Paragraph('Anno')] }), new TableCell({ children: [new Paragraph('Valore')] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph('2025')] }), new TableCell({ children: [new Paragraph('42')] })] }),
            ],
          }),
          new Paragraph({ children: [new ImageRun({ type: 'png', data: PNG, transformation: { width: 10, height: 10 }, altText: { name: 'grafico', description: 'Il grafico', title: 'Grafico' } })] }),
          new Paragraph({
            children: [
              new TextRun('La frase '),
              new DeletedTextRun({ text: 'vecchia', id: 1, author: 'Relatrice', date: '2026-10-01T10:00:00Z' }),
              new InsertedTextRun({ text: 'nuova', id: 2, author: 'Relatrice', date: '2026-10-01T10:00:00Z' }),
              new TextRun(' e '),
              new CommentRangeStart(0),
              new TextRun('un commento'),
              new CommentRangeEnd(0),
              new TextRun({ children: [new CommentReference(0)] }),
              new TextRun('.'),
            ],
          }),
        ],
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(d));
}

describe('import di documenti: formato', () => {
  it('riconosce il formato dal contenuto prima che dal nome', async () => {
    expect(await detectFormat('x.doc', fixture('sample.doc'))).toBe('doc');
    expect(await detectFormat('x.doc', fixture('sample.rtf'))).toBe('rtf');
    expect(await detectFormat('senza-estensione', fixture('sample.docx'))).toBe('docx');
    expect(await detectFormat('x.odt', fixture('sample.odt'))).toBe('odt');
    expect(await detectFormat('a.html', enc('<p>ciao</p>'))).toBe('html');
    expect(await detectFormat('a.md', enc('# Titolo'))).toBe('markdown');
    expect(await detectFormat('a.txt', enc('ciao'))).toBe('text');
    expect(await detectFormat('x.doc', new Uint8Array([1, 0, 2, 0]))).toBe(null);
  });

  it('un documento di Pages non si apre (va esportato in Word)', async () => {
    const zip = new JSZip();
    zip.file('Index/Document.iwa', 'x');
    await expect(convertFile('tesi.pages', await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow('pages');
  });
});

describe('import di documenti: Word (.docx)', () => {
  it('titoli, grassetto, note, link, elenchi, tabelle e immagini', async () => {
    const r = await convertFile('Tesi.docx', await wordFile());
    expect(r.title).toBe('Tesi');
    const out = md(r.doc);
    expect(out).toContain('# Introduzione');
    expect(out).toContain('## Metodo');
    expect(out).toContain('Testo con **grassetto** e una nota[^1]. Vedi [Codeberg](https://codeberg.org).');
    expect(out).toContain('[^1]: Fonte della *nota*');
    expect(out).toContain('- primo punto\n- secondo punto');
    expect(out).toContain('| Anno | Valore |\n| --- | --- |\n| 2025 | 42 |');
    expect(r.images).toHaveLength(1);
    expect(r.images[0].data).toEqual(PNG);
    expect(out).toContain(`![Il grafico](${IMAGE_KEY}1)`);
    // nessuna traccia della nota ripetuta in fondo
    expect(out).not.toMatch(/↑/);
  });

  it('revisioni tracciate: la pergamena parte dal testo originale e la revisione si riporta dopo', async () => {
    const r = await convertFile('Tesi.docx', await wordFile());
    const out = md(r.doc);
    expect(out).toContain('La frase vecchia e un commento.');
    expect(out).not.toContain('nuova');
    expect(r.review?.comments.map((c) => c.text)).toEqual(['Da chiarire']);
    const runs = r.review!.paragraphs.flat();
    expect(runs.some((x) => x.kind === 'ins' && x.text === 'nuova')).toBe(true);
    expect(runs.some((x) => x.kind === 'del' && x.text === 'vecchia')).toBe(true);
  });

  it('immagini: i segnaposto diventano i percorsi nell\'Armarium', async () => {
    const r = await convertFile('Tesi.docx', await wordFile());
    const d = replaceImageKeys(r.doc!, (k) => (k === `${IMAGE_KEY}1` ? '../Armarium/r1/grafico.png' : null));
    expect(md(d)).toContain('![Il grafico](../Armarium/r1/grafico.png)');
    expect(md(replaceImageKeys(r.doc!, () => null))).not.toContain('![');
  });
});

describe('import di documenti: altri formati', () => {
  it('Word 97-2003 (.doc)', async () => {
    const r = await convertFile('vecchio.doc', fixture('sample.doc'));
    const out = md(r.doc);
    expect(out).toContain('Un paragrafo con **grassetto**, *corsivo* e <u>sottolineato</u>. Città è già perché.');
    expect(out).toContain('| A1 | B1 |\n| --- | --- |\n| A2 | B2 |');
    expect(out.trim().endsWith('Fine.')).toBe(true);
  });

  it('OpenDocument (.odt)', async () => {
    const out = md((await convertFile('libre.odt', fixture('sample.odt'))).doc);
    expect(out).toContain('Secondo paragrafo con un [<u>link</u>](https://codeberg.org/).');
    expect(out).toContain('- primo punto\n- secondo punto');
    expect(out).toContain('1. uno\n2. due');
    expect(out).toContain('| A1 | B1 |');
  });

  it('OpenDocument: titoli dagli stili, note ed elenchi numerati', async () => {
    const content = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink">
<office:automatic-styles>
  <style:style style:name="T1" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>
  <text:list-style style:name="L1"><text:list-level-style-number text:level="1" style:num-format="1"/></text:list-style>
</office:automatic-styles>
<office:body><office:text>
  <text:h text:style-name="Heading_20_1" text:outline-level="1">Capitolo</text:h>
  <text:p text:style-name="Title_20_2">Sezione</text:p>
  <text:p text:style-name="Standard">Una <text:span text:style-name="T1">parola</text:span>  qui<text:note text:note-class="footnote"><text:note-citation>1</text:note-citation><text:note-body><text:p>Nota in fondo.</text:p></text:note-body></text:note>.<office:annotation><text:p>commento</text:p></office:annotation></text:p>
  <text:list text:style-name="L1"><text:list-item><text:p>uno</text:p></text:list-item><text:list-item><text:p>due</text:p></text:list-item></text:list>
  <text:p text:style-name="Quotations">Una citazione.</text:p>
</office:text></office:body></office:document-content>`;
    const styles = `<?xml version="1.0"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"><office:styles>
      <style:style style:name="Title_20_2" style:display-name="Titolo 2" style:family="paragraph"/>
      <style:style style:name="Quotations" style:family="paragraph"/>
    </office:styles></office:document-styles>`;
    const zip = new JSZip();
    zip.file('mimetype', 'application/vnd.oasis.opendocument.text');
    zip.file('content.xml', content);
    zip.file('styles.xml', styles);
    const out = md((await convertFile('a.odt', await zip.generateAsync({ type: 'uint8array' }))).doc);
    expect(out).toBe('# Capitolo\n\n## Sezione\n\nUna *parola* qui[^1].\n\n1. uno\n2. due\n\n> Una citazione.\n\n[^1]: Nota in fondo.\n');
  });

  it('RTF (TextEdit)', async () => {
    const out = md((await convertFile('nota.rtf', fixture('sample.rtf'))).doc);
    expect(out).toContain('Un paragrafo con **grassetto**, *corsivo* e <u>sottolineato</u>. Città è già perché.');
    expect(out).toContain('Secondo paragrafo con un [link](https://codeberg.org/).');
    expect(out).toContain('- primo punto\n- secondo punto\n\n1. uno\n2. due\n\n| A1 | B1 |');
  });

  it('RTF: titoli dagli stili e note', async () => {
    const rtf = String.raw`{\rtf1\ansi{\stylesheet{\s0 Normal;}{\s1 heading 1;}}
{\pard\s1 Titolo\par}
{\pard Testo\chftn{\footnote\pard\plain\chftn Una \i nota\i0 .} finale\'e8.\par}}`;
    expect(md((await convertFile('a.rtf', enc(rtf))).doc)).toBe('# Titolo\n\nTesto[^1] finaleè.\n\n[^1]: Una *nota*.\n');
  });

  it('HTML esportato (note alla Google Docs, stili in linea, niente script)', async () => {
    const html = `<html><head><title>x</title><style>p{}</style></head><body>
      <h1>Titolo</h1>
      <p><span style="font-weight:700">forte</span> e <span style="font-style:italic">obliquo</span><sup><a href="#ftnt1" id="ftnt_ref1">[1]</a></sup></p>
      <script>alert(1)</script>
      <img src="https://esempio.org/x.png">
      <hr><div><p><a href="#ftnt_ref1" id="ftnt1">[1]</a> Il testo della nota.</p></div>
    </body></html>`;
    const r = await convertFile('pagina.html', enc(html));
    expect(md(r.doc)).toBe('# Titolo\n\n**forte** e *obliquo*[^1]\n\n[^1]: Il testo della nota.\n');
    expect(r.images).toHaveLength(0);
  });

  it('Markdown resta com\'e\'; il testo semplice va a paragrafi', async () => {
    const r = await convertFile('a.md', enc('# Ciao\r\n\r\n[[Altra]] pergamena\r\n'));
    expect(r.markdown).toBe('# Ciao\n\n[[Altra]] pergamena\n');
    expect(md(textToDoc('Primo\nsegue\n\n\nSecondo  paragrafo'))).toBe('Primo\\\nsegue\n\nSecondo paragrafo\n');
  });

  it('il risultato si rilegge uguale (Markdown della pergamena stabile)', async () => {
    for (const [n, data] of [
      ['a.docx', await wordFile()],
      ['b.doc', fixture('sample.doc')],
      ['c.odt', fixture('sample.odt')],
      ['d.rtf', fixture('sample.rtf')],
    ] as const) {
      const out = md((await convertFile(n, data)).doc);
      expect(md(parseMarkdown(out))).toBe(out);
    }
  });
});
