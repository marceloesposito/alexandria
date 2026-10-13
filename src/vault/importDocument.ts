// Apri documento: un file scritto con un'altra app (Word, LibreOffice, Pages esportato, TextEdit...)
// diventa una pergamena nuova del Compendium aperto. Le immagini vanno nell'Armarium come figure; le
// revisioni tracciate e i commenti di Word tornano come revisioni e Marginalia della pergamena.
import { platform, baseName } from '../platform';
import { useWorkspace } from '../state/workspace';
import { createDocument } from './vault';
import { abs } from './paths';
import { serializeMarkdown } from 'logos/doc/serialize';
import { sha256Hex } from 'logos/lib/bytes';
import { convertFile, replaceImageKeys, IMPORT_EXTENSIONS, ImportError, type ImportedDoc } from '../doc/import/convert';
import { importFiles } from '../resources/importer';
import { useResources } from '../resources/store';
import { nodeFor } from '../resources/insert';
import { onDocLoaded, flushSave } from '../editor/session';
import { getEditor } from '../state/editorRef';
import { t } from '../i18n';

export { IMPORT_EXTENSIONS };

export function isImportable(path: string): boolean {
  const i = path.lastIndexOf('.');
  return i >= 0 && IMPORT_EXTENSIONS.includes(path.slice(i + 1).toLowerCase());
}

function errorText(e: unknown, name: string): string {
  if (e instanceof ImportError) return t(`importDoc.error.${e.code}`, { name });
  return t('importDoc.error.generic', { name, error: e instanceof Error ? e.message : String(e) });
}

/** Immagini nell'Armarium (una gia' presente non si duplica): segnaposto -> percorso dalla pergamena. */
async function storeImages(r: ImportedDoc, rel: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < r.images.length; i++) {
    const img = r.images[i];
    const ext = img.name.includes('.') ? img.name.slice(img.name.lastIndexOf('.')) : '.png';
    const name = r.images.length > 1 ? `${r.title} ${i + 1}${ext}` : `${r.title}${ext}`;
    const made = await importFiles([{ name, data: img.data }], 'vault', { quiet: true });
    let res = made[0];
    if (!res) {
      const sha = await sha256Hex(img.data);
      res = useResources.getState().resources.find((x) => x.meta.sha256 === sha)!;
    }
    if (!res) continue;
    const node = nodeFor(res, rel);
    if (node.type === 'figure') out.set(img.key, String(node.attrs.src));
  }
  return out;
}

/** Revisioni e commenti di Word: si applicano appena la pergamena e' aperta nell'editor. */
function applyReviewWhenOpen(rel: string, r: ImportedDoc) {
  if (!r.review) return;
  const review = r.review;
  const off = onDocLoaded(async (_editor, _root, loaded) => {
    if (loaded !== rel) return;
    off();
    const { applyWordReview } = await import('../revision/word');
    const res = await applyWordReview(review);
    if (res.changes || res.comments) useWorkspace.getState().toast(t('importDoc.review', { changes: res.changes, comments: res.comments }), 'info');
  });
}

/** Converte e salva un file come pergamena; restituisce il percorso della pergamena o null. */
async function importOne(path: string): Promise<string | null> {
  const ws = useWorkspace.getState();
  const root = ws.vaultRoot;
  if (!root) return null;
  const name = baseName(path);
  let r: ImportedDoc;
  try {
    r = await convertFile(name, await platform.readBytes(path));
  } catch (e) {
    ws.toast(errorText(e, name), 'error');
    return null;
  }
  const rel = await createDocument(root, useWorkspace.getState().docs, r.title, '', '');
  let markdown = r.markdown;
  if (markdown === null) {
    const srcs = r.images.length ? await storeImages(r, rel) : new Map<string, string>();
    markdown = serializeMarkdown(replaceImageKeys(r.doc!, (k) => srcs.get(k) ?? null));
  }
  await platform.writeText(abs(root, rel), markdown);
  applyReviewWhenOpen(rel, r);
  return rel;
}

/** Apre uno o piu' documenti (scelti ora se `paths` manca) come pergamene nuove. */
export async function importDocuments(paths?: string[]): Promise<void> {
  const ws = useWorkspace.getState();
  if (!ws.vaultRoot) {
    ws.toast(t('importDoc.noCompendium'), 'error');
    return;
  }
  const list = paths ?? (await platform.pickFiles(t('importDoc.pick'), IMPORT_EXTENSIONS));
  if (!list.length) return;
  await flushSave(getEditor());
  const made: string[] = [];
  for (const p of list) {
    const rel = await importOne(p);
    if (rel) made.push(rel);
  }
  if (!made.length) return;
  await ws.refreshDocs();
  const st = useWorkspace.getState();
  st.openDoc(made[made.length - 1]);
  st.setView('editor');
  st.toast(made.length === 1 ? t('importDoc.done', { name: baseName(list[0]) }) : t('importDoc.doneMany', { count: made.length }), 'ok');
}
