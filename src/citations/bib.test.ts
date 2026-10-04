import { describe, it, expect } from 'vitest';
import { parseBibliography, toBibtex } from './bib';

describe('BibTeX e RIS', () => {
  it('legge BibTeX', () => {
    const items = parseBibliography(`@book{halbwachs1950,
  author = {Halbwachs, Maurice},
  title = {La mémoire collective},
  year = {1950},
  publisher = {PUF}
}`);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'book', title: 'La mémoire collective', publisher: 'PUF' });
    expect(items[0].author?.[0]).toMatchObject({ family: 'Halbwachs', given: 'Maurice' });
    expect(items[0]['citation-key']).toBe('halbwachs1950');
  });

  it('legge RIS', () => {
    const items = parseBibliography(`TY  - JOUR
AU  - Nora, Pierre
TI  - Between Memory and History
JO  - Representations
PY  - 1989
SP  - 7
EP  - 24
ER  - `);
    expect(items[0]).toMatchObject({ type: 'article-journal', title: 'Between Memory and History' });
  });

  it('scrive BibTeX', () => {
    const bib = toBibtex([{ id: 'eco1962', type: 'book', title: 'Opera aperta', author: [{ family: 'Eco', given: 'Umberto' }], issued: { 'date-parts': [[1962]] } }]);
    expect(bib).toContain('@book{eco1962');
    expect(bib).toContain('Opera aperta');
  });
});
