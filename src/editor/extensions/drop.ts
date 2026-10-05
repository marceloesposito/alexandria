// Trascinamenti sull'editor: pin e fonti dalla colonna sinistra diventano citazioni,
// i file (immagini) diventano figure copiate nel vault.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export const CITE_MIME = 'application/x-alexandria-cite';
export const FIGURE_MIME = 'application/x-alexandria-figure';
export const LINK_MIME = 'application/x-alexandria-link';
/** risorsa che diventa una scheda embed (snippet, file) */
export const EMBED_MIME = 'application/x-alexandria-embed';

export interface CiteDragData {
  key: string;
  locator?: string;
  pinId?: string;
}

type FilesHandler = (files: File[], pos: number) => void | Promise<void>;
let filesHandler: FilesHandler | null = null;
type LinksHandler = (dt: DataTransfer, pos: number) => boolean;
let linksHandler: LinksHandler | null = null;

/** L'app registra qui i link trascinati da altre finestre (diventano schede embed). */
export function setEditorLinksHandler(h: LinksHandler | null) {
  linksHandler = h;
}

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
            // immagine delle risorse: diventa una figura
            const fig = dt.getData(FIGURE_MIME);
            if (fig) {
              const pos = dropPos(view, ev);
              if (pos === null) return true;
              const { src, caption } = JSON.parse(fig) as { src: string; caption: string };
              const $p = view.state.doc.resolve(pos);
              const at = $p.depth > 0 ? $p.after(1) : pos;
              view.dispatch(view.state.tr.insert(at, view.state.schema.nodes.figure.create({ src, caption })).scrollIntoView());
              return true;
            }
            // snippet e altre risorse: scheda embed
            const emb = dt.getData(EMBED_MIME);
            if (emb) {
              const pos = dropPos(view, ev);
              if (pos === null) return true;
              const $p = view.state.doc.resolve(pos);
              const at = $p.depth > 0 ? $p.after(1) : pos;
              view.dispatch(view.state.tr.insert(at, view.state.schema.nodes.embed.create(JSON.parse(emb))).scrollIntoView());
              return true;
            }
            // pagina web non citata come fonte: diventa un collegamento
            const link = dt.getData(LINK_MIME);
            if (link) {
              const pos = dropPos(view, ev);
              if (pos === null) return true;
              const { href, text } = JSON.parse(link) as { href: string; text: string };
              const mark = view.state.schema.marks.link.create({ href });
              view.dispatch(view.state.tr.insert(pos, view.state.schema.text(text, [mark])).scrollIntoView());
              return true;
            }
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
            // link da un'altra finestra (non un trascinamento dentro l'editor)
            if (!files.length && !view.dragging && linksHandler) {
              const pos = dropPos(view, ev);
              if (pos !== null && linksHandler(dt, pos)) {
                ev.preventDefault();
                return true;
              }
            }
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
