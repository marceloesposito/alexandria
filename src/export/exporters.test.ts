// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../doc/parse';
import { defaultDocSettings } from '../layout/model';
import { toPlainText } from './plain';
import { toHtml, escapeHtml } from './html';
import { toLatex, escapeTex } from './latex';
import type { ExportContext } from './context';

const MD = `# Titolo

Testo con **grassetto** e <script>alert(1)</script> & una citazione [@halb1925, p. 12] e una nota[^1].

- uno
- due

[link](javascript:alert(1)) e [buono](https://example.org)

[^1]: La nota.
`;

const ctx = (note = false): ExportContext => ({
  settings: defaultDocSettings('it'),
  title: 'Prova',
  lang: 'it',
  cite: (items) => ({ text: note ? 'Halbwachs, Cadres, 12.' : `(Halbwachs, 1925, ${items[0].locator})`, note }),
  image: () => null,
  math: () => null,
});

describe('testo semplice', () => {
  it('citazioni come testo, note in fondo', () => {
    const t = toPlainText(parseMarkdown(MD), ctx());
    expect(t).toContain('Titolo\n======');
    expect(t).toContain('(Halbwachs, 1925, p. 12)');
    expect(t).toContain('[1] La nota.');
    expect(t).toContain('- uno\n- due');
  });
  it('stile a note: anche le citazioni vanno in fondo', () => {
    const t = toPlainText(parseMarkdown(MD), ctx(true));
    expect(t).toContain('[1] Halbwachs, Cadres, 12.');
    expect(t).toContain('[2] La nota.');
  });
});

describe('HTML', () => {
  it('niente markup dall utente e link sicuri', () => {
    const h = toHtml(parseMarkdown(MD), ctx());
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
    expect(h).not.toContain('javascript:');
    expect(h).toContain('href="https://example.org"');
    expect(h).toContain('id="fn1"');
    expect(escapeHtml('"<&>')).toBe('&quot;&lt;&amp;&gt;');
  });
});

describe('LaTeX', () => {
  it('citazioni biblatex e caratteri speciali', () => {
    const { tex } = toLatex(parseMarkdown(MD + '\nCosto 5% & #1 $x$ e_y.\n'), ctx(), 'saggio.bib');
    expect(tex).toContain('\\parencite[p.~12]{halb1925}');
    expect(tex).toContain('\\addbibresource{saggio.bib}');
    expect(tex).toContain('\\section{Titolo}');
    expect(tex).toContain('\\footnote{La nota.}');
    // $x$ e' una formula: in LaTeX resta tale
    expect(tex).toContain('5\\% \\& \\#1 $x$ e\\_y');
    expect(escapeTex('a\\b')).toBe('a\\textbackslash{}b');
  });
});

describe('colori negli export', () => {
  const md = 'Testo <span data-color="red">rosso</span> e <mark data-color="green">verde</mark> e <mark>giallo</mark>.\n';

  it('HTML: colori di stampa, niente tag sconosciuti', () => {
    const h = toHtml(parseMarkdown(md), ctx());
    expect(h).toContain('<span style="color: #a83a2c">rosso</span>');
    expect(h).toContain('<mark style="background: #cfe5c8">verde</mark>');
    expect(h).toContain('<mark>giallo</mark>');
    expect(h).not.toContain('undefined');
  });

  it('Typst: #text(fill) e #highlight(fill)', async () => {
    const { toTypst } = await import('./typst');
    const src = toTypst(parseMarkdown(md), ctx());
    expect(src).toContain('#text(fill: rgb("#a83a2c"))[#"rosso"]');
    expect(src).toContain('#highlight(fill: rgb("#cfe5c8"))[#"verde"]');
    expect(src).toContain('#highlight[#"giallo"]');
  });

  it('LaTeX e testo semplice: il testo resta', () => {
    expect(toPlainText(parseMarkdown(md), ctx())).toContain('Testo rosso e verde e giallo.');
    expect(toLatex(parseMarkdown(md), ctx(), 'b.bib').tex).toContain('rosso');
  });
});
