// Trascinamenti sull'editor: pin e fonti dalla colonna sinistra diventano citazioni,
// i file (immagini) diventano figure copiate nel vault.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export const CITE_MIME = 'application/x-alexandria-cite';

export interface CiteDragData {
  key: string;
  locator?: string;
  pinId?: string;
}

type FilesHandler = (files: File[], pos: number) => void | Promise<void>;
let filesHandler: FilesHandler | null = null;

/** L'app registra qui l'import dei file trascinati nel testo (immagini -> figure). */
export function setEditorFilesHandler(h: FilesHandler | null) {
  filesHandler = h;
}

function dropPos(view: EditorView, e: DragEvent): number | null {
  const p = view.posAtCoords({ left: e.clientX, top: e.clientY });
  return p ? p.pos : null;
}

export const DropHandler = Extension.create({
  name: 'alexandriaDrop',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('alexandriaDrop'),
        props: {
          handleDOMEvents: {
            dragover(_view, e) {
              if (e.dataTransfer?.types.includes(CITE_MIME)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }
              return false;
            },
          },
          handleDrop(view, e) {
            const ev = e as DragEvent;
            const dt = ev.dataTransfer;
            if (!dt) return false;
            const raw = dt.getData(CITE_MIME);
            if (raw) {
              const pos = dropPos(view, ev);
              if (pos === null) return true;
              let data: CiteDragData;
              try {
                data = JSON.parse(raw);
              } catch {
                return true;
              }
              const node = view.state.schema.nodes.citation.create({
                items: [{ key: data.key, ...(data.locator ? { locator: data.locator } : {}) }],
              });
              // uno spazio prima se la citazione si attacca a una parola
              const $pos = view.state.doc.resolve(pos);
              const before = $pos.parent.textBetween(Math.max(0, $pos.parentOffset - 1), $pos.parentOffset, '', '');
              let tr = view.state.tr;
              if (before && !/\s/.test(before)) tr = tr.insertText(' ', pos);
              tr = tr.insert(tr.mapping.map(pos), node);
              view.dispatch(tr.scrollIntoView());
              view.focus();
              return true;
            }
            const files = Array.from(dt.files ?? []);
            if (files.length && filesHandler) {
              const pos = dropPos(view, ev);
              if (pos === null) return false;
              ev.preventDefault();
              void filesHandler(files, pos);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});
