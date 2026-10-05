import { describe, expect, it } from 'vitest';
import { docBlocks, docDiff, diffCounts } from './docDiff';

describe('confronto leggibile fra versioni', () => {
  it('blocchi del documento, non righe di Markdown', () => {
    const b = docBlocks('# Titolo\n\nUn **paragrafo**.\n\n- uno\n- due\n\n> citazione\n');
    expect(b.map((x) => x.kind)).toEqual(['h1', 'p', 'list', 'quote']);
    expect(b[1].text).toBe('Un paragrafo.');
    expect(b[2].text).toBe('• uno\n• due');
  });

  it('uguali, modificati, aggiunti e tolti, allineati', () => {
    const before = '# Titolo\n\nPrimo paragrafo.\n\nSecondo paragrafo.\n\nDa togliere.\n';
    const after = '# Titolo\n\nPrimo paragrafo rivisto.\n\nSecondo paragrafo.\n\nNuovo in fondo.\n\n## Aggiunta\n';
    const rows = docDiff(before, after);
    expect(rows.map((r) => r.kind)).toEqual(['same', 'mod', 'same', 'mod', 'add']);
    expect(rows[1].before?.text).toBe('Primo paragrafo.');
    expect(rows[1].after?.text).toBe('Primo paragrafo rivisto.');
    expect(rows[4].after?.kind).toBe('h2');
    expect(diffCounts(rows)).toEqual({ added: 1, removed: 0, changed: 2 });
  });

  it('un blocco di tipo diverso non e una modifica ma un cambio', () => {
    const rows = docDiff('Testo.\n', '## Testo.\n');
    expect(rows.map((r) => r.kind)).toEqual(['del', 'add']);
  });

  it('documento nuovo o identico', () => {
    expect(docDiff('', 'Ciao.\n').map((r) => r.kind)).toEqual(['add']);
    expect(docDiff('Ciao.\n', 'Ciao.\n').every((r) => r.kind === 'same')).toBe(true);
  });
});
