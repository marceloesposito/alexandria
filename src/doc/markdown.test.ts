import { describe, it, expect } from 'vitest';
import { parseMarkdown } from './parse';
import { serializeMarkdown } from './serialize';
import { parseCitation, formatCitation, makeCiteKey } from './citeSyntax';
import type { PMNode } from './types';

function roundTrip(md: string) {
  const doc = parseMarkdown(md);
  const out = serializeMarkdown(doc);
  return { doc, out };
}

// Markdown gia' nella forma canonica: deve uscire identico.
const CANONICAL = [
  '# Titolo\n',
  'Testo **grassetto**, *corsivo*, ~~barrato~~, `codice` e [link](https://example.org "T").\n',
  '## Sotto <!-- align:center -->\n',
  'Paragrafo centrato <!-- align:center -->\n',
  '- uno\n- due\n  - annidato\n- tre\n',
  '3. tre\n4. quattro\n',
  '- [ ] da fare\n- [x] fatto\n',
  '> Citazione\n>\n> secondo paragrafo\n',
  '```js\nconst a = 1;\n```\n',
  '---\n',
  '$$\nE = mc^2\n$$\n',
  'Formula $a^2 + b^2$ in linea.\n',
  'Come detto [@rossi2020, p. 12; -@bianchi2019, cap. 3].\n',
  'Vedi [[Capitolo 2|il secondo]] e [[Note]].\n',
  'Una nota[^1] e un\'altra[^2].\n\n[^1]: Prima nota.\n[^2]: Seconda con *enfasi*.\n',
  '![Didascalia](img/a.png "titolo"){placement=top width=60%}\n',
  '[Il sito](https://example.org/pagina){embed resource=r1a2 image="../resources/r1a2/shot.png"}\n',
  '[Relazione.pdf](../resources/r9/Relazione.pdf){embed resource=r9}\n',
  '<!-- pagebreak -->\n',
  '<!-- section master="body" columns="2" -->\n',
  '<!-- toc -->\n',
  '| A | B |\n| :---: | ---: |\n| 1 | 2 |\n',
  'Testo <u>sottolineato</u>, <mark>evidenziato</mark>, H<sub>2</sub>O e x<sup>2</sup>.\n',
  'Colori: <span data-color="red">rosso</span>, <mark data-color="green">verde</mark> e <span data-color="blue"><mark data-color="yellow">entrambi</mark></span>.\n',
  'Due evidenziatori vicini: <mark data-color="pink">rosa</mark><mark data-color="blue">blu</mark>.\n',
  '> [!NOTE] Da ricordare\n>\n> Il capitolo 2 va rivisto.\n',
  '> [!WARNING]\n>\n> Primo paragrafo.\n>\n> - punto\n> - altro punto\n',
  '> [!TIP] Titolo con \\*asterischi\\*\n>\n> Testo **forte**.\n',
  'Figura 1: la pianta del tempio. <!-- style:caption -->\n',
  'Didascalia a destra <!-- style:caption --> <!-- align:right -->\n',
  '<!-- bibliography:start -->\n\n## Bibliografia\n\nRossi, M. (2020). *Titolo*.\n\n<!-- bibliography:end -->\n',
  'Costa \\$5 e \\*non\\* enfasi, \\[parentesi\\].\n',
  '\\# non titolo\n',
  'Riga\\\ncon a capo.\n',
  '***grassetto corsivo*** e **grassetto *misto***.\n',
  '<https://example.org>\n',
];

describe('markdown round trip', () => {
  for (const md of CANONICAL) {
    it(JSON.stringify(md.slice(0, 40)), () => {
      expect(roundTrip(md).out).toBe(md);
    });
  }

  it('documento -> md -> documento e\' stabile', () => {
    const md = CANONICAL.join('\n');
    const a = parseMarkdown(md);
    const b = parseMarkdown(serializeMarkdown(a));
    expect(b).toEqual(a);
  });
});

describe('blocchi evidenziati e didascalie', () => {
  it('avviso con titolo e contenuto', () => {
    const c = parseMarkdown('> [!IMPORTANT] Scadenza\n>\n> Consegna il 10.\n').content![0];
    expect(c).toMatchObject({ type: 'callout', attrs: { kind: 'important', title: 'Scadenza' } });
    expect(c.content![0].content![0].text).toBe('Consegna il 10.');
  });

  it('avvisi scritti altrove: titolo e testo sulla stessa citazione, tipo in minuscolo', () => {
    const c = parseMarkdown('> [!tip]\n> Una riga sola.\n').content![0];
    expect(c).toMatchObject({ type: 'callout', attrs: { kind: 'tip', title: '' } });
    expect(JSON.stringify(c.content)).toContain('Una riga sola.');
  });

  it('una citazione normale e un tipo sconosciuto restano citazioni', () => {
    expect(parseMarkdown('> Citazione.\n').content![0].type).toBe('blockquote');
    expect(parseMarkdown('> [!FOO] x\n').content![0].type).toBe('blockquote');
  });

  it('didascalia: stile del paragrafo', () => {
    const p = parseMarkdown('Figura 2. <!-- style:caption --> <!-- align:center -->\n').content![0];
    expect(p.attrs).toEqual({ textStyle: 'caption', textAlign: 'center' });
    expect(p.content![0].text).toBe('Figura 2.');
  });
});

describe('colori', () => {
  it('testo ed evidenziazione con colore diventano segni con attrs', () => {
    const p = parseMarkdown('<span data-color="red">a</span> <mark data-color="green">b</mark> <mark>c</mark>\n').content![0];
    const marks = (p.content ?? []).filter((n) => n.text?.trim()).map((n) => n.marks);
    expect(marks).toEqual([[{ type: 'textColor', attrs: { color: 'red' } }], [{ type: 'highlight', attrs: { color: 'green' } }], [{ type: 'highlight' }]]);
  });

  it('colori fuori tavolozza e <span> qualsiasi restano testo, senza stili arbitrari', () => {
    const p = parseMarkdown('<span data-color="#ff0000">x</span> <span class="a">y</span>\n').content![0];
    expect((p.content ?? []).some((n) => n.marks?.some((m) => m.type === 'textColor'))).toBe(false);
  });
});

describe('parse', () => {
  it('riconosce le citazioni', () => {
    const { doc } = roundTrip('Vedi [@rossi2020, p. 12].');
    const p = doc.content![0];
    expect(p.content![1]).toEqual({ type: 'citation', attrs: { items: [{ key: 'rossi2020', locator: 'p. 12' }] } });
  });

  it('il codice non contiene citazioni', () => {
    const { doc } = roundTrip('`[@rossi2020]`');
    expect(doc.content![0].content![0].type).toBe('text');
  });

  it('immagine nel testo spezza il paragrafo', () => {
    const doc = parseMarkdown('prima ![x](a.png) dopo');
    expect(doc.content!.map((n) => n.type)).toEqual(['paragraph', 'figure', 'paragraph']);
  });

  it('note con contenuto', () => {
    const doc = parseMarkdown('Testo[^a].\n\n[^a]: La *nota*.');
    const fn = doc.content![0].content!.find((n) => n.type === 'footnote') as PMNode;
    expect(fn.attrs!.text).toBe('La *nota*.');
  });

  it('allineamento del titolo', () => {
    const doc = parseMarkdown('# Titolo <!-- align:right -->');
    expect(doc.content![0].attrs).toEqual({ level: 1, textAlign: 'right' });
    expect(doc.content![0].content).toEqual([{ type: 'text', text: 'Titolo' }]);
  });

  it('documento vuoto', () => {
    expect(parseMarkdown('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(serializeMarkdown({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('');
  });
});

describe('serialize', () => {
  it('gli spazi escono dall\'enfasi', () => {
    const doc: PMNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a' },
            { type: 'text', text: ' b ', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'c' },
          ],
        },
      ],
    };
    expect(serializeMarkdown(doc)).toBe('a **b** c\n');
  });

  it('codice con backtick', () => {
    const doc: PMNode = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a`b', marks: [{ type: 'code' }] }] }],
    };
    const md = serializeMarkdown(doc);
    expect(md).toBe('``a`b``\n');
    expect(parseMarkdown(md)).toEqual(doc);
  });
});

describe('citazioni', () => {
  it('analizza prefisso, locator e suffisso', () => {
    expect(parseCitation('vedi @a, pp. 3-4 e oltre; -@b')).toEqual([
      { key: 'a', prefix: 'vedi', locator: 'pp. 3-4', suffix: 'e oltre' },
      { key: 'b', suppressAuthor: true },
    ]);
    expect(parseCitation('nessuna chiave')).toBeNull();
  });

  it('formatta in sintassi Pandoc', () => {
    expect(formatCitation([{ key: 'a', locator: 'p. 2' }, { key: 'b', suppressAuthor: true }])).toBe('[@a, p. 2; -@b]');
  });

  it('chiavi uniche', () => {
    const taken = new Set(['rossi2020']);
    expect(makeCiteKey('Rossì', 2020, taken)).toBe('rossi2020a');
    expect(makeCiteKey('', undefined, new Set())).toBe('anon');
  });
});
