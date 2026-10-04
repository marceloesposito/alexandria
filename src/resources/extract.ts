// Estrazione di testo, metadati e miniatura da ogni formato supportato.
// Tutto avviene in locale; nessuna libreria scarica nulla da internet.
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import type { CslItem, ResourceKind } from './model';
import { rtfToText } from './rtf';
import { parsePage, parseName, parseDate, blocksToText, type Block } from './html';
import { findDoi, findIsbn } from './detect';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface Extracted {
  title?: string;
  text: string;
  /** per i formati "a pagine" (PDF) il testo di ogni pagina */
  pages?: string[];
  blocks?: Block[];
  csl: CslItem;
  thumb?: Uint8Array;
  needsOcr?: boolean;
  width?: number;
  height?: number;
}

const THUMB_W = 360;

export function decodeText(bytes: Uint8Array): string {
  const s = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(s);
  } catch {
    return new TextDecoder('windows-1252').decode(s);
  }
}

async function canvasToBytes(canvas: HTMLCanvasElement): Promise<Uint8Array | undefined> {
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.82));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
}

export async function imageThumb(bytes: Uint8Array, mime: string): Promise<{ thumb?: Uint8Array; width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime || 'image/png' }));
    const scale = Math.min(1, THUMB_W / bmp.width);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * scale));
    c.height = Math.max(1, Math.round(bmp.height * scale));
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return { thumb: await canvasToBytes(c), width: bmp.width, height: bmp.height };
  } catch {
    return { width: 0, height: 0 };
  }
}

function pdfDate(raw: unknown): CslItem['issued'] | undefined {
  if (typeof raw !== 'string') return undefined;
  const m = /D:(\d{4})(\d{2})?(\d{2})?/.exec(raw);
  if (!m) return parseDate(raw);
  const parts = [Number(m[1])];
  if (m[2]) parts.push(Number(m[2]));
  if (m[3]) parts.push(Number(m[3]));
  return { 'date-parts': [parts] };
}

export async function openPdf(bytes: Uint8Array) {
  // pdf.js si prende il buffer: gli si passa una copia
  return pdfjs.getDocument({ data: bytes.slice() }).promise;
}

async function extractPdf(bytes: Uint8Array): Promise<Extracted> {
  const doc = await openPdf(bytes);
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let s = '';
    for (const it of content.items) {
      if (!('str' in it)) continue;
      s += it.str;
      s += it.hasEOL ? '\n' : ' ';
    }
    pages.push(s.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim());
  }
  const meta = (await doc.getMetadata().catch(() => null)) as { info?: Record<string, unknown> } | null;
  const info = meta?.info ?? {};
  const csl: CslItem = { type: 'article' };
  if (typeof info.Title === 'string' && info.Title.trim()) csl.title = info.Title.trim();
  if (typeof info.Author === 'string' && info.Author.trim())
    csl.author = info.Author.split(/;| and | e /).map((a) => parseName(a.trim())).filter((a) => a.family || a.literal);
  const issued = pdfDate(info.CreationDate);
  if (issued) csl.issued = issued;
  // miniatura della prima pagina
  let thumb: Uint8Array | undefined;
  try {
    const p1 = await doc.getPage(1);
    const vp1 = p1.getViewport({ scale: 1 });
    const vp = p1.getViewport({ scale: THUMB_W / vp1.width });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    await p1.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp }).promise;
    thumb = await canvasToBytes(c);
  } catch {
    thumb = undefined;
  }
  const text = pages.join('\n\f\n');
  const avg = text.replace(/\s/g, '').length / Math.max(1, doc.numPages);
  return { text, pages, csl, thumb, needsOcr: avg < 40 };
}

async function zipText(zip: JSZip, path: string): Promise<string | null> {
  const f = zip.file(path);
  return f ? f.async('string') : null;
}

function xml(s: string): Document {
  return new DOMParser().parseFromString(s, 'application/xml');
}

function tagText(doc: Document, names: string[]): string | undefined {
  for (const n of names) {
    const el = doc.getElementsByTagName(n)[0];
    const t = el?.textContent?.trim();
    if (t) return t;
  }
  return undefined;
}

async function extractDocx(bytes: Uint8Array): Promise<Extracted> {
  const mammoth = await import('mammoth');
  const res = await mammoth.extractRawText({ arrayBuffer: bytes.slice().buffer });
  const csl: CslItem = { type: 'document' };
  try {
    const zip = await JSZip.loadAsync(bytes);
    const core = await zipText(zip, 'docProps/core.xml');
    if (core) {
      const d = xml(core);
      const title = tagText(d, ['dc:title']);
      const creator = tagText(d, ['dc:creator']);
      const created = tagText(d, ['dcterms:created']);
      if (title) csl.title = title;
      if (creator) csl.author = [parseName(creator)];
      if (created) csl.issued = parseDate(created);
    }
  } catch {
    /* metadati facoltativi */
  }
  return { text: res.value.replace(/\n{3,}/g, '\n\n').trim(), csl };
}

/** Testo dei paragrafi di un documento XML (ODT, XHTML), un blocco per paragrafo. */
function paragraphs(doc: Document, tags: string[]): string[] {
  const out: string[] = [];
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (tags.includes(el.tagName.toLowerCase())) {
      const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
    }
  }
  return out;
}

async function extractOdt(bytes: Uint8Array): Promise<Extracted> {
  const zip = await JSZip.loadAsync(bytes);
  const content = await zipText(zip, 'content.xml');
  const text = content ? paragraphs(xml(content), ['text:p', 'text:h']).join('\n\n') : '';
  const csl: CslItem = { type: 'document' };
  const metaXml = await zipText(zip, 'meta.xml');
  if (metaXml) {
    const d = xml(metaXml);
    const title = tagText(d, ['dc:title']);
    const creator = tagText(d, ['meta:initial-creator', 'dc:creator']);
    const date = tagText(d, ['meta:creation-date', 'dc:date']);
    if (title) csl.title = title;
    if (creator) csl.author = [parseName(creator)];
    if (date) csl.issued = parseDate(date);
  }
  return { text, csl };
}

async function extractEpub(bytes: Uint8Array): Promise<Extracted> {
  const zip = await JSZip.loadAsync(bytes);
  const container = await zipText(zip, 'META-INF/container.xml');
  const opfPath = container ? xml(container).getElementsByTagName('rootfile')[0]?.getAttribute('full-path') : null;
  const csl: CslItem = { type: 'book' };
  if (!opfPath) return { text: '', csl };
  const opf = xml((await zipText(zip, opfPath)) ?? '');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const title = tagText(opf, ['dc:title']);
  if (title) csl.title = title;
  const creators = Array.from(opf.getElementsByTagName('dc:creator')).map((e) => e.textContent?.trim() ?? '').filter(Boolean);
  if (creators.length) csl.author = creators.map(parseName);
  const date = tagText(opf, ['dc:date']);
  if (date) csl.issued = parseDate(date);
  const pub = tagText(opf, ['dc:publisher']);
  if (pub) csl.publisher = pub;
  const lang = tagText(opf, ['dc:language']);
  if (lang) csl.language = lang;
  for (const idEl of Array.from(opf.getElementsByTagName('dc:identifier'))) {
    const isbn = findIsbn(`ISBN ${idEl.textContent ?? ''}`);
    if (isbn) csl.ISBN = isbn;
  }
  const manifest = new Map<string, string>();
  for (const it of Array.from(opf.getElementsByTagName('item'))) manifest.set(it.getAttribute('id') ?? '', it.getAttribute('href') ?? '');
  const chunks: string[] = [];
  for (const ref of Array.from(opf.getElementsByTagName('itemref'))) {
    const href = manifest.get(ref.getAttribute('idref') ?? '');
    if (!href) continue;
    const html = await zipText(zip, base + decodeURIComponent(href));
    if (!html) continue;
    const d = new DOMParser().parseFromString(html, 'application/xhtml+xml');
    const ps = paragraphs(d, ['p', 'h1', 'h2', 'h3', 'h4', 'li', 'blockquote']);
    if (ps.length) chunks.push(ps.join('\n\n'));
  }
  return { text: chunks.join('\n\n'), csl };
}

export async function extract(kind: ResourceKind, bytes: Uint8Array, name: string, mime = '', url?: string): Promise<Extracted> {
  let out: Extracted;
  switch (kind) {
    case 'pdf':
      out = await extractPdf(bytes);
      break;
    case 'docx':
      out = await extractDocx(bytes);
      break;
    case 'odt':
      out = await extractOdt(bytes);
      break;
    case 'epub':
      out = await extractEpub(bytes);
      break;
    case 'rtf':
      out = { text: rtfToText(decodeText(bytes)), csl: { type: 'document' } };
      break;
    case 'html': {
      const page = parsePage(decodeText(bytes), url ?? 'file:///' + name);
      out = { text: blocksToText(page.blocks), blocks: page.blocks, csl: page.csl, title: page.title };
      break;
    }
    case 'text':
    case 'markdown':
      out = { text: decodeText(bytes), csl: { type: 'document' } };
      break;
    case 'image': {
      const im = await imageThumb(bytes, mime);
      out = { text: '', csl: { type: 'graphic' }, thumb: im.thumb, width: im.width, height: im.height, needsOcr: true };
      break;
    }
    case 'video':
      out = { text: '', csl: { type: 'motion_picture' } };
      break;
    case 'audio':
      out = { text: '', csl: { type: 'song' } };
      break;
    default:
      out = { text: '', csl: { type: 'document' } };
  }
  // titolo: dai metadati, altrimenti dalla prima riga significativa, altrimenti dal nome del file
  const fileTitle = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  const firstLine = out.text.split('\n').map((l) => l.trim()).find((l) => l.length > 8 && l.length < 160);
  out.title = out.csl.title || out.title || (kind === 'text' || kind === 'markdown' ? firstLine?.replace(/^#+\s*/, '') : undefined) || fileTitle;
  out.csl.title ??= out.title;
  const doi = findDoi(out.text.slice(0, 20000));
  if (doi && !out.csl.DOI) out.csl.DOI = doi;
  const isbn = findIsbn(out.text.slice(0, 20000));
  if (isbn && !out.csl.ISBN) out.csl.ISBN = isbn;
  return out;
}
