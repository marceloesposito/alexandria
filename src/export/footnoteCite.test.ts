import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../doc/parse';
import { toTypst } from './typst';
import { toHtml } from './html';
import { toPlainText } from './plain';
import { defaultDocSettings } from '../layout/model';
import type { ExportContext } from './context';
import type { CitationItem } from '../doc/types';

// stile a note: nel testo la citazione diventa nota; dentro una nota la fonte va per esteso
const ctx: ExportContext = {
  settings: defaultDocSettings('it'),
  title: 'Prova',
  lang: 'it',
  cite: (items: CitationItem[], inNote?: boolean) => (inNote ? { text: `PER ESTESO ${items[0].key}`, note: false } : { text: `breve ${items[0].key}`, note: true }),
  image: () => null,
  math: () => null,
};

describe('fonte in una nota a piè di pagina', () => {
  const doc = parseMarkdown('Testo[^1].\n\n[^1]: [@halb, p. 12]');
  it('Typst: una sola nota, con la fonte per esteso (mai una nota nella nota)', () => {
    const out = toTypst(doc, ctx);
    expect(out).toContain('#footnote[#"PER ESTESO halb"]');
    expect(out.match(/#footnote/g)?.length).toBe(1);
  });
  it('HTML e testo semplice', () => {
    expect(toHtml(doc, ctx)).toContain('PER ESTESO halb');
    expect(toPlainText(doc, ctx)).toContain('PER ESTESO halb');
  });
});
