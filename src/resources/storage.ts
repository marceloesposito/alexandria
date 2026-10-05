// Dove vivono le risorse: resources/<id>/ nel vault (versionate) oppure items/<id>/ nella Library
// (globale, fuori dal version control). Il testo estratto sta in una cache ricostruibile.
import { normalizeObject } from '../types/model';
import { platform, joinPath } from '../platform';
import { readJson, writeJson } from '../vault/vault';
import { RES_DIR, CACHE_DIR, LAYERS_FILE, LINKS_FILE, WHITEBOARD_FILE, INDEX_DB } from '../vault/paths';
import type { Resource, LayersFile } from './model';
import type { Block } from './html';
import { authorsOf, yearOf } from './model';

export interface Scope {
  kind: 'vault' | 'library';
  root: string;
}

/** Cartella degli elementi: resources/ nel vault, items/ nella Library. */
export function itemsDir(s: Scope): string {
  return joinPath(s.root, s.kind === 'vault' ? RES_DIR : 'items');
}

export function itemDir(s: Scope, id: string): string {
  return joinPath(itemsDir(s), id);
}

export function textCachePath(s: Scope, id: string): string {
  return s.kind === 'vault' ? joinPath(s.root, CACHE_DIR, 'text', `${id}.txt`) : joinPath(s.root, '.text', `${id}.txt`);
}

export function indexDbPath(s: Scope): string {
  return s.kind === 'vault' ? joinPath(s.root, INDEX_DB) : joinPath(s.root, '.index.sqlite');
}

export async function defaultLibraryRoot(): Promise<string> {
  return joinPath(await platform.documentsDir(), 'Alexandria', 'Library');
}

export async function listResources(s: Scope): Promise<Resource[]> {
  const dir = itemsDir(s);
  if (!(await platform.exists(dir))) return [];
  const out: Resource[] = [];
  for (const e of await platform.list(dir)) {
    if (!e.isDir) continue;
    const r = await readJson<Resource | null>(joinPath(e.path, 'meta.json'), null);
    if (r && r.id) out.push(normalizeResource(r));
  }
  return out.sort((a, b) => a.created.localeCompare(b.created));
}

export function normalizeResource(r: Resource): Resource {
  return {
    ...r,
    csl: r.csl ?? null,
    citeKey: r.citeKey ?? null,
    isSource: !!r.isSource,
    tags: Array.isArray(r.tags) ? r.tags : [],
    layers: Array.isArray(r.layers) ? r.layers : [],
    meta: r.meta ?? {},
    pins: Array.isArray(r.pins) ? r.pins : [],
    ...(r.object ? { object: normalizeObject(r.object) } : {}),
  };
}

export async function saveResource(s: Scope, r: Resource): Promise<void> {
  await writeJson(joinPath(itemDir(s, r.id), 'meta.json'), r);
}

export async function removeResource(s: Scope, id: string): Promise<void> {
  await platform.remove(itemDir(s, id));
  await platform.remove(textCachePath(s, id));
  try {
    await platform.indexRemove(indexDbPath(s), [id]);
  } catch {
    /* indice non disponibile */
  }
}

export async function writeItemFile(s: Scope, id: string, name: string, data: Uint8Array): Promise<string> {
  await platform.writeBytes(joinPath(itemDir(s, id), name), data);
  return name;
}

/** Percorso assoluto del file di una risorsa (anche se vive nella Library). */
export function resourceFilePath(vault: Scope, library: Scope | null, r: Resource, file = r.file): string | null {
  if (!file) return null;
  if (r.library && library) return joinPath(itemDir(library, r.library), file);
  return joinPath(itemDir(vault, r.id), file);
}

export async function readText(s: Scope, id: string): Promise<string | null> {
  const p = textCachePath(s, id);
  return (await platform.exists(p)) ? platform.readText(p) : null;
}

export async function writeText(s: Scope, id: string, text: string): Promise<void> {
  await platform.writeText(textCachePath(s, id), text);
}

/** Pagine web archiviate: blocchi di testo dentro la cartella della risorsa (versionati). */
export async function readArchive(s: Scope, id: string): Promise<Block[] | null> {
  return readJson<Block[] | null>(joinPath(itemDir(s, id), 'page.json'), null);
}

export async function writeArchive(s: Scope, id: string, blocks: Block[]): Promise<void> {
  await writeJson(joinPath(itemDir(s, id), 'page.json'), blocks);
}

export async function indexResource(s: Scope, r: Resource, text: string): Promise<void> {
  try {
    await platform.indexUpsert(indexDbPath(s), [
      {
        id: r.id,
        title: r.title,
        authors: authorsOf(r).join('; '),
        year: String(yearOf(r) ?? ''),
        kind: r.kind,
        tags: r.tags.join(' '),
        text: text.slice(0, 2_000_000),
      },
    ]);
  } catch {
    /* la ricerca full-text e' un aiuto: senza indice si cerca nei titoli */
  }
}

// ---------------------------------------------------------------- file del vault accanto

export interface Link {
  id: string;
  from: string; // id risorsa, "doc:<rel>" o id di nota
  to: string;
  label?: string;
}

export interface WbNote {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color?: string;
}

export interface WbFrame {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
}

export interface Whiteboard {
  version: 1;
  nodes: Record<string, { x: number; y: number; w?: number }>;
  notes: WbNote[];
  frames: WbFrame[];
  /** pergamene messe sulla Tabula come nodi (percorsi relativi al Compendium) */
  docs?: string[];
  viewport?: { x: number; y: number; zoom: number };
}

export async function loadLayers(root: string): Promise<LayersFile> {
  const f = await readJson<LayersFile | null>(joinPath(root, LAYERS_FILE), null);
  return { version: 1, layers: f?.layers ?? [], dismissed: f?.dismissed ?? [] };
}

export async function saveLayers(root: string, f: LayersFile) {
  await writeJson(joinPath(root, LAYERS_FILE), f);
}

export async function loadLinks(root: string): Promise<Link[]> {
  return (await readJson<{ links?: Link[] } | null>(joinPath(root, LINKS_FILE), null))?.links ?? [];
}

export async function saveLinks(root: string, links: Link[]) {
  await writeJson(joinPath(root, LINKS_FILE), { version: 1, links });
}

export async function loadWhiteboard(root: string): Promise<Whiteboard> {
  const w = await readJson<Whiteboard | null>(joinPath(root, WHITEBOARD_FILE), null);
  return { version: 1, nodes: w?.nodes ?? {}, notes: w?.notes ?? [], frames: w?.frames ?? [], viewport: w?.viewport };
}

export async function saveWhiteboard(root: string, w: Whiteboard) {
  await writeJson(joinPath(root, WHITEBOARD_FILE), w);
}
