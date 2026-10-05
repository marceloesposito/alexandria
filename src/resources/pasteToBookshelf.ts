// Cmd/Ctrl+V in qualsiasi schermata (fuori dai campi di testo e dall'editor): gli appunti diventano
// una risorsa della Bookshelf del tipo giusto (file, link, voce bibliografica, snippet, nota).
import { useWorkspace, ws } from '../state/workspace';
import { useResources } from './store';
import { importFiles, importUrls, importBibliography, importCslItems, lookupIsbn, createSnippet, importPaths } from './importer';
import { platform } from '../platform';
import { classifyClipboard, titleFromText } from './clipboard';
import { t } from '../i18n';

/** Dove arriva la risorsa: la Library se e' quella aperta, altrimenti il Compendium. */
function target(): 'vault' | 'library' {
  return ws().app.view === 'resources' && useResources.getState().scope === 'library' ? 'library' : 'vault';
}

function added(name: string) {
  ws().toast(t('paste.added', { name }), 'ok', ws().app.view === 'resources' ? undefined : { label: t('paste.open'), run: () => ws().setView('resources') });
}

export async function pasteToBookshelf(dt: DataTransfer): Promise<boolean> {
  return pasteContent({ fileCount: dt.files?.length ?? 0, plain: dt.getData('text/plain') ?? '' }, async () =>
    Promise.all(Array.from(dt.files).map(async (f) => ({ name: f.name || 'appunti.png', mime: f.type, data: new Uint8Array(await f.arrayBuffer()) }))),
  );
}

async function pasteContent(d: { fileCount: number; plain: string }, readFiles: () => Promise<{ name: string; mime: string; data: Uint8Array }[]>): Promise<boolean> {
  const c = classifyClipboard(d);
  if (!c) return false;
  const to = target();
  switch (c.kind) {
    case 'files':
      await importFiles(await readFiles(), to);
      break;
    case 'links':
      await importUrls(c.urls, to);
      break;
    case 'doi':
      await importUrls([`https://doi.org/${c.doi}`], to);
      break;
    case 'bibliography':
      await importBibliography(c.text, to);
      break;
    case 'isbn': {
      const csl = await lookupIsbn(c.isbn);
      const made = await importCslItems([csl ?? { type: 'book', title: `ISBN ${c.isbn}`, ISBN: c.isbn }], to);
      if (made[0]) added(made[0].title);
      break;
    }
    case 'code': {
      const r = await createSnippet(titleFromText(c.code), c.language, c.code, to);
      if (r) added(r.title);
      break;
    }
    case 'text': {
      const title = titleFromText(c.text) || t('paste.note');
      const made = await importFiles([{ name: `${title.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'nota'}.txt`, mime: 'text/plain', data: new TextEncoder().encode(c.text) }], to);
      if (made[0]) await useResources.getState().update(made[0].id, { title });
      break;
    }
  }
  return true;
}

/** Appunti letti dall'app nativa (macOS, quando la webview non genera l'evento paste). */
async function pasteFromNative(): Promise<void> {
  const clip = await platform.readClipboard();
  if (!clip) return;
  if (clip.files.length) {
    await importPaths(clip.files, target());
    return;
  }
  const image = clip.image;
  await pasteContent({ fileCount: image ? 1 : 0, plain: clip.text ?? '' }, async () => (image ? [{ name: 'appunti.png', mime: 'image/png', data: image }] : []));
}

function editableTarget(el: Element | null): boolean {
  const h = el as HTMLElement | null;
  return !!h && (/^(INPUT|TEXTAREA|SELECT)$/.test(h.tagName) || h.isContentEditable || !!h.closest('[contenteditable="true"], .ProseMirror'));
}

function busy(): boolean {
  const s = useWorkspace.getState();
  return !s.vaultRoot || !!s.dialog || !!document.querySelector('.modal-backdrop, .viewer-backdrop, .onboarding-backdrop');
}

// l'evento paste e il ripiego nativo non devono importare due volte la stessa cosa
let waitingNative: ReturnType<typeof setTimeout> | null = null;

/** Cmd/Ctrl+V fuori dai campi: se entro poco non arriva l'evento paste, si leggono gli appunti di sistema. */
export function onGlobalKeydown(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'v') return;
  if (platform.kind !== 'tauri' || editableTarget(document.activeElement) || busy()) return;
  if (waitingNative) clearTimeout(waitingNative);
  waitingNative = setTimeout(() => {
    waitingNative = null;
    void pasteFromNative();
  }, 150);
}

/** Si incolla nella Bookshelf solo quando nessun campo di testo, editor o dialogo aspetta l'incolla. */
export function onGlobalPaste(e: ClipboardEvent) {
  if (e.defaultPrevented || !e.clipboardData) return;
  const el = e.target as HTMLElement | null;
  if (editableTarget(el) || busy()) return;
  if (waitingNative) {
    clearTimeout(waitingNative);
    waitingNative = null;
  }
  e.preventDefault();
  void pasteToBookshelf(e.clipboardData);
}
