// Disposizione dei file in un vault. Tutti i percorsi "rel" sono relativi alla radice del vault.
import { joinPath } from '../platform';

/**
 * Cartelle delle pergamene e delle risorse. I Compendium nuovi usano i nomi dell'app (Pergamene o
 * Scrolls, Armarium), scritti in vault.json; quelli creati prima restano con documents/ e resources/
 * (spostarli romperebbe la storia delle versioni).
 */
export interface VaultDirs {
  docs: string;
  res: string;
}

export const LEGACY_DIRS: VaultDirs = { docs: 'documents', res: 'resources' };

/** Nomi delle cartelle di un Compendium nuovo, nella lingua dell'interfaccia. */
export function namedDirs(lang: string): VaultDirs {
  return { docs: lang === 'it' ? 'Pergamene' : 'Scrolls', res: 'Armarium' };
}

let current: VaultDirs = LEGACY_DIRS;

/** Cartelle del Compendium aperto (le imposta l'apertura del Compendium). */
export function setVaultDirs(d: VaultDirs) {
  current = d;
}

export function vaultDirs(): VaultDirs {
  return current;
}

export function docsDir(): string {
  return current.docs;
}

export function resDir(): string {
  return current.res;
}

/** Percorso di una pergamena del Compendium aperto (es. "Pergamene/Capitolo.md"). */
export function isDocPath(path: string): boolean {
  return path.startsWith(current.docs + '/') && /\.md$/i.test(path);
}

export const META_DIR = '.alexandria';
export const CACHE_DIR = '.alexandria-cache';

export const VAULT_FILE = `${META_DIR}/vault.json`;
export const LAYERS_FILE = `${META_DIR}/layers.json`;
export const LINKS_FILE = `${META_DIR}/links.json`;
export const WHITEBOARD_FILE = `${META_DIR}/whiteboard.json`;
export const TYPES_FILE = `${META_DIR}/types.json`;
export const INDEX_DB = `${CACHE_DIR}/index.sqlite`;

/** Chiave stabile del documento per i file accanto: documents/a/b.md -> a~b */
export function docKey(rel: string): string {
  const prefix = current.docs + '/';
  return (rel.startsWith(prefix) ? rel.slice(prefix.length) : rel)
    .replace(/\.md$/i, '')
    .replace(/\//g, '~');
}

export function commentsFile(rel: string): string {
  return `${META_DIR}/comments/${docKey(rel)}.json`;
}

export function docSettingsFile(rel: string): string {
  return `${META_DIR}/doc-settings/${docKey(rel)}.json`;
}

export function abs(root: string, rel: string): string {
  return joinPath(root, rel);
}

/** Nome di file valido su Windows e macOS a partire da un titolo. */
export function safeFileName(title: string): string {
  const s = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  const reserved = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
  const out = s.slice(0, 120) || 'Untitled';
  return reserved.test(out) ? `_${out}` : out;
}

/** Primo nome libero: "Titolo", "Titolo 2", "Titolo 3"... */
export function uniqueName(base: string, taken: Set<string>, ext = ''): string {
  const lower = new Set([...taken].map((t) => t.toLowerCase()));
  if (!lower.has((base + ext).toLowerCase())) return base + ext;
  for (let i = 2; i < 10000; i++) {
    const name = `${base} ${i}${ext}`;
    if (!lower.has(name.toLowerCase())) return name;
  }
  return `${base} ${Date.now()}${ext}`;
}

export function titleFromRel(rel: string): string {
  const name = rel.slice(rel.lastIndexOf('/') + 1);
  return name.replace(/\.md$/i, '');
}
