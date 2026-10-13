// Apertura di documenti scritti con altre app: riconosce il formato dal contenuto (poi dal nome) e
// produce l'albero della pergamena, le immagini da mettere nell'Armarium e, per Word, revisioni
// tracciate e commenti da riportare nella pergamena. Niente rete, niente programmi esterni.
import JSZip from 'jszip';
import { DOMParser as XmlParser, XMLSerializer, type Element as XmlElement } from '@xmldom/xmldom';
import type { PMNode } from 'logos/doc/types';
import { parseWordReview, type WordReview } from 'logos/comments/word';
import { htmlBlocks, htmlToDoc } from './html';
import { odtToDoc } from './odt';
import { rtfToDoc } from './rtf';
import { readWordBinary, isCfb, ImportError } from './wordBinary';
import { doc, paragraph, text } from './build';

export { ImportError };

export type ImportFormat = 'docx' | 'doc' | 'odt' | 'fodt' | 'rtf' | 'html' | 'epub' | 'text' | 'markdown';

/** Estensioni proposte nella finestra di scelta e accettate dal doppio clic. */
export const IMPORT_EXTENSIONS = ['docx', 'docm', 'dotx', 'doc', 'dot', 'odt', 'ott', 'fodt', 'rtf', 'html', 'htm', 'xhtml', 'epub', 'txt', 'text', 'md', 'markdown'];

export interface ImportedImage {
  /** segnaposto usato come src delle figure finche' l'immagine non e' nell'Armarium */
  key: string;
  name: string;
  data: Uint8Array;
}

export interface ImportedDoc {
  format: ImportFormat;
  title: string;
  /** albero del documento; per i file Markdown c'e' invece il testo cosi' com'e' */
  doc: PMNode | null;
  markdown: string | null;
  images: ImportedImage[];
  /** revisioni tracciate e commenti di Word, da applicare alla pergamena una volta aperta */
  review: WordReview | null;
}

export const IMAGE_KEY = 'alexandria-import:';

const extOf = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '');
const stem = (name: string) => {
  const base = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
  return base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
};

export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  const s = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(s);
  } catch {
    return new TextDecoder('windows-1252').decode(s);
  }
}

/** Formato dal contenuto (la firma vince sull'estensione, che puo' mentire). */
export async function detectFormat(name: string, data: Uint8Array): Promise<ImportFormat | 'pages' | null> {
  const ext = extOf(name);
  if (isCfb(data)) return 'doc';
  if (data[0] === 0x50 && data[1] === 0x4b) {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(data);
    } catch {
      return null;
    }
    if (zip.file('word/document.xml')) return 'docx';
    const mime = (await zip.file('mimetype')?.async('string'))?.trim() ?? '';
    if (mime === 'application/epub+zip') return 'epub';
    if (mime.startsWith('application/vnd.oasis.opendocument.text')) return 'odt';
    if (zip.file('Index/Document.iwa') || ext === 'pages') return 'pages';
    return zip.file('content.xml') ? 'odt' : null;
  }
  if (ext === 'pages') return 'pages';
  const head = decodeText(data.subarray(0, 2048)).trimStart();
  if (head.startsWith('{\\rtf')) return 'rtf';
  if (/^<\?xml[^>]*>\s*<office:document/.test(head) || head.startsWith('<office:document')) return 'fodt';
  if (['html', 'htm', 'xhtml'].includes(ext) || /^(<!doctype html|<html)/i.test(head)) return 'html';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (['txt', 'text'].includes(ext)) return 'text';
  // Word salva a volte come HTML o RTF con estensione .doc: gia' visti sopra
  if (ext === 'doc' || ext === 'docx' || ext === 'odt') return null;
  for (let i = 0; i < Math.min(data.length, 4096); i++) if (data[i] === 0) return null;
  return 'text';
}

/** Testo semplice: righe vuote fra i paragrafi, gli a capo singoli restano a capo. */
export function textToDoc(s: string): PMNode {
  const chunks = s.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/);
  const blocks: PMNode[] = [];
  for (const c of chunks) {
    const inl: PMNode[] = [];
    c.split('\n').forEach((line, i) => {
      if (i) inl.push({ type: 'hardBreak' });
      inl.push(text(line.replace(/\t/g, ' '), []));
    });
    const p = paragraph(inl);
    if (p) blocks.push(p);
  }
  return doc(blocks);
}

// ---------------------------------------------------------------- Word (.docx)

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Testo "prima della revisione": via le parti inserite, tornano le parti cancellate. Le revisioni si
 * rimettono poi come revisioni tracciate della pergamena (come quando torna la revisione del relatore).
 */
function originalDocumentXml(xml: string): string {
  const d = new XmlParser().parseFromString(xml, 'text/xml');
  const all = (local: string) => Array.from(d.getElementsByTagNameNS(W, local)) as XmlElement[];
  for (const ins of all('ins')) ins.parentNode?.removeChild(ins);
  for (const mv of all('moveTo')) mv.parentNode?.removeChild(mv);
  for (const del of [...all('del'), ...all('moveFrom')]) {
    const parent = del.parentNode;
    if (!parent) continue;
    // cancellazione del segno di paragrafo (dentro w:rPr): si toglie e basta
    if ((parent as XmlElement).localName === 'rPr') {
      parent.removeChild(del);
      continue;
    }
    while (del.firstChild) parent.insertBefore(del.firstChild, del);
    parent.removeChild(del);
  }
  for (const dt of all('delText')) {
    const t = d.createElementNS(W, 'w:t');
    t.setAttribute('xml:space', 'preserve');
    t.appendChild(d.createTextNode(dt.textContent ?? ''));
    dt.parentNode?.replaceChild(t, dt);
  }
  return new XMLSerializer().serializeToString(d);
}

const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
  "p[style-name='Block Text'] => blockquote > p:fresh",
  "r[style-name='Strong'] => strong",
  "r[style-name='Emphasis'] => em",
  'u => u',
  'strike => s',
];

async function convertDocx(data: Uint8Array, images: ImportedImage[], parseHtml: (html: string) => Document) {
  const zip = await JSZip.loadAsync(data);
  const docXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const commentsXml = (await zip.file('word/comments.xml')?.async('string')) ?? null;
  let review: WordReview | null = null;
  let input = data;
  try {
    const r = parseWordReview(docXml, commentsXml);
    const hasChanges = r.paragraphs.some((p) => p.some((run) => run.kind !== 'normal'));
    if (hasChanges || r.comments.length) review = r;
    if (hasChanges) {
      zip.file('word/document.xml', originalDocumentXml(docXml));
      input = await zip.generateAsync({ type: 'uint8array' });
    }
  } catch {
    review = null;
  }
  const mammoth = await import('mammoth');
  const res = await mammoth.convertToHtml(
    // arrayBuffer per la versione del browser, buffer per quella di node (test)
    { arrayBuffer: input.slice().buffer as ArrayBuffer, buffer: input } as { arrayBuffer: ArrayBuffer },
    {
      styleMap: STYLE_MAP,
      convertImage: mammoth.images.imgElement(async (img) => {
        const bytes = new Uint8Array(await img.readAsArrayBuffer());
        const ext = (img.contentType.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace(/\+.*$/, '');
        const key = `${IMAGE_KEY}${images.length + 1}`;
        images.push({ key, name: `immagine-${images.length + 1}.${ext}`, data: bytes });
        return { src: key };
      }),
    },
  );
  const body = parseHtml(`<!doctype html><html><body>${res.value}</body></html>`).body;
  return { doc: htmlToDoc(body as never, { image: (src, alt) => (src.startsWith(IMAGE_KEY) ? { src, caption: alt } : null) }), review };
}

// ---------------------------------------------------------------- OpenDocument

async function convertOdt(data: Uint8Array, images: ImportedImage[]) {
  const zip = await JSZip.loadAsync(data);
  const content = (await zip.file('content.xml')?.async('string')) ?? '';
  const styles = (await zip.file('styles.xml')?.async('string')) ?? null;
  // le immagini si leggono prima: la conversione e' sincrona
  const pics = new Map<string, Uint8Array>();
  for (const href of new Set(Array.from(content.matchAll(/xlink:href="([^"]+)"/g), (m) => m[1]))) {
    const f = !/^[a-z]+:/i.test(href) ? zip.file(href.replace(/^\.\//, '')) : null;
    if (f && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(href)) pics.set(href, await f.async('uint8array'));
  }
  const keyOf = new Map<string, string>();
  return odtToDoc(content, styles, {
    image: (href) => {
      const bytes = pics.get(href);
      if (!bytes) return null;
      let key = keyOf.get(href);
      if (!key) {
        key = `${IMAGE_KEY}${images.length + 1}`;
        keyOf.set(href, key);
        images.push({ key, name: href.slice(href.lastIndexOf('/') + 1), data: bytes });
      }
      return { src: key };
    },
  });
}

// ---------------------------------------------------------------- EPUB

async function convertEpub(data: Uint8Array, images: ImportedImage[], parseXhtml: (s: string) => Document) {
  const zip = await JSZip.loadAsync(data);
  const container = (await zip.file('META-INF/container.xml')?.async('string')) ?? '';
  const opfPath = /full-path="([^"]+)"/.exec(container)?.[1];
  if (!opfPath) throw new ImportError('corrupt');
  const opf = parseXhtml((await zip.file(opfPath)?.async('string')) ?? '');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const manifest = new Map<string, string>();
  for (const it of Array.from(opf.getElementsByTagName('item'))) manifest.set(it.getAttribute('id') ?? '', it.getAttribute('href') ?? '');
  const title = opf.getElementsByTagName('dc:title')[0]?.textContent?.trim();
  const blocks: PMNode[] = [];
  const keyOf = new Map<string, string>();
  for (const ref of Array.from(opf.getElementsByTagName('itemref'))) {
    const href = manifest.get(ref.getAttribute('idref') ?? '');
    if (!href) continue;
    const path = base + decodeURIComponent(href);
    const html = await zip.file(path)?.async('string');
    if (!html) continue;
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    const page = parseXhtml(html);
    const body = page.getElementsByTagName('body')[0];
    if (!body) continue;
    // immagini del capitolo: lette prima, poi la conversione (sincrona) le trova per percorso
    const pics = new Map<string, Uint8Array>();
    for (const img of Array.from(body.getElementsByTagName('img'))) {
      const src = img.getAttribute('src') ?? '';
      const full = normalize(dir + decodeURIComponent(src));
      const f = zip.file(full);
      if (f) pics.set(src, await f.async('uint8array'));
    }
    blocks.push(
      ...htmlBlocks(body as never, {
        image: (src, alt) => {
          const bytes = pics.get(src);
          if (!bytes) return null;
          let key = keyOf.get(src + '|' + dir);
          if (!key) {
            key = `${IMAGE_KEY}${images.length + 1}`;
            keyOf.set(src + '|' + dir, key);
            images.push({ key, name: src.slice(src.lastIndexOf('/') + 1), data: bytes });
          }
          return { src: key, caption: alt };
        },
      }),
    );
  }
  return { doc: doc(blocks), title };
}

function normalize(p: string): string {
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

// ---------------------------------------------------------------- ingresso

/**
 * Converte un file in una pergamena. `parseHtml` legge HTML con il parser del browser (nei test quello
 * di jsdom); per l'XHTML degli EPUB si usa xmldom.
 */
export async function convertFile(name: string, data: Uint8Array, parseHtml: (html: string) => Document = (s) => new DOMParser().parseFromString(s, 'text/html')): Promise<ImportedDoc> {
  const format = await detectFormat(name, data);
  if (format === 'pages') throw new ImportError('pages');
  if (!format) throw new ImportError('unsupported');
  const images: ImportedImage[] = [];
  const base = { format, title: stem(name), doc: null as PMNode | null, markdown: null as string | null, images, review: null as WordReview | null };
  switch (format) {
    case 'docx': {
      const r = await convertDocx(data, images, parseHtml);
      return { ...base, doc: r.doc, review: r.review };
    }
    case 'doc':
      return { ...base, doc: readWordBinary(data).doc };
    case 'odt':
      return { ...base, doc: await convertOdt(data, images) };
    case 'fodt': {
      const xml = decodeText(data);
      return { ...base, doc: odtToDoc(xml, null) };
    }
    case 'rtf':
      return { ...base, doc: rtfToDoc(decodeText(data)) };
    case 'html': {
      const page = parseHtml(decodeText(data));
      // immagini delle pagine HTML: solo quelle gia' dentro il file (data:), mai scaricate
      return { ...base, doc: htmlToDoc((page.body ?? page.documentElement) as never, { image: (src, alt) => (src.startsWith('data:image/') ? { src: storeDataUrl(src, images), caption: alt } : null) }) };
    }
    case 'epub': {
      const r = await convertEpub(data, images, (s) => new XmlParser().parseFromString(s, 'application/xhtml+xml') as unknown as Document);
      return { ...base, doc: r.doc };
    }
    case 'markdown':
      return { ...base, markdown: decodeText(data).replace(/\r\n?/g, '\n') };
    case 'text':
      return { ...base, doc: textToDoc(decodeText(data)) };
  }
}

function storeDataUrl(src: string, images: ImportedImage[]): string {
  const m = /^data:image\/([\w+.-]+);base64,(.*)$/s.exec(src);
  if (!m) return src;
  const bin = atob(m[2].replace(/\s/g, ''));
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  const key = `${IMAGE_KEY}${images.length + 1}`;
  images.push({ key, name: `immagine-${images.length + 1}.${m[1].replace('jpeg', 'jpg').replace(/\+.*$/, '')}`, data });
  return key;
}

/** Sostituisce i segnaposto delle immagini con i percorsi veri (o toglie le figure non salvate). */
export function replaceImageKeys(node: PMNode, srcOf: (key: string) => string | null): PMNode {
  const content = node.content
    ?.map((c) => {
      if (c.type === 'figure' && typeof c.attrs?.src === 'string' && c.attrs.src.startsWith(IMAGE_KEY)) {
        const src = srcOf(c.attrs.src);
        return src ? { ...c, attrs: { ...c.attrs, src } } : null;
      }
      return replaceImageKeys(c, srcOf);
    })
    .filter((c): c is PMNode => !!c);
  return content ? { ...node, content } : node;
}
