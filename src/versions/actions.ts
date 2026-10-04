// Operazioni di version control: salvano tutto prima, chiamano git, poi ricaricano vista ed editor.
import { platform, type FileChange, type MergeResult } from '../platform';
import { useWorkspace } from '../state/workspace';
import { useVersions } from './store';
import { flushSave } from '../editor/session';
import { getEditor } from '../state/editorRef';
import { saveNow as saveComments } from '../comments/store';
import { t } from '../i18n';

const root = () => useWorkspace.getState().vaultRoot;
const toast = (s: string, k: 'info' | 'ok' | 'error' = 'info') => useWorkspace.getState().toast(s, k);

/** Porta su disco tutto il lavoro aperto (testo e commenti). */
export async function saveAll() {
  await flushSave(getEditor());
  await saveComments();
}

async function afterChange() {
  await useVersions.getState().refresh();
  await useWorkspace.getState().refreshDocs();
  useWorkspace.getState().bumpReload();
}

async function guard<T>(f: () => Promise<T>): Promise<T | null> {
  try {
    return await f();
  } catch (e) {
    toast(String(e instanceof Error ? e.message : e), 'error');
    return null;
  }
}

export async function workingChanges(): Promise<FileChange[]> {
  const r = root();
  const head = useVersions.getState().log?.head;
  if (!r) return [];
  if (!head) {
    // nessun commit: tutto il vault e' nuovo
    return [];
  }
  return platform.gitCompare(r, head, 'WORKTREE');
}

export async function commit(message: string, foldCheckpoints = true): Promise<boolean> {
  const r = root();
  if (!r || !message.trim()) return false;
  await saveAll();
  const sha = await guard(() => platform.gitCommit(r, message.trim(), { amendCheckpoints: foldCheckpoints }));
  if (sha === null) {
    await useVersions.getState().refresh();
    return false;
  }
  if (!sha) toast(t('vc.nothingToCommit'));
  else toast(t('vc.committed'), 'ok');
  await useVersions.getState().refresh();
  return !!sha;
}

let lastCheckpoint = Date.now();

export async function checkpoint(reason?: string): Promise<string | null> {
  const r = root();
  if (!r) return null;
  await saveAll();
  const time = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const sha = await guard(() => platform.gitCommit(r, `checkpoint: ${reason ?? time}`));
  lastCheckpoint = Date.now();
  await useVersions.getState().refresh();
  return sha ?? null;
}

/** Prima di operazioni che cambiano i file: un checkpoint se ci sono modifiche non salvate in versione. */
async function protectWork(reason: string) {
  await saveAll();
  const r = root();
  if (!r) return;
  const st = await platform.gitStatus(r);
  if (st.dirty) await platform.gitCommit(r, `checkpoint: ${reason}`);
}

export async function createBranch(name: string, fromSha: string | null, switchTo: boolean): Promise<boolean> {
  const r = root();
  const clean = name.trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}._/-]/gu, '');
  if (!r || !clean) return false;
  await protectWork(t('vc.cp.beforeBranch', { name: clean }));
  const ok = await guard(() => platform.gitCreateBranch(r, clean, fromSha ?? undefined));
  if (ok === null) return false;
  if (switchTo) await switchBranch(clean);
  else await useVersions.getState().refresh();
  toast(t('vc.branchCreated', { name: clean }), 'ok');
  return true;
}

export async function switchBranch(name: string): Promise<boolean> {
  const r = root();
  if (!r) return false;
  await protectWork(t('vc.cp.beforeSwitch', { name }));
  const ok = await guard(() => platform.gitCheckout(r, name));
  if (ok === null) return false;
  await afterChange();
  toast(t('vc.switched', { name }), 'ok');
  return true;
}

export async function startMerge(branch: string): Promise<MergeResult | null> {
  const r = root();
  if (!r) return null;
  await protectWork(t('vc.cp.beforeMerge', { name: branch }));
  const res = await guard(() => platform.gitMerge(r, branch));
  if (!res) return null;
  if (res.status === 'conflicts') {
    useVersions.getState().setMerging(res);
    await useVersions.getState().refresh();
    useWorkspace.getState().setView('versions');
    return res;
  }
  await afterChange();
  toast(res.status === 'up-to-date' ? t('vc.merge.upToDate') : t('vc.merge.done', { name: branch }), 'ok');
  return res;
}

export async function completeMerge(resolved: { path: string; content: string | null }[], message: string): Promise<boolean> {
  const r = root();
  if (!r) return false;
  const ok = await guard(() => platform.gitCompleteMerge(r, resolved, message));
  if (ok === null) return false;
  useVersions.getState().setMerging(null);
  await afterChange();
  toast(t('vc.merge.completed'), 'ok');
  return true;
}

export async function abortMerge() {
  const r = root();
  if (!r) return;
  await guard(() => platform.gitAbortMerge(r));
  useVersions.getState().setMerging(null);
  await afterChange();
}

/** Riporta i file a una versione precedente, poi registra il ripristino come nuovo commit. */
export async function restoreVersion(sha: string, label: string): Promise<boolean> {
  const r = root();
  if (!r) return false;
  await protectWork(t('vc.cp.beforeRestore'));
  const ok = await guard(() => platform.gitRestore(r, sha));
  if (ok === null) return false;
  await platform.gitCommit(r, t('vc.restoredMsg', { label }));
  await afterChange();
  toast(t('vc.restored'), 'ok');
  return true;
}

export async function push() {
  const r = root();
  if (!r) return;
  await saveAll();
  const b = await guard(() => platform.gitPush(r));
  if (b) toast(t('vc.pushed', { name: b }), 'ok');
}

export async function pull() {
  const r = root();
  if (!r) return;
  await protectWork(t('vc.cp.beforePull'));
  const res = await guard(() => platform.gitPull(r));
  if (!res) return;
  if (res.status === 'conflicts') {
    useVersions.getState().setMerging(res);
    useWorkspace.getState().setView('versions');
  } else toast(res.status === 'up-to-date' ? t('vc.merge.upToDate') : t('vc.pulled'), 'ok');
  await afterChange();
}

// ---------------------------------------------------------------- checkpoint automatici

let lastEdit = 0;
export function noteEdit() {
  lastEdit = Date.now();
}

export function startAutoCheckpoints(): () => void {
  const timer = setInterval(async () => {
    const minutes = useWorkspace.getState().app.prefs.autoCheckpointMinutes;
    if (!minutes || !root()) return;
    if (lastEdit <= lastCheckpoint) return;
    if (Date.now() - lastCheckpoint < minutes * 60_000) return;
    // si aspetta una pausa di scrittura di qualche secondo
    if (Date.now() - lastEdit < 5_000) return;
    try {
      const st = await platform.gitStatus(root()!);
      if (st.dirty && !st.merging) await checkpoint();
      else lastCheckpoint = Date.now();
    } catch {
      /* git non disponibile: si riprova al prossimo giro */
    }
  }, 30_000);
  return () => clearInterval(timer);
}
