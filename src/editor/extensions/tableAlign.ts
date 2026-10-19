// Allineamento delle colonne delle tabelle (attributo `align` della tabella, come nel Markdown GFM):
// le celle di ogni colonna lo ricevono come stile, senza cambiare il documento.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const TableAlign = Extension.create({
  name: 'tableAlign',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tableAlign'),
        props: {
          decorations: (state) => {
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.isTextblock) return false;
              if (node.type.name !== 'table') return true;
              const align = (node.attrs.align as (string | null)[] | undefined) ?? [];
              if (!align.some(Boolean)) return false;
              node.forEach((row, rowOff) => {
                const rowPos = pos + 1 + rowOff;
                row.forEach((cell, cellOff, i) => {
                  const a = align[i];
                  if (a) decos.push(Decoration.node(rowPos + 1 + cellOff, rowPos + 1 + cellOff + cell.nodeSize, { style: `text-align: ${a}` }));
                });
              });
              return false;
            });
            return decos.length ? DecorationSet.create(state.doc, decos) : DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
