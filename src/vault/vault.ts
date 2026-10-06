// Operazioni sul vault: creazione, elenco dei documenti, lettura e scrittura con i file accanto.
import { t, getLang } from '../i18n';
import { platform, joinPath, baseName } from '../platform';
import {
  LEGACY_DIRS,
  namedDirs,
  setVaultDirs,
  docsDir,
  type VaultDirs,
  META_DIR,
  CACHE_DIR,
  VAULT_FILE,
  abs,
  commentsFile,
  docSettingsFile,
  safeFileName,
  uniqueName,
  titleFromRel,
} from './paths';

export interface VaultConfig {
  version: 1;
  name: string;
  created: string;
  /** Ordine manuale dei documenti (percorsi relativi); quelli assenti vanno in coda per nome */
  order: string[];
  /** lingua di scrittura del Compendium ('it', 'en', ...); assente = quella dell'interfaccia */
  language?: string;
  /** cartelle delle pergamene e delle risorse; assente = documents/ e resources/ (Compendium di prima) */
  dirs?: VaultDirs;
}

/** Cartelle di un Compendium (quelle scritte in vault.json, o quelle di prima). */
export function dirsOf(cfg: VaultConfig): VaultDirs {
  const d = cfg.dirs;
  return d && typeof d.docs === 'string' && typeof d.res === 'string' && d.docs && d.res ? d : LEGACY_DIRS;
}

export interface DocInfo {
  rel: string; // documents/....md
  title: string;
  folder: string; // sottocartella dentro documents/ ('' = radice)
  mtime: number;
}

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    if (!(await platform.exists(path))) return fallback;
    return JSON.parse(await platform.readText(path)) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await platform.writeText(path, JSON.stringify(value, null, 2) + '\n');
}

export async function isVault(root: string): Promise<boolean> {
  return platform.exists(joinPath(root, VAULT_FILE));
}

/** Crea (o completa) la struttura di un vault e il repository git, con un primo commit. */
export async function ensureVault(root: string, name?: string, withDirs?: VaultDirs): Promise<VaultConfig> {
  let cfg = await readJson<VaultConfig | null>(joinPath(root, VAULT_FILE), null);
  const fresh = !cfg;
  if (!cfg) {
    // cartella nuova: i nomi dell'app; una cartella che ha gia' documents/ (vault di prima) li tiene
    const legacy = await platform.exists(joinPath(root, LEGACY_DIRS.docs));
    const dirs = withDirs ?? (legacy ? LEGACY_DIRS : namedDirs(getLang()));
    cfg = { version: 1, name: name ?? baseName(root), created: new Date().toISOString(), order: [], dirs };
    await platform.mkdir(joinPath(root, META_DIR));
    await writeJson(joinPath(root, VAULT_FILE), cfg);
  }
  const dirs = dirsOf(cfg);
  setVaultDirs(dirs);
  for (const d of [dirs.docs, dirs.res, META_DIR, CACHE_DIR]) await platform.mkdir(joinPath(root, d));
  await platform.gitInit(root);
  const gi = joinPath(root, '.gitignore');
  if (!(await platform.exists(gi))) await platform.writeText(gi, `${CACHE_DIR}/\n*.alexandria-tmp\n.DS_Store\nThumbs.db\n`);
  if (fresh) {
    try {
      await platform.gitCommit(root, t('vc.msg.created'));
    } catch {
      /* il primo commit puo' fallire se git non e' disponibile: il vault resta valido */
    }
  }
  return cfg;
}

export async function saveVaultConfig(root: string, cfg: VaultConfig): Promise<void> {
  await writeJson(joinPath(root, VAULT_FILE), cfg);
}

export async function listDocuments(root: string, cfg: VaultConfig): Promise<DocInfo[]> {
  const out: DocInfo[] = [];
  const docs = dirsOf(cfg).docs;
  async function walk(dir: string, folder: string) {
    let entries;
    try {
      entries = await platform.list(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      if (e.isDir) await walk(e.path, folder ? `${folder}/${e.name}` : e.name);
      else if (/\.md$/i.test(e.name)) {
        const rel = `${docs}/${folder ? folder + '/' : ''}${e.name}`;
        out.push({ rel, title: titleFromRel(rel), folder, mtime: e.mtime });
      }
    }
  }
  await walk(joinPath(root, docs), '');
  const order = new Map(cfg.order.map((r, i) => [r, i]));
  out.sort((a, b) => {
    const oa = order.get(a.rel) ?? Infinity;
    const ob = order.get(b.rel) ?? Infinity;
    if (oa !== ob) return oa - ob;
    return a.rel.localeCompare(b.rel, undefined, { numeric: true });
  });
  return out;
}

export async function readDocument(root: string, rel: string): Promise<string> {
  const p = abs(root, rel);
  return (await platform.exists(p)) ? platform.readText(p) : '';
}

export async function writeDocument(root: string, rel: string, md: string): Promise<void> {
  await platform.writeText(abs(root, rel), md);
}

export async function createDocument(root: string, docs: DocInfo[], title: string, folder = '', body = ''): Promise<string> {
  const dir = folder ? `${docsDir()}/${folder}` : docsDir();
  const taken = new Set(docs.filter((d) => d.folder === folder).map((d) => baseName(d.rel)));
  const name = uniqueName(safeFileName(title), taken, '.md');
  const rel = `${dir}/${name}`;
  await platform.writeText(abs(root, rel), body);
  return rel;
}

/** Rinomina il documento e i suoi file accanto (commenti, impostazioni). */
export async function renameDocument(root: string, docs: DocInfo[], rel: string, newTitle: string): Promise<string> {
  const dir = rel.slice(0, rel.lastIndexOf('/'));
  const taken = new Set(docs.filter((d) => d.rel !== rel && d.rel.startsWith(dir + '/')).map((d) => baseName(d.rel)));
  const name = uniqueName(safeFileName(newTitle), taken, '.md');
  const next = `${dir}/${name}`;
  if (next === rel) return rel;
  await platform.rename(abs(root, rel), abs(root, next));
  for (const f of [commentsFile, docSettingsFile]) {
    const a = abs(root, f(rel));
    if (await platform.exists(a)) await platform.rename(a, abs(root, f(next)));
  }
  return next;
}

export async function deleteDocument(root: string, rel: string): Promise<void> {
  await platform.remove(abs(root, rel));
  for (const f of [commentsFile, docSettingsFile]) await platform.remove(abs(root, f(rel)));
}

export async function duplicateDocument(root: string, docs: DocInfo[], rel: string, suffix: string): Promise<string> {
  const md = await readDocument(root, rel);
  const folder = docs.find((d) => d.rel === rel)?.folder ?? '';
  const next = await createDocument(root, docs, `${titleFromRel(rel)} ${suffix}`, folder, md);
  for (const f of [commentsFile, docSettingsFile]) {
    const a = abs(root, f(rel));
    if (await platform.exists(a)) await platform.copy(a, abs(root, f(next)));
  }
  return next;
}
