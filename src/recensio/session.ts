// Copia per revisione: creazione (autore), apertura in modalità revisore (testo bloccato, solo
// revisioni tracciate e Marginalia), salvataggio e restituzione, import della revisione restituita
// su un branch del Palimpsestus seguito dall'unione guidata.
import { create } from 'zustand';
import { platform, joinPath, dirName, baseName } from '../platform';
import { useWorkspace } from '../state/workspace';
import { readDocument, readJson, writeJson } from '../vault/vault';
import { abs, commentsFile, RES_DIR } from '../vault/paths';
import { parseMarkdown } from '../doc/parse';
import { keysOfDoc } from '../export/run';
import { useResources, dirOf } from '../resources/store';
import type { Resource } from '../resources/model';
import { flushSave } from '../editor/session';
import { getEditor } from '../state/editorRef';
import { useTrack } from '../editor/extensions/track';
import { checkpoint, createBranch, startMerge } from '../versions/actions';
import { useVersions } from '../versions/store';
import { packRecensio, unpackRecensio, returnedName, reviewBranch, RECENSIO_EXT, RECENSIO_FORMAT, type RecensioManifest, type RecensioContent } from './format';
import { promptDialog } from '../components/confirm';
import { t } from '../i18n';

export interface ReviewSession {
  /** file .recensio aperto */
  path: string;
  manifest: RecensioManifest;
  /** cartella di lavoro temporanea (un Compendium usa e getta) */
  root: string;
  /** Compendium aperto prima, da riaprire alla chiusura */
  previous: string | null;
}

export const useReview = create<{ session: ReviewSession | null }>(() => ({ session: null }));

const toast = (m: string, k: 'ok' | 'error' | 'info' = 'info') => useWorkspace.getState().toast(m, k);
const sourceFiles = (r: Resource, withFile: boolean) => [r.meta.thumb, r.meta.screenshot, withFile ? r.file : undefined].filter((x): x is string => !!x);

// ---------------------------------------------------------------- autore: crea la copia

/** Prepara e salva la copia per revisione delle pergamene indicate (in ordine). */
export async function createRecensio(rels: string[], title: string, includeFiles: boolean): Promise<string | null> {
  const ws = useWorkspace.getState();
  const root = ws.vaultRoot;
  if (!root || !rels.length) return null;
  await flushSave(getEditor());
  // la copia parte da una versione salvata: è la base per l'unione al ritorno
  await checkpoint(t('recensio.checkpoint'));
  await useVersions.getState().refresh();
  const baseSha = useVersions.getState().log?.head ?? null;
  const texts: Record<string, string> = {};
  const comments: Record<string, unknown> = {};
  const keys = new Set<string>();
  for (const rel of rels) {
    texts[rel] = await readDocument(root, rel);
    keysOfDoc(parseMarkdown(texts[rel])).forEach((k) => keys.add(k));
    const c = await readJson<unknown>(abs(root, commentsFile(rel)), null);
    if (c) comments[rel] = c;
  }
  const sources: RecensioContent['sources'] = {};
  for (const r of useResources.getState().resources.filter((x) => x.citeKey && keys.has(x.citeKey))) {
    const files: Record<string, Uint8Array> = {};
    const dir = dirOf(r);
    for (const name of sourceFiles(r, includeFiles)) {
      try {
        if (dir) files[name] = await platform.readBytes(joinPath(dir, name));
      } catch {
        /* file mancante: la fonte resta con i soli metadati */
      }
    }
    const { library: _lib, ...meta } = r;
    sources[r.id] = { meta: includeFiles ? meta : { ...meta, file: undefined }, files };
  }
  const manifest: RecensioManifest = {
    format: RECENSIO_FORMAT,
    version: 1,
    title,
    author: ws.app.prefs.authorName,
    compendium: ws.vault?.name ?? '',
    created: new Date().toISOString(),
    baseSha,
    docs: rels.map((rel) => ({ rel, title: ws.docs.find((d) => d.rel === rel)?.title ?? rel })),
  };
  const path = await platform.saveDialog(`${title}.${RECENSIO_EXT}`, [RECENSIO_EXT]);
  if (!path) return null;
  await platform.writeBytes(path, await packRecensio({ manifest, texts, comments, sources }));
  toast(t('recensio.created'), 'ok');
  return path;
}

// ---------------------------------------------------------------- revisore: apre, salva, restituisce

/** Apre un .recensio: se è una revisione restituita e c'è il Compendium giusto aperto, propone l'import. */
export async function openRecensioFile(path: string) {
  const ws = useWorkspace.getState();
  let content: RecensioContent;
  try {
    content = await unpackRecensio(await platform.readBytes(path));
  } catch {
    toast(t('recensio.invalid'), 'error');
    return;
  }
  if (content.manifest.returned) {
    // revisione restituita: va nel suo Compendium (quello aperto o uno dei recenti con lo stesso nome)
    if (!(ws.vaultRoot && ws.vault?.name === content.manifest.compendium)) {
      const known = ws.app.recentVaults.find((r) => baseName(r) === content.manifest.compendium);
      if (!known || !(await ws.enterVault(known))) {
        toast(t('recensio.noCompendium', { name: content.manifest.compendium }), 'error');
        return;
      }
    }
    return importReturned(path, content);
  }
  await openAsReviewer(path, content);
}

async function openAsReviewer(path: string, content: RecensioContent) {
  const ws = useWorkspace.getState();
  await flushSave(getEditor());
  let reviewer = content.manifest.reviewer?.name ?? ws.app.prefs.authorName;
  if (!reviewer) reviewer = (await promptDialog(t('recensio.askName'), '', t('recensio.askNameHint'))) ?? '';
  if (!reviewer.trim()) reviewer = t('comments.reviewer');
  // cartella di lavoro: un Compendium temporaneo con le pergamene, i commenti e le fonti
  const root = joinPath(await platform.appDataDir(), 'recensio', `r${Date.now().toString(36)}`);
  await platform.mkdir(root);
  for (const d of content.manifest.docs) {
    await platform.mkdir(dirName(abs(root, d.rel)));
    await platform.writeText(abs(root, d.rel), content.texts[d.rel] ?? '');
    if (content.comments[d.rel]) await writeJson(abs(root, commentsFile(d.rel)), content.comments[d.rel]);
  }
  for (const [id, s] of Object.entries(content.sources)) {
    const dir = joinPath(root, RES_DIR, id);
    await platform.mkdir(dir);
    await writeJson(joinPath(dir, 'meta.json'), s.meta);
    for (const [name, data] of Object.entries(s.files)) await platform.writeBytes(joinPath(dir, name), data);
  }
  useReview.setState({ session: { path, manifest: { ...content.manifest, reviewer: { name: reviewer.trim() } }, root, previous: ws.vaultRoot } });
  useTrack.getState().set({ suggest: true, locked: true, reviewer: reviewer.trim(), author: reviewer.trim() });
  await ws.enterVault(root, true);
  useWorkspace.getState().setView('editor');
}

async function packSession(s: ReviewSession, returned: boolean): Promise<Uint8Array> {
  await flushSave(getEditor());
  const texts: Record<string, string> = {};
  const comments: Record<string, unknown> = {};
  for (const d of s.manifest.docs) {
    texts[d.rel] = await readDocument(s.root, d.rel);
    const c = await readJson<unknown>(abs(s.root, commentsFile(d.rel)), null);
    if (c) comments[d.rel] = c;
  }
  // le fonti tornano com'erano (il revisore le legge soltanto)
  const original = await unpackRecensio(await platform.readBytes(s.path)).catch(() => null);
  const manifest = { ...s.manifest, ...(returned ? { returned: new Date().toISOString() } : {}) };
  return packRecensio({ manifest, texts, comments, sources: original?.sources ?? {} });
}

/** Salva la revisione nello stesso file. */
export async function saveReview() {
  const s = useReview.getState().session;
  if (!s) return;
  await platform.writeBytes(s.path, await packSession(s, false));
  toast(t('recensio.saved'), 'ok');
}

/** Salva la revisione come file da restituire all'autore. */
export async function returnReview() {
  const s = useReview.getState().session;
  if (!s) return;
  const path = await platform.saveDialog(returnedName(s.manifest.title, s.manifest.reviewer?.name ?? ''), [RECENSIO_EXT]);
  if (!path) return;
  await platform.writeBytes(path, await packSession(s, true));
  toast(t('recensio.returned'), 'ok');
}

export async function closeReview() {
  const s = useReview.getState().session;
  if (!s) return;
  await flushSave(getEditor());
  useReview.setState({ session: null });
  const name = useWorkspace.getState().app.prefs.authorName;
  useTrack.getState().set({ suggest: false, locked: false, reviewer: null, author: name || t('comments.me') });
  const ws = useWorkspace.getState();
  ws.closeVault();
  await platform.remove(s.root).catch(() => undefined);
  if (s.previous) await ws.enterVault(s.previous);
}

// ---------------------------------------------------------------- autore: importa la revisione restituita

export async function importReturned(path: string, preloaded?: RecensioContent) {
  try {
    await doImport(path, preloaded);
  } catch (e) {
    console.error('[recensio] import', e);
    toast(String(e instanceof Error ? e.message : e), 'error');
  }
}

async function doImport(path: string, preloaded?: RecensioContent) {
  const ws = useWorkspace.getState();
  const root = ws.vaultRoot;
  if (!root) return;
  const content = preloaded ?? (await unpackRecensio(await platform.readBytes(path)));
  const m = content.manifest;
  await useVersions.getState().refresh();
  const log = useVersions.getState().log;
  if (!m.baseSha || !log?.commits.some((c) => c.sha === m.baseSha)) {
    toast(t('recensio.noBase'), 'error');
    return;
  }
  const back = log.branch;
  const branch = reviewBranch(m.reviewer?.name ?? '', m.returned ?? new Date().toISOString());
  // un branch dalla versione di partenza con le pergamene rivedute, poi l'unione guidata
  if (!(await createBranch(branch, m.baseSha, true))) return;
  for (const d of m.docs) {
    await platform.writeText(abs(root, d.rel), content.texts[d.rel] ?? '');
    if (content.comments[d.rel]) await writeJson(abs(root, commentsFile(d.rel)), content.comments[d.rel]);
  }
  await platform.gitCommit(root, t('recensio.commit', { name: m.reviewer?.name ?? '' }));
  // ritorno diretto al branch di prima: senza salvare lo stato aperto, che è ancora quello di partenza
  if (back) await platform.gitCheckout(root, back);
  await useVersions.getState().refresh();
  await useWorkspace.getState().refreshDocs();
  useWorkspace.getState().bumpReload();
  await startMerge(branch);
  toast(t('recensio.imported', { name: m.reviewer?.name ?? '' }), 'ok');
}

/** Sceglie un .recensio da aprire (revisore) o da importare (autore). */
export async function pickRecensio() {
  const [path] = await platform.pickFiles(t('recensio.pick'));
  if (path) await openRecensioFile(path);
}
