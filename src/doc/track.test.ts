import { describe, it, expect } from 'vitest';
import { parseMarkdown } from './parse';
import { serializeMarkdown } from './serialize';

describe('revisioni tracciate in Markdown', () => {
  it('<ins> e <del> diventano segni con autore e data, e tornano identici', () => {
    const md = 'Il <del data-author="Prof. Rossi" data-date="2026-10-05">primo</del><ins data-author="Prof. Rossi" data-date="2026-10-05">secondo</ins> capitolo.';
    const doc = parseMarkdown(md);
    const p = doc.content![0];
    const del = p.content!.find((n) => n.marks?.some((m) => m.type === 'deletion'))!;
    expect(del.text).toBe('primo');
    expect(del.marks![0].attrs).toEqual({ author: 'Prof. Rossi', date: '2026-10-05' });
    expect(serializeMarkdown(doc).trim()).toBe(md);
  });
  it('gli spazi restano dentro la revisione e gli altri segni si annidano', () => {
    const md = 'Testo<ins data-author="A"> **molto** </ins>bello.';
    const out = serializeMarkdown(parseMarkdown(md)).trim();
    expect(out).toBe(md);
  });
  it('autori diversi non si fondono', () => {
    const md = '<ins data-author="A">uno</ins><ins data-author="B">due</ins>';
    expect(serializeMarkdown(parseMarkdown(md)).trim()).toBe(md);
  });
  it('virgolette nel nome dell\'autore', () => {
    const md = '<del data-author="M. &quot;Ed&quot; E.">x</del>';
    const doc = parseMarkdown(md);
    expect(doc.content![0].content![0].marks![0].attrs!.author).toBe('M. "Ed" E.');
    expect(serializeMarkdown(doc).trim()).toBe(md);
  });
});

import { cleanRevisions } from '../export/run';
describe('testo pulito per l\'export', () => {
  it('le cancellazioni spariscono, le aggiunte restano senza segno', () => {
    const doc = parseMarkdown('Il <del data-author="A">primo</del><ins data-author="A">**secondo**</ins> capitolo.');
    expect(serializeMarkdown(cleanRevisions(doc)).trim()).toBe('Il **secondo** capitolo.');
  });
});
