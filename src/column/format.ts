// Formato del foglio di Column. Un .clmn e' uno zip con:
//   column.json      nome, date, carattere, vista, timer, versione del formato
//   testo.md         il Markdown, fonte di verita' (parse/serialize di logos)
//   marginalia.json  commenti (modello di logos/comments/model)
//   tabula.json      Armarium del foglio: blocchi e collegamenti
//   media/           immagini incollate o trascinate (nel testo o nella Tabula)
//   palimpsestus/    versions.json (albero) + un file Markdown per versione
// I fogli in lavorazione stanno nella cartella dei dati con gli stessi file, non compressi, cosi'
// il salvataggio automatico riscrive solo cio' che e' cambiato. Funzioni pure.
import JSZip from 'jszip';
import { normalizeCommentsFile, type CommentsFile } from 'logos/comments/model';
import { emptyTabula, normalizeTabula, type Tabula } from './tabula/model';
import { emptyTree, normalizeTree, type VersionTree } from './versions/tree';
import { normalizeSettings, type TimerSettings } from './timer/model';

export const FORMAT = 1;
export const EXT = 'clmn';
/** estensione e file dei fogli salvati quando l'app si chiamava Folium: si leggono ancora */
export const LEGACY_EXT = 'folium';
const LEGACY_META = 'folium.json';

export type SheetFont = 'serif' | 'sans' | 'mono';
export type SheetView = 'write' | 'versions';

export interface SheetMeta {
  format: number;
  id: string;
  name: string;
  created: string;
  updated: string;
  font: SheetFont;
  view: SheetView;
  /** (fogli di prima: quota del testo nella vista affiancata, non piu' usata) */
  split: number;
  /** impostazioni del timer usate con questo foglio */
  timer?: TimerSettings;
}

export interface Sheet {
  meta: SheetMeta;
  markdown: string;
  comments: CommentsFile;
  tabula: Tabula;
  tree: VersionTree;
  /** testo di ogni versione (id -> Markdown) */
  versions: Record<string, string>;
  /** file in media/ (nome -> byte) */
  media: Record<string, Uint8Array>;
}

export const FILES = {
  meta: 'column.json',
  text: 'testo.md',
  comments: 'marginalia.json',
  tabula: 'tabula.json',
  tree: 'palimpsestus/versions.json',
  versionDir: 'palimpsestus/',
  mediaDir: 'media/',
} as const;

export class FormatError extends Error {
  constructor(public code: 'notColumn' | 'newer' | 'damaged') {
    super(code);
  }
}

const VIEWS: SheetView[] = ['write', 'versions'];
const FONTS: SheetFont[] = ['serif', 'sans', 'mono'];

export function newSheet(id: string, now: Date, name = ''): Sheet {
  const iso = now.toISOString();
  return {
    meta: { format: FORMAT, id, name, created: iso, updated: iso, font: 'serif', view: 'write', split: 0.55 },
    markdown: '',
    comments: { version: 1, comments: [] },
    tabula: emptyTabula(),
    tree: emptyTree(),
    versions: {},
    media: {},
  };
}

export function normalizeMeta(raw: unknown, fallbackId: string): SheetMeta {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<SheetMeta>;
  if (typeof r.format === 'number' && r.format > FORMAT) throw new FormatError('newer');
  const now = new Date(0).toISOString();
  const split = typeof r.split === 'number' && Number.isFinite(r.split) ? Math.min(0.8, Math.max(0.2, r.split)) : 0.55;
  return {
    format: FORMAT,
    id: typeof r.id === 'string' && r.id ? r.id : fallbackId,
    name: typeof r.name === 'string' ? r.name : '',
    created: typeof r.created === 'string' ? r.created : now,
    updated: typeof r.updated === 'string' ? r.updated : (typeof r.created === 'string' ? r.created : now),
    font: FONTS.includes(r.font as SheetFont) ? (r.font as SheetFont) : 'serif',
    view: VIEWS.includes(r.view as SheetView) ? (r.view as SheetView) : 'write',
    split,
    ...(r.timer ? { timer: normalizeSettings(r.timer) } : {}),
  };
}

/** Nome sicuro per un file in media/ (niente cartelle, niente caratteri strani). */
export function mediaName(name: string, taken: Iterable<string>): string {
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(-80) || 'immagine';
  const used = new Set(taken);
  if (!used.has(clean)) return clean;
  const dot = clean.lastIndexOf('.');
  const stem = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : '';
  for (let i = 2; ; i++) if (!used.has(`${stem}-${i}${ext}`)) return `${stem}-${i}${ext}`;
}

/** I file del foglio (percorso relativo -> contenuto), per lo zip e per la cartella di lavoro. */
export function sheetFiles(s: Sheet): Map<string, string | Uint8Array> {
  const out = new Map<string, string | Uint8Array>();
  out.set(FILES.meta, JSON.stringify(s.meta, null, 2));
  out.set(FILES.text, s.markdown);
  out.set(FILES.comments, JSON.stringify(s.comments, null, 2));
  out.set(FILES.tabula, JSON.stringify(s.tabula, null, 2));
  out.set(FILES.tree, JSON.stringify(s.tree, null, 2));
  for (const [id, md] of Object.entries(s.versions)) out.set(`${FILES.versionDir}${id}.md`, md);
  for (const [name, data] of Object.entries(s.media)) out.set(`${FILES.mediaDir}${name}`, data);
  return out;
}

/** Ricostruisce il foglio dai suoi file (letti da uno zip o da una cartella). */
export function sheetFromFiles(files: Map<string, string | Uint8Array>, fallbackId: string): Sheet {
  const text = (p: string) => {
    const v = files.get(p);
    return v === undefined ? null : typeof v === 'string' ? v : new TextDecoder().decode(v);
  };
  const json = (p: string) => {
    const v = text(p);
    if (v === null) return null;
    try {
      return JSON.parse(v);
    } catch {
      throw new FormatError('damaged');
    }
  };
  const metaRaw = json(FILES.meta) ?? json(LEGACY_META);
  const md = text(FILES.text);
  if (metaRaw === null && md === null) throw new FormatError('notColumn');
  const tree = normalizeTree(json(FILES.tree));
  const versions: Record<string, string> = {};
  for (const n of tree.nodes) {
    const v = text(`${FILES.versionDir}${n.id}.md`);
    if (v !== null) versions[n.id] = v;
  }
  // una versione senza testo non si puo' mostrare ne' riprendere: resta solo come passaggio
  const media: Record<string, Uint8Array> = {};
  for (const [p, v] of files) {
    if (!p.startsWith(FILES.mediaDir) || p.endsWith('/')) continue;
    media[p.slice(FILES.mediaDir.length)] = typeof v === 'string' ? new TextEncoder().encode(v) : v;
  }
  return {
    meta: normalizeMeta(metaRaw, fallbackId),
    markdown: md ?? '',
    comments: normalizeCommentsFile(json(FILES.comments)),
    tabula: normalizeTabula(json(FILES.tabula)),
    tree,
    versions,
    media,
  };
}

export async function pack(s: Sheet): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [p, v] of sheetFiles(s)) zip.file(p, v);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function unpack(data: Uint8Array, fallbackId: string): Promise<Sheet> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new FormatError('notColumn');
  }
  const files = new Map<string, string | Uint8Array>();
  for (const [p, f] of Object.entries(zip.files)) {
    if (f.dir) continue;
    files.set(p, p.startsWith(FILES.mediaDir) ? await f.async('uint8array') : await f.async('string'));
  }
  return sheetFromFiles(files, fallbackId);
}

/** Nome del foglio per titoli ed export: quello dato, o il primo titolo, o la prima riga. */
export function displayName(s: Pick<Sheet, 'meta' | 'markdown'>, untitled: string): string {
  if (s.meta.name.trim()) return s.meta.name.trim();
  const first = s.markdown
    .split('\n')
    .map((l) =>
      l
        .replace(/^#{1,6}\s+|^>\s*|^[-*+]\s+|^\d+\.\s+/, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')
        .replace(/[*_`~[\]]/g, '')
        .replace(/\s*\|\s*/g, ' ')
        .trim(),
    )
    // righe senza lettere ne' cifre (separatori, tabelle vuote) non danno un nome
    .find((l) => /[\p{L}\p{N}]/u.test(l));
  return first ? (first.length > 60 ? first.slice(0, 57).trimEnd() + '…' : first) : untitled;
}

/** Nome di file sicuro per Salva come ed Esporta. */
export function fileStem(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Column';
}
