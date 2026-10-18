// Apri: un .clmn torna com'era; un .docx, un .md o un .txt diventano un foglio nuovo. Dal .docx
// arrivano testo, immagini (in media/) e commenti (Marginalia); le revisioni tracciate si accettano.
import JSZip from 'jszip';
import { DOMParser as XmlParser, XMLSerializer, type Element as XmlElement } from '@xmldom/xmldom';
import { serializeMarkdown } from 'logos/doc/serialize';
import type { PMNode } from 'logos/doc/types';
import { parseWordReview, planReview } from 'logos/comments/word';
import { makeAnchor, newCommentId, statusFields, type Comment } from 'logos/comments/model';
import { htmlToDoc } from './htmlToDoc';
import { doc as makeDoc, paragraph, text } from './build';
import { flatText } from './comments/anchors';
import { t } from '../i18n';
import { EXT, LEGACY_EXT, FormatError, mediaName, newSheet, unpack, type Sheet } from './format';
import { markdownToDoc } from './doc';
import { columnSchema } from './editor/extensions';
import { newId } from './tabula/model';

export const OPEN_EXTENSIONS = [EXT, LEGACY_EXT, 'docx', 'md', 'markdown', 'txt', 'text'];

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** Revisioni di Word accettate: le aggiunte restano, le cancellazioni spariscono. */
export function acceptedDocumentXml(xml: string): string {
  const d = new XmlParser().parseFromString(xml, 'text/xml');
  const all = (local: string) => Array.from(d.getElementsByTagNameNS(W, local)) as XmlElement[];
  for (const del of [...all('del'), ...all('moveFrom')]) {
    // cancellazione del segno di paragrafo: si toglie il solo segno
    del.parentNode?.removeChild(del);
  }
  for (const ins of [...all('ins'), ...all('moveTo')]) {
    const parent = ins.parentNode;
    if (!parent) continue;
    if ((parent as XmlElement).localName === 'rPr') {
      parent.removeChild(ins);
      continue;
    }
    while (ins.firstChild) parent.insertBefore(ins.firstChild, ins);
    parent.removeChild(ins);
  }
  return new XMLSerializer().serializeToString(d);
}

const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
  "r[style-name='Strong'] => strong",
  "r[style-name='Emphasis'] => em",
  'u => u',
  'strike => s',
];

const IMG = 'column-img:';

function mapFigures(n: PMNode, f: (src: string) => string | null): PMNode {
  if (n.type === 'figure' && typeof n.attrs?.src === 'string') {
    const src = f(n.attrs.src);
    return src ? { ...n, attrs: { ...n.attrs, src } } : n;
  }
  return n.content ? { ...n, content: n.content.map((c) => mapFigures(c, f)) } : n;
}

const iso = (d: string) => (d ? `${d}T12:00:00.000Z` : new Date().toISOString());

export async function docxToSheet(data: Uint8Array, title: string, parseHtml: (html: string) => Document, author = ''): Promise<Sheet> {
  const zip = await JSZip.loadAsync(data);
  const docXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
  if (!docXml) throw new FormatError('notColumn');
  const commentsXml = (await zip.file('word/comments.xml')?.async('string')) ?? null;
  let review = null;
  try {
    review = parseWordReview(docXml, commentsXml);
  } catch {
    review = null;
  }
  zip.file('word/document.xml', acceptedDocumentXml(docXml));
  const input = await zip.generateAsync({ type: 'uint8array' });
  const images: { key: string; name: string; data: Uint8Array }[] = [];
  const mammoth = await import('mammoth');
  const res = await mammoth.convertToHtml(
    { arrayBuffer: input.slice().buffer as ArrayBuffer, buffer: input } as { arrayBuffer: ArrayBuffer },
    {
      styleMap: STYLE_MAP,
      convertImage: mammoth.images.imgElement(async (img) => {
        const bytes = new Uint8Array(await img.readAsArrayBuffer());
        const ext = (img.contentType.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace(/\+.*$/, '');
        const key = `${IMG}${images.length + 1}`;
        images.push({ key, name: `immagine-${images.length + 1}.${ext}`, data: bytes });
        return { src: key };
      }),
    },
  );
  const body = parseHtml(`<!doctype html><html><body>${res.value}</body></html>`).body;
  const sheet = newSheet(newId('f'), new Date(), title);
  const srcOf = new Map<string, string>();
  for (const img of images) {
    const file = mediaName(img.name, Object.keys(sheet.media));
    sheet.media[file] = img.data;
    srcOf.set(img.key, `media/${file}`);
  }
  const tree = mapFigures(htmlToDoc(body as never, { image: (src, alt) => (src.startsWith(IMG) ? { src, caption: alt } : null) }), (k) => srcOf.get(k) ?? null);
  sheet.markdown = serializeMarkdown(tree);

  // commenti di Word come Marginalia, ancorati sul testo del foglio
  if (review?.comments.length) {
    const pm = columnSchema().nodeFromJSON(markdownToDoc(sheet.markdown));
    const flat = flatText(pm);
    const plan = planReview(flat.text, review);
    const made: Comment[] = plan.comments.map((pc) => ({
      id: newCommentId(),
      author: pc.comment.author || author || 'Word',
      body: pc.comment.text,
      created: iso(pc.comment.date),
      anchor: pc.at ? makeAnchor(flat, flat.map[pc.at[0]], flat.map[pc.at[1] - 1] + 1, 'text') : null,
      offsetX: null,
      offsetY: null,
      commits: [],
      replies: [],
      origin: { kind: 'word', ...(pc.comment.author ? { name: pc.comment.author } : {}) },
      ...statusFields('open'),
    }));
    sheet.comments = { version: 1, comments: made };
  }
  return sheet;
}

export function textToMarkdown(s: string): string {
  const blocks: PMNode[] = [];
  for (const c of s.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)) {
    const inl: PMNode[] = [];
    c.split('\n').forEach((line, i) => {
      if (i) inl.push({ type: 'hardBreak' });
      inl.push(text(line.replace(/\t/g, ' '), []));
    });
    const p = paragraph(inl);
    if (p) blocks.push(p);
  }
  return serializeMarkdown(makeDoc(blocks));
}

function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  const s = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(s);
  } catch {
    return new TextDecoder('windows-1252').decode(s);
  }
}

const stem = (path: string) => {
  const base = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
  return base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
};

/** Legge un file scelto dall'utente e ne fa un foglio (non ancora salvato fra quelli in lavorazione). */
export async function importFile(path: string, data: Uint8Array, parseHtml: (html: string) => Document = (s) => new DOMParser().parseFromString(s, 'text/html')): Promise<Sheet> {
  const ext = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1).toLowerCase() : '';
  const name = stem(path);
  const isZip = data[0] === 0x50 && data[1] === 0x4b;
  try {
    if (ext === EXT || ext === LEGACY_EXT || (isZip && ext !== 'docx')) {
      const s = await unpack(data, newId('f'));
      return { ...s, meta: { ...s.meta, name: s.meta.name || name } };
    }
    if (ext === 'docx' || isZip) return await docxToSheet(data, name, parseHtml);
  } catch (e) {
    if (e instanceof FormatError) throw new Error(t(`open.error.${e.code}`, { name }));
    throw new Error(t('open.error.generic', { name, error: e instanceof Error ? e.message : String(e) }));
  }
  if (!['md', 'markdown', 'txt', 'text', ''].includes(ext)) throw new Error(t('open.error.unknown', { name }));
  const s = newSheet(newId('f'), new Date(), name);
  const raw = decodeText(data);
  s.markdown = ext === 'md' || ext === 'markdown' ? raw : textToMarkdown(raw);
  return s;
}
