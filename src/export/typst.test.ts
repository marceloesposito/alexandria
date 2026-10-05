import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { toTypst, str } from './typst';
import { parseMarkdown } from '../doc/parse';
import { defaultDocSettings } from '../layout/model';
import type { ExportContext } from './context';

const SAMPLE = `<!-- section master="title" columns="1" -->

# La memoria dei luoghi <!-- align:center -->

Saggio di prova <!-- align:center -->

<!-- section master="body" columns="1" -->

<!-- toc -->

## Introduzione

Testo con **grassetto**, *corsivo*, <u>sottolineato</u>, ~~barrato~~, \`codice\`, <mark>evidenza</mark>, H<sub>2</sub>O, x<sup>2</sup> e un [link](https://example.org). Caratteri speciali: # $ * _ @ < > [ ] \\\\ "virgolette" // non un commento.

Una citazione [@halb1925, p. 12] e una nota[^1]. Formula $a^2+b^2$ nel testo.

$$
E = mc^2
$$

> Citazione in blocco.

- uno
- due
  - annidato

3. tre
4. quattro

- [ ] da fare
- [x] fatto

| A | B |
| :--- | ---: |
| 1 | 2 |

\`\`\`js
const a = "x";
\`\`\`

![Didascalia](img.png){placement=top width=50%}

<!-- pagebreak -->

<!-- bibliography:start -->

## Bibliografia

Halbwachs, M. (1925). *Les cadres sociaux de la mémoire*.

<!-- bibliography:end -->

[^1]: Nota con *corsivo* e [@halb1925].
`;

function ctx(lineNumbers = true): ExportContext {
  const settings = defaultDocSettings('it');
  settings.author = 'Autrice "Prova"';
  settings.layout.lineNumbersInPdf = lineNumbers;
  settings.layout.headingNumbers = true;
  settings.layout.masters.body.header = '{title} — {chapter}';
  settings.layout.masters.body.pageNumbers = 'bottom-outer';
  settings.layout.facingPages = true;
  return {
    settings,
    title: 'La memoria dei luoghi',
    lang: 'it',
    cite: (items) => ({ text: `(Halbwachs, 1925${items[0]?.locator ? ', ' + items[0].locator : ''})`, note: false }),
    image: (src) => (src === 'img.png' ? { path: 'img/0.svg', data: new Uint8Array(), mime: 'image/svg+xml' } : null),
    math: (latex, display) => ({ path: `math/${display ? 'd' : 'i'}${latex.length}.svg`, svg: '', widthEm: 2, heightEm: 1, depthEm: 0.2 }),
  };
}

describe('Typst', () => {
  it('stringhe sicure', () => {
    expect(str('a "b" \\ c\nd')).toBe('"a \\"b\\" \\\\ c\\nd"');
  });

  it('genera il sorgente con impaginazione e contenuti', () => {
    const src = toTypst(parseMarkdown(SAMPLE), ctx());
    expect(src).toContain('#set page(width: 210mm, height: 297mm');
    expect(src).toContain('#set par.line(numbering: "1"');
    expect(src).toContain('#heading(level: 2)[#"Introduzione"]');
    expect(src).toContain('#strong[#"grassetto"]');
    expect(src).toContain('#footnote[');
    expect(src).toContain('#"(Halbwachs, 1925, p. 12)"');
    expect(src).toContain('#outline(');
    expect(src).toContain('placement: top');
    expect(src).toContain('<sec-1>');
    // il testo dell'utente non diventa mai markup
    expect(src).not.toMatch(/\n# /);
    // fixture per il test Rust che compila davvero con Typst
    mkdirSync('src-tauri/tests/fixtures', { recursive: true });
    writeFileSync('src-tauri/tests/fixtures/sample.typ', src);
  });

  it('stile a note: le citazioni diventano note', () => {
    const c = ctx(false);
    c.cite = () => ({ text: 'Halbwachs, Les cadres, 12.', note: true });
    const src = toTypst(parseMarkdown('Testo [@a].'), c);
    expect(src).toContain('#footnote[#"Halbwachs, Les cadres, 12."]');
  });
});
