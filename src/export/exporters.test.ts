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

describe('riquadri evidenziati e didascalie negli export', () => {
  const md = '> [!WARNING]\n>\n> Controllare le date.\n\n> [!TIP] Consiglio pratico\n>\n> Rileggi ad alta voce.\n\nFigura 1. <!-- style:caption -->\n';

  it('HTML: riquadro colorato, intestazione nella lingua del documento, didascalia', () => {
    const h = toHtml(parseMarkdown(md), ctx());
    expect(h).toContain('class="callout callout-warning"');
    expect(h).toContain('>Attenzione</p>'); // senza titolo: il nome del tipo in italiano
    expect(h).toContain('>Consiglio pratico</p>');
    expect(h).toContain('<p class="caption">Figura 1.</p>');
  });

  it('Typst: blocco con fondo e bordo, didascalia con lo stile del layout', async () => {
    const { toTypst } = await import('./typst');
    const src = toTypst(parseMarkdown(md), ctx());
    expect(src).toContain('#block(width: 100%, inset: (x: 10pt, y: 8pt), radius: 3pt, fill: rgb("#fbf5ea"), stroke: 0.6pt + rgb("#a8741a"))');
    expect(src).toContain('#upper[#"Attenzione"]');
    expect(src).toMatch(/#align\(center\)\[#text\(size: 10pt, style: "italic"\)\[#"Figura 1."\]\]/);
  });

  it('testo semplice: intestazione tra parentesi e contenuto rientrato', () => {
    const p = toPlainText(parseMarkdown(md), ctx());
    expect(p).toContain('[Attenzione]');
    expect(p).toContain('    Controllare le date.');
  });
});

describe('carattere per stile', () => {
  const styled = (): ExportContext => {
    const c = ctx();
    const L = c.settings.layout;
    return {
      ...c,
      settings: {
        ...c.settings,
        layout: { ...L, styles: { ...L.styles, body: { ...L.styles.body, font: 'sans' }, h1: { ...L.styles.h1, font: 'mono' }, caption: { ...L.styles.caption, font: 'serif' } } },
      },
    };
  };
  const md = '# Titolo\n\nTesto.\n\nFigura 1. <!-- style:caption -->\n';

  it('PDF: corpo Sans per tutto il testo, titolo 1 Monospace, didascalia Serif', async () => {
    const { toTypst } = await import('./typst');
    const src = toTypst(parseMarkdown(md), styled());
    expect(src).toContain('font: ("New Computer Modern Sans", "DejaVu Sans")');
    expect(src).toMatch(/#show heading\.where\(level: 1\): set text\(size: [\d.]+pt, font: \("DejaVu Sans Mono",\)/);
    expect(src).toContain('font: ("Libertinus Serif", "New Computer Modern"))[#"Figura 1."]');
  });

  it('HTML: famiglie con i ripieghi di sistema', () => {
    const h = toHtml(parseMarkdown(md), styled());
    expect(h).toContain('body { font-family: Inter, "Helvetica Neue", Arial, sans-serif;');
    expect(h).toContain('h1 { font-family: "JetBrains Mono", Menlo, Consolas, monospace; }');
    expect(h).toContain('figcaption, p.caption { font-family: "Libertinus Serif", Georgia, serif; }');
  });

  it('di serie gli stili usano il carattere del documento', async () => {
    const { toTypst } = await import('./typst');
    expect(toTypst(parseMarkdown(md), ctx())).not.toContain('DejaVu Sans Mono');
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
