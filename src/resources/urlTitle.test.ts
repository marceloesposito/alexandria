import { describe, it, expect } from 'vitest';
import { titleFromUrl, siteOf } from './urlTitle';

describe('titolo dall\'indirizzo', () => {
  it('pagina di un libro MIT Press', () => {
    const u = 'https://direct.mit.edu/books/monograph/2994/How-Things-Shape-the-MindA-Theory-of-Material';
    expect(titleFromUrl(u)).toBe('How Things Shape the Mind: A Theory of Material');
    expect(siteOf(u)).toBe('direct.mit.edu');
  });

  it('articoli con estensione e trattini bassi', () => {
    expect(titleFromUrl('https://www.example.org/blog/2024/03/la_memoria_collettiva.html')).toBe('La memoria collettiva');
    expect(siteOf('https://www.example.org/x')).toBe('example.org');
  });

  it('senza un percorso leggibile resta il sito', () => {
    expect(titleFromUrl('https://example.org/')).toBe('example.org');
    expect(titleFromUrl('https://example.org/item/12345')).toBe('example.org');
    expect(titleFromUrl('non un indirizzo')).toBe('non un indirizzo');
  });

  it('non spezza parole come iPhone o McDonald', () => {
    expect(titleFromUrl('https://ex.org/news/the-new-iPhone-review')).toBe('The new iPhone review');
  });
});
