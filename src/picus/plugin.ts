// Picus: sottolineature dei rilievi nell'editor. Compaiono solo dopo una domanda e solo nel tratto
// interrogato; seguono il testo mentre si scrive e un rilievo il cui testo cambia sparisce (anche
// quando si sceglie un'alternativa). Un clic su una sottolineatura riapre il suo pannello.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { Finding } from './analyze';

export interface Live {
  from: number;
  to: number;
  f: Finding;
}

interface PState {
  items: Live[];
  current: number;
  deco: DecorationSet;
}

type Meta = { items: Live[]; current: number } | { current: number } | { drop: (l: Live) => boolean };

export const picusKey = new PluginKey<PState>('picus');

function decorate(doc: PMNode, items: Live[], current: number): DecorationSet {
  return DecorationSet.create(
    doc,
    items.map((l, i) => Decoration.inline(l.from, l.to, { class: `picus-hit is-${l.f.kind}${i === current ? ' is-current' : ''}` })),
  );
}

/** Indice del rilievo corrente dopo un cambio: lo stesso se c'e' ancora, altrimenti quello che veniva dopo. */
function keepCurrent(cur: Live | undefined, list: Live[], fallback: number): number {
  if (!list.length) return -1;
  const i = cur ? list.findIndex((l) => l.f === cur.f) : -1;
  return i >= 0 ? i : Math.min(Math.max(0, fallback), list.length - 1);
}

/** Chi ascolta i cambi (lo store dell'interfaccia) e chi apre il pannello al clic. */
export const picusHooks: { change: (items: Live[], current: number) => void; click: (index: number) => void } = {
  change: () => {},
  click: () => {},
};

export const PicusMarks = Extension.create({
  name: 'picus',
  addProseMirrorPlugins() {
    return [
      new Plugin<PState>({
        key: picusKey,
        state: {
          init: () => ({ items: [], current: -1, deco: DecorationSet.empty }),
          apply(tr, prev, _old, state: EditorState): PState {
            const meta = tr.getMeta(picusKey) as Meta | undefined;
            let { items, current } = prev;
            if (tr.docChanged && items.length) {
              const cur = items[current];
              items = items
                .map((l) => ({ ...l, from: tr.mapping.map(l.from, 1), to: tr.mapping.map(l.to, -1) }))
                .filter((l) => l.to > l.from && state.doc.textBetween(l.from, l.to, ' ') === l.f.original);
              current = keepCurrent(cur, items, current);
            }
            if (meta && 'items' in meta) ({ items, current } = meta);
            else if (meta && 'drop' in meta) {
              const cur = items[current];
              items = items.filter((l) => !meta.drop(l));
              current = keepCurrent(cur, items, current);
            } else if (meta && 'current' in meta) current = meta.current;
            if (items === prev.items && current === prev.current) return tr.docChanged ? { ...prev, deco: prev.deco.map(tr.mapping, tr.doc) } : prev;
            return { items, current, deco: decorate(state.doc, items, current) };
          },
        },
        view: () => ({
          update(view, old) {
            const a = picusKey.getState(view.state)!;
            const b = picusKey.getState(old)!;
            if (a.items !== b.items || a.current !== b.current) picusHooks.change(a.items, a.current);
          },
        }),
        props: {
          decorations: (state) => picusKey.getState(state)?.deco ?? DecorationSet.empty,
          handleClick(view, pos) {
            const st = picusKey.getState(view.state);
            const i = st?.items.findIndex((l) => pos >= l.from && pos <= l.to) ?? -1;
            if (i < 0) return false;
            picusHooks.click(i);
            return false;
          },
        },
      }),
    ];
  },
});
