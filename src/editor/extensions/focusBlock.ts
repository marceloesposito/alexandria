// Modalita' focus: il blocco di primo livello dove sta il cursore riceve la classe "has-focus"
// (gli altri restano attenuati dal CSS). Prima nessuno la metteva e il testo era tutto grigio.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

/** Inizio e fine del blocco di primo livello che contiene la posizione `pos`. */
export function topLevelBlockAt(doc: PMNode, pos: number): { from: number; to: number } | null {
  const p = Math.max(0, Math.min(pos, doc.content.size));
  const $p = doc.resolve(p);
  if ($p.depth === 0) {
    const after = $p.nodeAfter;
    return after ? { from: p, to: p + after.nodeSize } : null;
  }
  return { from: $p.before(1), to: $p.after(1) };
}

export const FocusBlock = Extension.create({
  name: 'focusBlock',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('focusBlock'),
        props: {
          decorations: (state) => {
            const b = topLevelBlockAt(state.doc, state.selection.head);
            return b ? DecorationSet.create(state.doc, [Decoration.node(b.from, b.to, { class: 'has-focus' })]) : DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
