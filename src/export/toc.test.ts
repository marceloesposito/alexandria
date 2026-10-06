// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { withToc, hasToc } from './toc';
import { parseMarkdown } from '../doc/parse';
import { defaultDocSettings } from '../layout/model';
import { toHtml } from './html';
import { toTypst } from './typst';
import type { ExportContext } from './context';

const ctx: ExportContext = {
  settings: defaultDocSettings('it'),
  title: 'Prova',
  lang: 'it',
  cite: () => ({ text: '', note: false }),
  image: () => null,
  math: () => null,
};

describe("indice nell'export", () => {
  it('mette un blocco indice in testa, senza toccare il documento', () => {
    const doc = parseMarkdown('# Uno\n\ntesto\n\n## Due\n');
    const out = withToc(doc);
    expect(out.content?.[0]).toEqual({ type: 'toc' });
    expect(out.content?.slice(1)).toEqual(doc.content);
    expect(hasToc(doc)).toBe(false);
  });

  it("non lo raddoppia se la pergamena ne ha gia' uno", () => {
    const doc = parseMarkdown('# Uno\n\n<!-- toc -->\n\ntesto\n');
    expect(hasToc(doc)).toBe(true);
    expect(withToc(doc)).toBe(doc);
  });

  it('PDF e HTML lo rendono', () => {
    const doc = withToc(parseMarkdown('# Uno\n\ntesto\n'));
    expect(toTypst(doc, ctx)).toContain('#outline(');
    expect(toHtml(doc, ctx)).toContain('class="toc"');
  });
});
