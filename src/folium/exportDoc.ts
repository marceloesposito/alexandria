// Esporta: .docx con le Marginalia come commenti di Word (logos/export), PDF dalla stampa di sistema
// della webview (stile @media print). Niente Typst in Folium.
import type { Editor } from '@tiptap/core';
import { parseMarkdown } from 'logos/doc/parse';
import { embedsToLinks, type CitationItem, type PMNode } from 'logos/doc/types';
import { defaultDocSettings } from 'logos/layout/model';
import { injectCommentMarks, type ExportComment } from 'logos/export/comments';
import type { ExportContext } from 'logos/export/context';
import { toDocx } from 'logos/export/docx';
import { platform } from '../platform';
import { useFolium, sheetTitle } from './store';
import { getEditor } from './editor/editorRef';
import { anchorsKey } from './comments/anchors';
import { liveMarkdown } from './editor/Scriptorium';
import { FILES, fileStem } from './format';
import { getLang, t } from '../i18n';

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };

/** Commenti aperti con il loro tratto di testo attuale (ancore vive dell'editor). */
function liveComments(editor: Editor | null): ExportComment[] {
  const s = useFolium.getState().sheet;
  if (!s || !editor) return [];
  const anchors = anchorsKey.getState(editor.state)?.anchors;
  const out: ExportComment[] = [];
  for (const c of s.comments.comments) {
    const a = anchors?.get(c.id);
    if (!a || c.status !== 'open') continue;
    // un commento su un punto prende la parola che segue, Word non ha commenti vuoti
    const to = a.to > a.from ? a.to : Math.min(editor.state.doc.content.size - 1, a.from + 1);
    out.push({
      id: out.length + 1,
      from: a.from,
      to,
      author: c.author,
      date: c.created,
      text: c.body,
      replies: c.replies.map((r) => ({ author: r.author, date: r.created, text: r.body })),
    });
  }
  return out;
}

export function exportContext(title: string, comments: ExportComment[]): ExportContext {
  const s = useFolium.getState().sheet!;
  const lang = getLang() === 'en' ? 'en' : 'it';
  const settings = defaultDocSettings(lang);
  settings.title = title;
  settings.author = useFolium.getState().app.author;
  if (s.meta.font === 'sans') settings.layout.font = 'sans';
  if (s.meta.font === 'mono') settings.layout.fontFamily = 'jetbrains';
  return {
    settings,
    title,
    lang,
    // Folium non formatta le citazioni: restano le chiavi
    cite: (items: CitationItem[]) => ({ text: `(${items.map((i) => i.key + (i.locator ? `, ${i.locator}` : '')).join('; ')})`, note: false }),
    image: (src) => {
      const name = src.replace(/^\.\//, '').slice(FILES.mediaDir.length);
      const data = src.replace(/^\.\//, '').startsWith(FILES.mediaDir) ? s.media[name] : undefined;
      if (!data) return null;
      const ext = name.split('.').pop()?.toLowerCase() ?? 'png';
      return { path: `img/${name}`, data, mime: MIME[ext] ?? 'image/png' };
    },
    math: () => null,
    comments,
  };
}

export async function buildDocx(): Promise<Uint8Array | null> {
  const s = useFolium.getState().sheet;
  if (!s) return null;
  const editor = getEditor();
  const comments = liveComments(editor);
  const parsed = parseMarkdown(liveMarkdown(editor));
  const doc: PMNode = embedsToLinks(comments.length ? injectCommentMarks(parsed, comments) : parsed);
  return toDocx(doc, exportContext(sheetTitle(s), comments));
}

export async function exportDocx() {
  const st = useFolium.getState();
  if (!st.sheet) return;
  const path = await platform.saveDialog(`${fileStem(sheetTitle(st.sheet))}.docx`, ['docx']);
  if (!path) return;
  try {
    const data = await buildDocx();
    if (!data) return;
    await platform.writeBytes(path, data);
    st.toast(t('export.done', { name: path.slice(path.lastIndexOf('/') + 1) }), 'ok');
  } catch (e) {
    st.toast(t('export.error', { error: e instanceof Error ? e.message : String(e) }), 'error');
  }
}

/** PDF: la finestra di stampa del sistema (Salva come PDF), con il solo testo impaginato. */
export async function exportPdf() {
  const st = useFolium.getState();
  if (!st.sheet) return;
  await st.flush();
  const title = document.title;
  document.title = fileStem(sheetTitle(st.sheet));
  document.documentElement.classList.add('is-printing');
  try {
    // nell'app la stampa la apre il guscio (WKWebView non risponde a window.print)
    if (platform.kind === 'tauri') await (await import('@tauri-apps/api/core')).invoke('print_page');
    else window.print();
  } finally {
    document.documentElement.classList.remove('is-printing');
    document.title = title;
  }
}
