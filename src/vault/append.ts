// Aggiungi da un altro Compendium: copia nel Compendium aperto le pergamene scelte, con i loro
// Marginalia e impostazioni, le fonti citate, i tipi usati e i legami fra loro (i Codex restano Codex).
// Il Compendium d'origine non cambia. planAppend() è pura; read/apply fanno l'I/O.
import { platform, joinPath } from '../platform';
import { readJson, writeJson, listDocuments, dirsOf, type DocInfo, type VaultConfig } from './vault';
import { META_DIR, VAULT_FILE, LINKS_FILE, TYPES_FILE, CACHE_DIR, safeFileName, uniqueName, type VaultDirs } from './paths';
import type { Link } from '../resources/storage';
import { normalizeResource } from '../resources/storage';
import { newResourceId, type Resource } from '../resources/model';
import { relOfNode, docNodeId } from '../resources/docLinks';
import { normalizeTypes, type ObjectType } from '../types/model';

export interface OtherCompendium {
  root: string;
  name: string;
  dirs: VaultDirs;
  docs: DocInfo[];
  links: Link[];
  types: ObjectType[] | null;
  resources: Resource[];
}

/** Chiave dei file accanto di una pergamena, con le cartelle di quel Compendium. */
export function docKeyIn(rel: string, dirs: VaultDirs): string {
  const prefix = dirs.docs + '/';
  return (rel.startsWith(prefix) ? rel.slice(prefix.length) : rel).replace(/\.md$/i, '').replace(/\//g, '~');
}

const commentsAt = (rel: string, dirs: VaultDirs) => `${META_DIR}/comments/${docKeyIn(rel, dirs)}.json`;
const settingsAt = (rel: string, dirs: VaultDirs) => `${META_DIR}/doc-settings/${docKeyIn(rel, dirs)}.json`;

export async function readOtherCompendium(root: string): Promise<OtherCompendium> {
  const cfg = await readJson<VaultConfig | null>(joinPath(root, VAULT_FILE), null);
  if (!cfg) throw new Error('not-a-compendium');
  const dirs = dirsOf(cfg);
  const docs = await listDocuments(root, cfg);
  const links = (await readJson<{ links?: Link[] } | null>(joinPath(root, LINKS_FILE), null))?.links ?? [];
  const rawTypes = await readJson<unknown>(joinPath(root, TYPES_FILE), null);
  const resources: Resource[] = [];
  const resRoot = joinPath(root, dirs.res);
  if (await platform.exists(resRoot)) {
    for (const e of await platform.list(resRoot)) {
      if (!e.isDir) continue;
      const meta = await readJson<Resource | null>(joinPath(e.path, 'meta.json'), null);
      if (meta && meta.id) resources.push(normalizeResource(meta));
    }
  }
  return { root, name: cfg.name || root, dirs, docs, links, types: rawTypes ? normalizeTypes(rawTypes) : null, resources };
}

export interface AppendTarget {
  dirs: VaultDirs;
  docs: DocInfo[];
  resources: Resource[];
  types: ObjectType[];
}

export interface AppendPlan {
  docs: { from: string; to: string; title: string }[];
  /** fonti da copiare, con l'id nuovo nel Compendium aperto */
  sources: { from: Resource; id: string }[];
  /** fonti citate che il Compendium aperto ha già (stessa chiave o stesso file) */
  sourcesKnown: number;
  types: ObjectType[];
  links: { from: string; to: string }[];
}

/**
 * Cosa copiare e dove: le pergamene scelte (nella cartella col nome del Compendium d'origine, a
 * scelta, conservando le sottocartelle), nomi liberi, fonti citate mancanti, tipi mancanti e legami
 * fra le pergamene copiate.
 */
export function planAppend(
  src: Pick<OtherCompendium, 'name' | 'dirs' | 'docs' | 'links' | 'types' | 'resources'>,
  picked: string[],
  target: AppendTarget,
  opts: { folder: boolean; sources: boolean },
  citedKeys: Record<string, string[]>,
  newId: () => string = newResourceId,
  settingsTypes: Record<string, string | null> = {},
): AppendPlan {
  const chosen = src.docs.filter((d) => picked.includes(d.rel));
  const base = opts.folder ? safeFileName(src.name) : '';
  const takenIn = new Map<string, Set<string>>();
  for (const d of target.docs) {
    const dir = d.rel.slice(0, d.rel.lastIndexOf('/'));
    if (!takenIn.has(dir)) takenIn.set(dir, new Set());
    takenIn.get(dir)!.add(d.rel.slice(d.rel.lastIndexOf('/') + 1));
  }
  const docs = chosen.map((d) => {
    const dir = [target.dirs.docs, base, d.folder].filter(Boolean).join('/');
    const taken = takenIn.get(dir) ?? new Set<string>();
    const name = uniqueName(safeFileName(d.title), taken, '.md');
    taken.add(name);
    takenIn.set(dir, taken);
    return { from: d.rel, to: `${dir}/${name}`, title: d.title };
  });
  const to = new Map(docs.map((d) => [d.from, d.to]));

  // fonti citate dalle pergamene scelte
  const keys = new Set(chosen.flatMap((d) => citedKeys[d.rel] ?? []));
  const sources: AppendPlan['sources'] = [];
  let sourcesKnown = 0;
  if (opts.sources) {
    for (const r of src.resources) {
      if (!r.citeKey || !keys.has(r.citeKey)) continue;
      const known = target.resources.some((x) => (x.citeKey && x.citeKey === r.citeKey) || (r.meta.sha256 && x.meta.sha256 === r.meta.sha256));
      if (known) sourcesKnown++;
      else sources.push({ from: r, id: newId() });
    }
  }

  // tipi usati dalle pergamene e dalle fonti copiate, che il Compendium aperto non ha
  const used = new Set<string>([
    ...chosen.map((d) => settingsTypes[d.rel]).filter((x): x is string => !!x),
    ...sources.map((s) => s.from.object?.type).filter((x): x is string => !!x),
  ]);
  const have = new Set(target.types.map((t) => t.id));
  const types = (src.types ?? []).filter((t) => used.has(t.id) && !have.has(t.id));

  // legami fra pergamene copiate (anche i Codex)
  const links: AppendPlan['links'] = [];
  for (const l of src.links) {
    const a = relOfNode(l.from);
    const b = relOfNode(l.to);
    if (a && b && to.has(a) && to.has(b)) links.push({ from: to.get(a)!, to: to.get(b)! });
  }
  return { docs, sources, sourcesKnown, types, links };
}

async function copyIfExists(from: string, to: string) {
  if (await platform.exists(from)) await platform.copy(from, to);
}

/** Esegue il piano nel Compendium aperto (root, cartelle). Restituisce i percorsi delle pergamene nuove. */
export async function applyAppend(src: OtherCompendium, plan: AppendPlan, root: string, dirs: VaultDirs, targetTypes: ObjectType[]): Promise<string[]> {
  for (const d of plan.docs) {
    await platform.mkdir(joinPath(root, d.to.slice(0, d.to.lastIndexOf('/'))));
    await platform.copy(joinPath(src.root, d.from), joinPath(root, d.to));
    await copyIfExists(joinPath(src.root, commentsAt(d.from, src.dirs)), joinPath(root, commentsAt(d.to, dirs)));
    await copyIfExists(joinPath(src.root, settingsAt(d.from, src.dirs)), joinPath(root, settingsAt(d.to, dirs)));
  }
  for (const s of plan.sources) {
    const fromDir = joinPath(src.root, src.dirs.res, s.from.id);
    const toDir = joinPath(root, dirs.res, s.id);
    await platform.mkdir(toDir);
    for (const e of await platform.list(fromDir)) {
      if (e.isDir || e.name === 'meta.json') continue;
      await platform.copy(e.path, joinPath(toDir, e.name));
    }
    await writeJson(joinPath(toDir, 'meta.json'), { ...s.from, id: s.id, layers: [], created: new Date().toISOString() });
    await copyIfExists(joinPath(src.root, CACHE_DIR, 'text', `${s.from.id}.txt`), joinPath(root, CACHE_DIR, 'text', `${s.id}.txt`));
  }
  if (plan.types.length) await writeJson(joinPath(root, TYPES_FILE), { version: 1, types: [...targetTypes, ...plan.types] });
  if (plan.links.length) {
    const links = (await readJson<{ links?: Link[] } | null>(joinPath(root, LINKS_FILE), null))?.links ?? [];
    const now = Date.now().toString(36);
    plan.links.forEach((l, i) => links.push({ id: `a${now}${i}`, from: docNodeId(l.from), to: docNodeId(l.to) }));
    await writeJson(joinPath(root, LINKS_FILE), { version: 1, links });
  }
  return plan.docs.map((d) => d.to);
}
