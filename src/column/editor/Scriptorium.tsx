// Scriptorium di Column: l'editor del foglio. Carica il testo quando cambia il foglio, salva con un
// breve ritardo, conta le parole, accoglie immagini incollate o trascinate (in media/).
import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/core';
import type { PMNode } from 'logos/doc/types';
import { countDoc } from 'logos/doc/counts';
import { useColumn, mediaUrl } from '../store';
import { markdownToDoc, docToMarkdown } from '../doc';
import { editorExtensions } from './extensions';
import { setMediaResolver, setFootnoteEditor } from './nodes';
import { SlashMenu } from './slash';
import { openTextMenu } from './textMenu';
import { useCounts } from './counts';
import { setEditor, getEditor } from './editorRef';
import { promptDialog } from '../../components/confirm';
import { t } from '../../i18n';
import { loadComments } from '../comments/store';
import { PageHints, setPagesListener } from './pageHints';
import { CommentLayer } from '../comments/CommentLayer';
import { EXCERPT_MIME, BLOCK_MIME } from '../tabula/dnd';
import { dropBlockInText, excerptFromSelection } from '../tabula/bridge';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;

setMediaResolver(mediaUrl);
setPagesListener((n) => {
  if (useCounts.getState().pages !== n) useCounts.setState({ pages: n });
});
setFootnoteEditor((text, done) => void promptDialog(t('footnote.edit'), text).then(done));

/** Immagini dagli appunti o trascinate: nel foglio, poi come figure nel punto giusto. */
async function insertImages(editor: Editor, files: File[], pos?: number) {
  for (const f of files) {
    const data = new Uint8Array(await f.arrayBuffer());
    const src = useColumn.getState().addMedia(f.name || 'immagine.png', data);
    const at = pos ?? editor.state.selection.to;
    editor.chain().focus().insertContentAt(at, { type: 'figure', attrs: { src, caption: '' } }).run();
  }
}

export function Scriptorium() {
  const sheet = useColumn((s) => s.sheet);
  const loadTick = useColumn((s) => s.loadTick);
  const zoom = useColumn((s) => s.app.zoom);
  const font = sheet?.meta.font ?? 'serif';
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: editorExtensions([SlashMenu, PageHints]),
    content: markdownToDoc(useColumn.getState().sheet?.markdown ?? ''),
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'fx-prose', spellcheck: 'true' },
      handlePaste(_view, event) {
        const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/') || IMAGE_EXT.test(f.name));
        if (!files.length) return false;
        event.preventDefault();
        const ed = getEditor();
        if (ed) void insertImages(ed, files);
        return true;
      },
      handleDrop(view, event) {
        const dt = event.dataTransfer;
        if (!dt) return false;
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        // un blocco della Tabula rilasciato nel testo
        const block = dt.getData(BLOCK_MIME);
        const ed = getEditor();
        if (block && ed) {
          event.preventDefault();
          dropBlockInText(ed, block, at);
          return true;
        }
        const files = [...dt.files].filter((f) => f.type.startsWith('image/') || IMAGE_EXT.test(f.name));
        if (!files.length) return false;
        event.preventDefault();
        if (ed) void insertImages(ed, files, at);
        return true;
      },
      handleDOMEvents: {
        contextmenu(view, event) {
          const ed = getEditor();
          if (!ed) return false;
          event.preventDefault();
          // il clic destro fuori dalla selezione sposta il cursore li'
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
          const { from, to } = ed.state.selection;
          if (pos !== undefined && (pos < from || pos > to)) ed.commands.setTextSelection(pos);
          openTextMenu(ed, event);
          return true;
        },
        dragstart(_view, event) {
          // testo selezionato trascinato verso la Tabula: diventa un estratto
          const ed = getEditor();
          if (!ed || ed.state.selection.empty || !event.dataTransfer) return false;
          const ex = excerptFromSelection(ed);
          if (ex) event.dataTransfer.setData(EXCERPT_MIME, JSON.stringify(ex));
          return false;
        },
      },
    },
    onUpdate({ editor: ed }) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const doc = ed.getJSON() as PMNode;
        useColumn.getState().setMarkdown(docToMarkdown(doc));
        useCounts.getState().setDoc(countDoc(doc));
      }, 300);
      useColumn.setState({ lastEdit: Date.now() });
    },
    onSelectionUpdate({ editor: ed }) {
      useCounts.getState().setSelection(ed);
    },
  });
  useEffect(() => {
    setEditor(editor);
    return () => setEditor(null);
  });

  // foglio nuovo (o versione ripresa): contenuto e cronologia di annulla ripartono da capo
  useEffect(() => {
    if (!editor) return;
    const s = useColumn.getState().sheet;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const doc = markdownToDoc(s?.markdown ?? '');
    const state = EditorState.create({ doc: editor.schema.nodeFromJSON(doc), plugins: editor.state.plugins });
    editor.view.updateState(state);
    useCounts.getState().setDoc(countDoc(doc));
    loadComments(editor);
    if (!useColumn.getState().silentium) editor.commands.focus('end');
  }, [editor, loadTick]);

  // salvataggio immediato quando la finestra perde il fuoco
  useEffect(() => {
    const flush = () => {
      if (!editor || !saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      useColumn.getState().setMarkdown(docToMarkdown(editor.getJSON() as PMNode));
      void useColumn.getState().flush();
    };
    window.addEventListener('blur', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('blur', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [editor]);

  return (
    <div className={`fx-scriptorium fx-font--${font}`} style={{ '--zoom': zoom } as React.CSSProperties}>
      <div className="fx-scroll">
        <div className="fx-page">
          <EditorContent editor={editor} />
          {editor && <CommentLayer editor={editor} />}
        </div>
      </div>
    </div>
  );
}

/** Markdown attuale dell'editor (anche se il salvataggio ritardato non e' ancora partito). */
export function liveMarkdown(editor: Editor | null): string {
  return editor ? docToMarkdown(editor.getJSON() as PMNode) : (useColumn.getState().sheet?.markdown ?? '');
}
