// Pagine web e HTML: metadati bibliografici dai meta tag (Highwire/citation_*, Dublin Core,
// Open Graph, JSON-LD) e testo dell'articolo con Readability, salvato come blocchi di solo testo.
import { Readability } from '@mozilla/readability';
import type { CslItem } from './model';

export interface Block {
  t: 'h' | 'p' | 'li' | 'q' | 'pre';
  text: string;
}

export interface PageInfo {
  title: string;
  csl: CslItem;
  siteName?: string;
  description?: string;
  image?: string; // URL assoluto
  blocks: Block[];
}

function metas(doc: Document, names: string[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    doc.querySelectorAll(`meta[name="${n}" i], meta[property="${n}" i]`).forEach((m) => {
      const c = m.getAttribute('content')?.trim();
      if (c) out.push(c);
    });
  }
  return out;
}

function meta(doc: Document, names: string[]): string | undefined {
  return metas(doc, names)[0];
}

export function parseName(raw: string): { family?: string; given?: string; literal?: string } {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return { literal: '' };
  if (s.includes(',')) {
    const [family, given] = s.split(',', 2).map((x) => x.trim());
    return { family, given };
  }
  const parts = s.split(' ');
  if (parts.length === 1) return { family: s };
  // particelle (de, di, van, von, da...) restano nel cognome
  let i = parts.length - 1;
  while (i > 1 && /^(de|di|da|del|della|van|von|der|le|la)$/i.test(parts[i - 1])) i--;
  return { family: parts.slice(i).join(' '), given: parts.slice(0, i).join(' ') };
}

export function parseDate(raw: string | undefined): CslItem['issued'] | undefined {
  if (!raw) return undefined;
  const m = /(\d{4})(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?)?/.exec(raw);
  if (!m) return { literal: raw };
  const parts = [Number(m[1])];
  if (m[2]) parts.push(Number(m[2]));
  if (m[3]) parts.push(Number(m[3]));
  return { 'date-parts': [parts] };
}

function jsonLd(doc: Document): Record<string, unknown> | null {
  for (const s of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const j = JSON.parse(s.textContent ?? '');
      const list = Array.isArray(j) ? j : j['@graph'] ? j['@graph'] : [j];
      const art = list.find((x: Record<string, unknown>) =>
        /Article|BlogPosting|ScholarlyArticle|NewsArticle|Book|WebPage/.test(String(x['@type'])),
      );
      if (art) return art;
    } catch {
      /* JSON-LD non valido: si ignora */
    }
  }
  return null;
}

function absolute(u: string | undefined, base: string): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u, base).href;
  } catch {
    return undefined;
  }
}

export function pageMetadata(doc: Document, url: string): Omit<PageInfo, 'blocks'> {
  const ld = jsonLd(doc);
  const title =
    meta(doc, ['citation_title', 'dc.title', 'og:title', 'twitter:title']) ??
    (typeof ld?.headline === 'string' ? ld.headline : undefined) ??
    doc.title?.trim() ??
    url;
  let authors = metas(doc, ['citation_author', 'dc.creator', 'author', 'article:author']);
  if (!authors.length && ld?.author) {
    const a = Array.isArray(ld.author) ? ld.author : [ld.author];
    authors = a.map((x) => (typeof x === 'string' ? x : String((x as { name?: string }).name ?? ''))).filter(Boolean);
  }
  authors = authors.filter((a) => !/^https?:/.test(a));
  const date =
    meta(doc, ['citation_publication_date', 'citation_date', 'dc.date', 'article:published_time', 'date']) ??
    (typeof ld?.datePublished === 'string' ? ld.datePublished : undefined);
  const doi = meta(doc, ['citation_doi', 'dc.identifier'])?.replace(/^doi:/i, '');
  const journal = meta(doc, ['citation_journal_title', 'citation_conference_title']);
  const siteName = meta(doc, ['og:site_name', 'application-name']);
  const csl: CslItem = {
    type: journal ? 'article-journal' : 'webpage',
    title,
    URL: url,
    accessed: { 'date-parts': [[new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()]] },
  };
  if (authors.length) csl.author = authors.map(parseName);
  const issued = parseDate(date);
  if (issued) csl.issued = issued;
  if (doi && /^10\./.test(doi)) csl.DOI = doi;
  if (journal ?? siteName) csl['container-title'] = journal ?? siteName;
  const vol = meta(doc, ['citation_volume']);
  const iss = meta(doc, ['citation_issue']);
  const fp = meta(doc, ['citation_firstpage']);
  const lp = meta(doc, ['citation_lastpage']);
  if (vol) csl.volume = vol;
  if (iss) csl.issue = iss;
  if (fp) csl.page = lp ? `${fp}-${lp}` : fp;
  const pub = meta(doc, ['citation_publisher', 'dc.publisher']);
  if (pub) csl.publisher = pub;
  return {
    title,
    csl,
    siteName,
    description: meta(doc, ['description', 'og:description', 'dc.description']),
    image: absolute(meta(doc, ['og:image', 'twitter:image', 'citation_image']), url),
  };
}

/** Blocchi di testo dell'articolo principale (niente HTML conservato: solo testo). */
export function articleBlocks(doc: Document): { blocks: Block[]; byline?: string; title?: string } {
  const clone = doc.cloneNode(true) as Document;
  let root: Element | null = null;
  let byline: string | undefined;
  let title: string | undefined;
  try {
    const art = new Readability(clone, { keepClasses: false }).parse();
    if (art?.content) {
      const parsed = new DOMParser().parseFromString(art.content, 'text/html');
      root = parsed.body;
      byline = art.byline ?? undefined;
      title = art.title ?? undefined;
    }
  } catch {
    root = null;
  }
  root ??= doc.body;
  const blocks: Block[] = [];
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const tag = child.tagName.toLowerCase();
      const text = (child.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (/^h[1-6]$/.test(tag)) {
        if (text) blocks.push({ t: 'h', text });
      } else if (tag === 'p') {
        if (text) blocks.push({ t: 'p', text });
      } else if (tag === 'li') {
        if (text) blocks.push({ t: 'li', text });
      } else if (tag === 'blockquote') {
        if (text) blocks.push({ t: 'q', text });
      } else if (tag === 'pre') {
        if (text) blocks.push({ t: 'pre', text: child.textContent ?? '' });
      } else if (['script', 'style', 'nav', 'footer', 'aside', 'form', 'noscript'].includes(tag)) {
        continue;
      } else walk(child);
    }
  };
  if (root) walk(root);
  if (!blocks.length && root?.textContent?.trim()) {
    root.textContent
      .split(/\n{2,}/)
      .map((x) => x.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .forEach((text) => blocks.push({ t: 'p', text }));
  }
  return { blocks, byline, title };
}

export function parsePage(html: string, url: string): PageInfo {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = pageMetadata(doc, url);
  const art = articleBlocks(doc);
  if (!meta.csl.author?.length && art.byline) {
    const name = art.byline.replace(/^(di|by)\s+/i, '').split(/,| e | and /)[0];
    if (name && name.length < 60) meta.csl.author = [parseName(name)];
  }
  return { ...meta, blocks: art.blocks };
}

export function blocksToText(blocks: Block[]): string {
  return blocks.map((b) => b.text).join('\n\n');
}
