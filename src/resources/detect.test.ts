import { describe, it, expect } from 'vitest';
import { detectFile, detectUrl, sniff, splitLinks, findDoi, findIsbn } from './detect';
import { topTerms, suggestGroups, tokenize } from './suggest';
import type { Resource } from './model';

const bytes = (s: string) => new TextEncoder().encode(s);

describe('riconoscimento dei file', () => {
  it('dalla firma, anche con estensione sbagliata', () => {
    expect(detectFile('documento.txt', '', bytes('%PDF-1.7 ...'))).toBe('pdf');
    expect(detectFile('x', '', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBe('image');
    expect(detectFile('a.rtf', '', bytes('{\\rtf1\\ansi ciao}'))).toBe('rtf');
    expect(sniff(bytes('PK\u0003\u0004....mimetypeapplication/epub+zip'))).toBe('epub');
  });
  it('dall estensione e dal MIME', () => {
    expect(detectFile('note.md', '', bytes('# titolo'))).toBe('markdown');
    expect(detectFile('refs.bib', '', bytes('@article{a,'))).toBe('reference');
    expect(detectFile('clip', 'video/mp4', new Uint8Array([0, 0, 0, 0]))).toBe('video');
    expect(detectFile('senza', '', bytes('solo testo'))).toBe('text');
    expect(detectFile('bin', '', new Uint8Array([1, 0, 2, 3]))).toBe('other');
  });
});

describe('riconoscimento dei link', () => {
  it('YouTube in tutte le forme', () => {
    for (const u of ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1s', 'youtube.com/shorts/dQw4w9WgXcQ']) {
      expect(detectUrl(u)).toMatchObject({ kind: 'youtube', videoId: 'dQw4w9WgXcQ' });
    }
  });
  it('file diretti, pagine, DOI', () => {
    expect(detectUrl('https://example.org/paper.pdf')?.kind).toBe('pdf');
    expect(detectUrl('https://example.org/foto.JPG')?.kind).toBe('image');
    expect(detectUrl('example.org/articolo')).toMatchObject({ kind: 'web', url: 'https://example.org/articolo' });
    expect(detectUrl('10.1000/xyz123')?.url).toBe('https://doi.org/10.1000/xyz123');
    expect(detectUrl('non è un link')).toBeNull();
  });
  it('piu link incollati insieme', () => {
    expect(splitLinks('https://a.org/x\nhttps://youtu.be/dQw4w9WgXcQ, testo')).toHaveLength(2);
  });
  it('DOI e ISBN nel testo', () => {
    expect(findDoi('vedi doi:10.1093/acprof:oso/9780199.001.0001 per')).toBe('10.1093/acprof:oso/9780199.001.0001');
    expect(findIsbn('ISBN 978-88-06-21789-1')).toBe('9788806217891');
  });
});

function res(id: string, p: Partial<Resource>): Resource {
  return { id, kind: 'pdf', title: id, csl: null, citeKey: null, isSource: false, tags: [], layers: [], created: '', meta: {}, pins: [], ...p };
}

describe('suggerimenti', () => {
  it('parole caratteristiche', () => {
    const t = topTerms(
      new Map([
        ['a', 'memoria memoria collettiva sociale'],
        ['b', 'memoria luoghi monumenti città'],
        ['c', 'economia mercato mercato prezzi'],
      ]),
      2,
    );
    expect(t.get('c')).toEqual(['mercato', 'economia']);
    expect(tokenize('Della città')).toEqual(['citta']);
  });

  it('gruppi per autore, tag e parole chiave con motivazione', () => {
    const rs = [
      res('a', { csl: { author: [{ family: 'Halbwachs' }] }, tags: ['memoria'] }),
      res('b', { csl: { author: [{ family: 'Halbwachs' }] }, tags: ['memoria'] }),
      res('c', { kind: 'image' }),
    ];
    const texts = new Map([
      ['a', 'quadri sociali della memoria collettiva'],
      ['b', 'memoria collettiva e tempo'],
      ['c', 'fotografia di una piazza'],
    ]);
    const s = suggestGroups(rs, texts);
    const keys = s.map((x) => x.key);
    expect(keys).toContain('author:halbwachs');
    expect(keys).toContain('tag:memoria');
    expect(s.find((x) => x.key === 'author:halbwachs')!.reason).toEqual({ code: 'suggest.reason.author', vars: { author: 'Halbwachs', n: 2 } });
    // quelli scartati non tornano
    expect(suggestGroups(rs, texts, new Set(['author:halbwachs'])).map((x) => x.key)).not.toContain('author:halbwachs');
  });
});
