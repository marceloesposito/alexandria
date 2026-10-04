// Riconoscimento del formato: dal nome, dal tipo MIME e dai primi byte (firma del file).
import type { ResourceKind } from './model';

const EXT: Record<string, ResourceKind> = {
  pdf: 'pdf',
  txt: 'text',
  text: 'text',
  log: 'text',
  csv: 'text',
  md: 'markdown',
  markdown: 'markdown',
  rtf: 'rtf',
  docx: 'docx',
  odt: 'odt',
  epub: 'epub',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  bmp: 'image',
  avif: 'image',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  m4v: 'video',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  m4a: 'audio',
  flac: 'audio',
  bib: 'reference',
  ris: 'reference',
  json: 'other',
};

export const MIME_OF: Partial<Record<string, string>> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
};

function startsWith(b: Uint8Array, sig: number[], offset = 0): boolean {
  return sig.every((x, i) => b[offset + i] === x);
}

function ascii(b: Uint8Array, start: number, len: number): string {
  return String.fromCharCode(...b.subarray(start, start + len));
}

/** Tipo dai byte iniziali (vince sull'estensione, che puo' mentire). */
export function sniff(b: Uint8Array): ResourceKind | null {
  if (b.length < 4) return null;
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return 'image'; // PNG
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'image'; // JPEG
  if (ascii(b, 0, 4) === 'GIF8') return 'image';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE') return 'audio';
  if (ascii(b, 0, 5) === '{\\rtf') return 'rtf';
  if (ascii(b, 4, 4) === 'ftyp') return /M4A/.test(ascii(b, 8, 4)) ? 'audio' : 'video';
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return 'video'; // webm/mkv
  if (ascii(b, 0, 3) === 'ID3' || startsWith(b, [0xff, 0xfb])) return 'audio';
  if (ascii(b, 0, 4) === 'OggS') return 'audio';
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) {
    // zip: docx, odt, epub si distinguono dal contenuto
    const head = ascii(b, 0, Math.min(b.length, 2000));
    if (head.includes('mimetypeapplication/epub+zip')) return 'epub';
    if (head.includes('mimetypeapplication/vnd.oasis.opendocument.text')) return 'odt';
    if (head.includes('word/')) return 'docx';
    return null;
  }
  return null;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export function detectFile(name: string, mime: string, head: Uint8Array): ResourceKind {
  const byBytes = sniff(head);
  const ext = extOf(name);
  if (byBytes && byBytes !== 'other') {
    // un .docx e' uno zip: la firma da sola non basta sempre
    if (byBytes === 'docx' || byBytes === 'odt' || byBytes === 'epub') return byBytes;
    return byBytes;
  }
  if (EXT[ext]) return EXT[ext];
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'text/html') return 'html';
  if (mime.startsWith('text/')) return 'text';
  // testo semplice senza estensione nota: niente byte nulli nei primi 4 KB
  const n = Math.min(head.length, 4096);
  for (let i = 0; i < n; i++) if (head[i] === 0) return 'other';
  return head.length ? 'text' : 'other';
}

export interface UrlInfo {
  kind: ResourceKind;
  url: string;
  videoId?: string;
}

const YT = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/;

/** Riconosce un link incollato: video YouTube, file diretto (pdf, immagine...), pagina web. */
export function detectUrl(raw: string): UrlInfo | null {
  let s = raw.trim();
  if (!s) return null;
  if (/^10\.\d{4,9}\/\S+$/.test(s)) s = `https://doi.org/${s}`; // DOI nudo
  if (!/^https?:\/\//i.test(s)) {
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) s = `https://${s}`;
    else return null;
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const yt = YT.exec(s);
  if (yt) return { kind: 'youtube', url: `https://www.youtube.com/watch?v=${yt[1]}`, videoId: yt[1] };
  const ext = extOf(u.pathname);
  const k = EXT[ext];
  if (k && k !== 'html' && k !== 'other') return { kind: k, url: u.href };
  return { kind: 'web', url: u.href };
}

/** Separa un testo incollato in link (uno per riga o separati da spazi). */
export function splitLinks(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter((x) => x && detectUrl(x));
}

export const DOI_RE = /\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+[A-Z0-9])\b/i;
export const ISBN_RE = /\bISBN(?:-1[03])?:?\s*((?:97[89][-\s]?)?\d{1,5}[-\s]?\d{1,7}[-\s]?\d{1,7}[-\s]?[\dX])\b/i;

export function findDoi(text: string): string | null {
  return DOI_RE.exec(text)?.[1] ?? null;
}

export function findIsbn(text: string): string | null {
  const m = ISBN_RE.exec(text);
  return m ? m[1].replace(/[-\s]/g, '') : null;
}
