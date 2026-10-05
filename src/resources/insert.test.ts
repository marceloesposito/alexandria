import { describe, expect, it } from 'vitest';
import { classifyTransfer, embedAttrsFor, nodeFor } from './insert';
import type { Resource } from './model';

const tr = (p: Partial<Parameters<typeof classifyTransfer>[0]>) => classifyTransfer({ types: [], fileCount: 0, uriList: '', plain: '', ...p });

const res = (p: Partial<Resource>): Resource => ({
  id: 'r1',
  kind: 'web',
  title: 'Pagina',
  csl: null,
  citeKey: null,
  isSource: false,
  tags: [],
  layers: [],
  created: '2026-10-05',
  meta: {},
  pins: [],
  ...p,
});

describe('classificazione di cio che si trascina o si incolla', () => {
  it('i file vincono sul link che il browser allega', () => {
    expect(tr({ fileCount: 1, uriList: 'https://example.org/a.png' })).toEqual({ kind: 'files' });
  });

  it('riconosce text/uri-list e ignora i commenti', () => {
    expect(tr({ uriList: '# commento\r\nhttps://example.org/pagina\r\n' })).toEqual({ kind: 'links', urls: ['https://example.org/pagina'] });
  });

  it('accetta testo fatto solo di link, anche piu di uno', () => {
    expect(tr({ plain: 'https://a.org/x\nexample.com/y' })).toEqual({ kind: 'links', urls: ['https://a.org/x', 'example.com/y'] });
  });

  it('lascia stare il testo normale anche se contiene un link', () => {
    expect(tr({ plain: 'leggi https://a.org/x domani' })).toBeNull();
    expect(tr({ plain: '' })).toBeNull();
  });
});

describe('schede embed', () => {
  it('pagina web: link esterno e foto della pagina relativa al documento', () => {
    const r = res({ url: 'https://example.org', meta: { screenshot: 'screenshot.webp', thumb: 'thumb.webp' } });
    expect(embedAttrsFor(r, 'documents/Capitolo.md')).toEqual({
      url: 'https://example.org',
      title: 'Pagina',
      resource: 'r1',
      image: '../resources/r1/screenshot.webp',
    });
  });

  it('file e snippet: il link punta al file nel vault', () => {
    const r = res({ kind: 'snippet', title: 'Parser', file: 'snippet.ts' });
    expect(embedAttrsFor(r, 'Nota.md')).toEqual({ url: 'resources/r1/snippet.ts', title: 'Parser', resource: 'r1', image: null });
  });

  it('le immagini diventano figure', () => {
    expect(nodeFor(res({ kind: 'image', file: 'source.png', title: 'Grafico' }), 'Nota.md')).toEqual({
      type: 'figure',
      attrs: { src: 'resources/r1/source.png', caption: 'Grafico' },
    });
  });
});
