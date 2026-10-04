// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parsePage, parseName, parseDate } from './html';

const PAGE = `<!doctype html><html><head>
<title>Titolo di pagina | Rivista</title>
<meta name="citation_title" content="La memoria dei luoghi">
<meta name="citation_author" content="Rossi, Maria">
<meta name="citation_author" content="Paolo De Luca">
<meta name="citation_publication_date" content="2021/03/15">
<meta name="citation_journal_title" content="Studi Urbani">
<meta name="citation_doi" content="10.1234/su.2021.7">
<meta name="citation_firstpage" content="45"><meta name="citation_lastpage" content="67">
<meta property="og:site_name" content="Rivista">
<meta property="og:image" content="/img/cover.jpg">
<script>window.evil = 1</script>
</head><body><nav>Menu</nav><article><h1>La memoria dei luoghi</h1>
<p>Primo paragrafo con abbastanza testo per essere riconosciuto come contenuto principale dell'articolo, e anche di più.</p>
<p>Secondo paragrafo, altrettanto lungo, che parla di monumenti, piazze e ricordi condivisi dalla comunità urbana.</p>
<blockquote>Una citazione nel testo.</blockquote></article><footer>Copyright</footer></body></html>`;

describe('pagine web', () => {
  it('metadati bibliografici dai meta tag', () => {
    const p = parsePage(PAGE, 'https://rivista.example/articolo');
    expect(p.title).toBe('La memoria dei luoghi');
    expect(p.csl).toMatchObject({
      type: 'article-journal',
      DOI: '10.1234/su.2021.7',
      page: '45-67',
      'container-title': 'Studi Urbani',
      issued: { 'date-parts': [[2021, 3, 15]] },
      author: [
        { family: 'Rossi', given: 'Maria' },
        { family: 'De Luca', given: 'Paolo' },
      ],
    });
    expect(p.image).toBe('https://rivista.example/img/cover.jpg');
  });

  it('testo dell articolo senza menu, script e piede', () => {
    const p = parsePage(PAGE, 'https://rivista.example/articolo');
    const text = p.blocks.map((b) => b.text).join(' ');
    expect(text).toContain('Primo paragrafo');
    expect(text).not.toContain('Menu');
    expect(text).not.toContain('evil');
    expect(p.blocks.some((b) => b.t === 'q')).toBe(true);
  });

  it('nomi e date', () => {
    expect(parseName('Umberto Eco')).toEqual({ family: 'Eco', given: 'Umberto' });
    expect(parseName('Ludwig van Beethoven')).toEqual({ family: 'van Beethoven', given: 'Ludwig' });
    expect(parseDate('2020-05')).toEqual({ 'date-parts': [[2020, 5]] });
    expect(parseDate('primavera')).toEqual({ literal: 'primavera' });
  });
});
