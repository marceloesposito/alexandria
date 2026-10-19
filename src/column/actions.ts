// Azioni sul pezzo che passano dal disco o chiedono qualcosa: Apri, Salva, Salva come, Rinomina,
// Togli dall'elenco,
// Porta in un Compendium, versioni con un nome, Esci.
import { platform, joinPath } from '../platform';
import { useColumn, sheetTitle, openPath } from './store';
import { useUi } from './ui';
import { OPEN_EXTENSIONS } from './importDoc';
import { planToCompendium, type CompendiumInfo } from './toCompendium';
import { liveMarkdown } from './editor/Scriptorium';
import { getEditor } from './editor/editorRef';
import { promptDialog } from '../components/confirm';
import { newId } from './tabula/model';
import { t } from '../i18n';

/** Il testo dell'editor entra nel foglio prima di salvarlo altrove. */
function syncText() {
  const st = useColumn.getState();
  st.setMarkdown(liveMarkdown(getEditor()));
}

export async function openFiles() {
  const paths = await platform.pickFiles(t('open.pick'), OPEN_EXTENSIONS);
  for (const p of paths) await openPath(p);
}

/** Rinomina: si apre il nome del foglio in alto, li' dove sta. */
export function renameSheet() {
  (document.querySelector('[data-cmd="sheet.rename"]') as HTMLElement | null)?.click();
}

export async function save() {
  syncText();
  await useColumn.getState().save();
}

export async function saveAs() {
  syncText();
  await useColumn.getState().saveAs();
}

/** Toglie il pezzo dall'elenco dei recenti; il file resta dov'e'. */
export async function forgetSheet(path: string | null) {
  if (path) await useColumn.getState().remove(path);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await platform.readText(path)) as T;
  } catch {
    return fallback;
  }
}

/** Porta il foglio in un Compendium di Alexandria: pergamena, Marginalia, media e Tabula. */
export async function toCompendium() {
  syncText();
  const st = useColumn.getState();
  if (!st.sheet) return;
  const root = await platform.pickDirectory(t('compendium.pick'));
  if (!root) return;
  const cfgPath = joinPath(root, '.alexandria', 'vault.json');
  if (!(await platform.exists(cfgPath))) {
    st.toast(t('compendium.notCompendium'), 'error');
    return;
  }
  const cfg = await readJson<{ dirs?: { docs?: string; res?: string } }>(cfgPath, {});
  const docs = cfg.dirs?.docs || 'documents';
  const res = cfg.dirs?.res || 'resources';
  const list = async (dir: string) => ((await platform.exists(dir)) ? await platform.list(dir) : []);
  const info: CompendiumInfo = {
    dirs: cfg.dirs,
    docNames: (await list(joinPath(root, docs))).filter((e) => !e.isDir).map((e) => e.name),
    resourceIds: (await list(joinPath(root, res))).filter((e) => e.isDir).map((e) => e.name),
    whiteboard: await readJson(joinPath(root, '.alexandria', 'whiteboard.json'), null),
    links: (await readJson<{ links?: CompendiumInfo['links'] }>(joinPath(root, '.alexandria', 'links.json'), {})).links ?? [],
  };
  const title = sheetTitle(st.sheet);
  const plan = planToCompendium(st.sheet, title, info, { now: new Date(), idOf: () => newId('f') });
  try {
    for (const w of plan.writes) {
      const p = joinPath(root, w.path);
      if (typeof w.data === 'string') await platform.writeText(p, w.data);
      else await platform.writeBytes(p, w.data);
    }
    st.toast(t('compendium.done', { name: plan.docRel.slice(plan.docRel.lastIndexOf('/') + 1) }), 'ok');
  } catch (e) {
    st.toast(t('compendium.error', { error: e instanceof Error ? e.message : String(e) }), 'error');
  }
}

export async function saveNamedVersion() {
  syncText();
  const name = await promptDialog(t('version.nameTitle'), '', t('version.nameHint'));
  if (name === null) return;
  const id = useColumn.getState().saveVersion(name.trim() || undefined, false);
  if (id) useUi.setState({ selectedVersion: id });
}

export function resumeSelected() {
  const id = useUi.getState().selectedVersion;
  if (!id) {
    useColumn.getState().toast(t('version.selectFirst'), 'info');
    return;
  }
  syncText();
  useColumn.getState().resumeVersion(id);
  useColumn.getState().toast(t('version.resumed'), 'ok');
}

export async function quit() {
  syncText();
  const { maybeSnapshot } = await import('./store');
  maybeSnapshot(true);
  await useColumn.getState().flush();
  if (platform.kind === 'tauri') {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  } else window.close();
}
