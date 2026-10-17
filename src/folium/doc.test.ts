import { describe, expect, it } from 'vitest';
import { acceptRevisions, docToMarkdown, markdownToDoc } from './doc';

describe('testo del foglio', () => {
  it('accetta le revisioni tracciate', () => {
    const md = 'Una <ins data-author="R">frase nuova</ins> e <del data-author="R">vecchia</del> **fine**\n';
    expect(docToMarkdown(markdownToDoc(md)).trim()).toBe('Una frase nuova e  **fine**');
  });

  it('senza revisioni il Markdown torna uguale', () => {
    const md = '# Titolo\n\nUn paragrafo con *corsivo* e una nota.[^1]\n\n- uno\n- due\n\n[^1]: La nota.\n';
    expect(docToMarkdown(markdownToDoc(md))).toBe(docToMarkdown(markdownToDoc(docToMarkdown(markdownToDoc(md)))));
    expect(docToMarkdown(markdownToDoc(md))).toContain('# Titolo');
  });

  it('un testo vuoto ha un paragrafo', () => {
    expect(markdownToDoc('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('i segni delle revisioni spariscono anche dentro altri nodi', () => {
    const doc = acceptRevisions({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a', marks: [{ type: 'insertion' }, { type: 'bold' }] }] }],
    });
    expect(doc.content![0].content![0]).toEqual({ type: 'text', text: 'a', marks: [{ type: 'bold' }] });
  });
});
