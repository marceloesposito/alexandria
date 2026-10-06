// Formato .recensio: copia per revisione di una pergamena o di un Codex. È uno zip con
//   manifest.json            chi, cosa, da quale versione (baseSha), revisore e data di restituzione
//   documents/<chiave>.md    le pergamene (con eventuali revisioni <ins>/<del>)
//   comments/<chiave>.json   i Marginalia di ciascuna
//   armarium/<id>/meta.json  le fonti citate (metadati, Bookmark), con miniatura e, a scelta, il file
import JSZip from 'jszip';
import { LEGACY_DIRS, type VaultDirs } from '../vault/paths';

export const RECENSIO_EXT = 'recensio';
export const RECENSIO_FORMAT = 'alexandria-recensio';

/** Cartelle del Compendium d'origine di una copia (quelle di prima se il manifest non le dice). */
export function recensioDirs(m: { dirs?: VaultDirs }): VaultDirs {
  const d = m.dirs;
  return d && typeof d.docs === 'string' && typeof d.res === 'string' && d.docs && d.res && !d.docs.includes('..') && !d.res.includes('..') ? d : LEGACY_DIRS;
}

/** Nome del file di una pergamena dentro lo zip: indipendente dal Compendium aperto. */
function zipKey(rel: string, dirs: VaultDirs): string {
  const prefix = dirs.docs + '/';
  return (rel.startsWith(prefix) ? rel.slice(prefix.length) : rel).replace(/\.md$/i, '').replace(/\//g, '~');
}

export interface RecensioDoc {
  rel: string;
  title: string;
}

export interface RecensioManifest {
  format: typeof RECENSIO_FORMAT;
  version: 1;
  title: string;
  author: string;
  compendium: string;
  created: string;
  /** versione del Palimpsestus da cui è partita la copia */
  baseSha: string | null;
  docs: RecensioDoc[];
  /** cartelle del Compendium d'origine (assente = documents/ e resources/, copie di prima) */
  dirs?: VaultDirs;
  reviewer?: { name: string };
  /** data in cui il revisore l'ha restituita */
  returned?: string;
}

export interface RecensioContent {
  manifest: RecensioManifest;
  /** testo delle pergamene, per percorso */
  texts: Record<string, string>;
  /** file dei commenti (JSON grezzo), per percorso della pergamena */
  comments: Record<string, unknown>;
  /** fonti: id -> meta.json e file accanto (miniatura, eventuale documento) */
  sources: Record<string, { meta: unknown; files: Record<string, Uint8Array> }>;
}

export async function packRecensio(c: RecensioContent): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(c.manifest, null, 2));
  for (const d of c.manifest.docs) {
    zip.file(`documents/${zipKey(d.rel, recensioDirs(c.manifest))}.md`, c.texts[d.rel] ?? '');
    if (c.comments[d.rel]) zip.file(`comments/${zipKey(d.rel, recensioDirs(c.manifest))}.json`, JSON.stringify(c.comments[d.rel], null, 2));
  }
  for (const [id, s] of Object.entries(c.sources)) {
    zip.file(`armarium/${id}/meta.json`, JSON.stringify(s.meta, null, 2));
    for (const [name, data] of Object.entries(s.files)) zip.file(`armarium/${id}/${name}`, data);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

const SAFE = /^[\p{L}\p{N}_.~ -]+$/u;

export async function unpackRecensio(data: Uint8Array): Promise<RecensioContent> {
  const zip = await JSZip.loadAsync(data);
  const raw = await zip.file('manifest.json')?.async('string');
  if (!raw) throw new Error('manifest');
  const manifest = JSON.parse(raw) as RecensioManifest;
  if (manifest.format !== RECENSIO_FORMAT || !Array.isArray(manifest.docs)) throw new Error('format');
  // solo percorsi dentro la cartella delle pergamene, senza risalite
  const dirs = recensioDirs(manifest);
  manifest.dirs = dirs;
  manifest.docs = manifest.docs.filter((d) => typeof d.rel === 'string' && d.rel.startsWith(dirs.docs + '/') && !d.rel.split('/').includes('..'));
  const texts: Record<string, string> = {};
  const comments: Record<string, unknown> = {};
  for (const d of manifest.docs) {
    texts[d.rel] = (await zip.file(`documents/${zipKey(d.rel, dirs)}.md`)?.async('string')) ?? '';
    const cj = await zip.file(`comments/${zipKey(d.rel, dirs)}.json`)?.async('string');
    if (cj) comments[d.rel] = JSON.parse(cj);
  }
  const sources: RecensioContent['sources'] = {};
  for (const path of Object.keys(zip.files)) {
    const m = /^armarium\/([^/]+)\/([^/]+)$/.exec(path);
    if (!m || zip.files[path].dir || !SAFE.test(m[1]) || !SAFE.test(m[2])) continue;
    const s = (sources[m[1]] ??= { meta: null, files: {} });
    if (m[2] === 'meta.json') s.meta = JSON.parse(await zip.files[path].async('string'));
    else s.files[m[2]] = await zip.files[path].async('uint8array');
  }
  for (const id of Object.keys(sources)) if (!sources[id].meta) delete sources[id];
  return { manifest, texts, comments, sources };
}

/** Nome del file restituito dal revisore: "<titolo> - rev <nome>.recensio". */
export function returnedName(title: string, reviewer: string): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${clean(title) || 'Recensio'} - rev ${clean(reviewer) || 'revisore'}.${RECENSIO_EXT}`;
}

/** Nome di branch per la revisione importata. */
export function reviewBranch(reviewer: string, date: string): string {
  const slug = reviewer
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `revisione-${slug || 'revisore'}-${date.slice(0, 10)}`;
}
