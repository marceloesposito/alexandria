// Ancore dei commenti nel testo: seguono le modifiche, sottolineano il testo commentato e segnano con
// un punto i commenti senza testo (ancora a larghezza zero, nel punto del cursore).
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { FlatText } from 'logos/comments/model';

export interface LiveAnchor {
  from: number;
  to: number;
  /** 'text' sottolinea un tratto; 'line' e' un punto (from = to) */
  kind: 'line' | 'text';
}

interface PState {
  anchors: Map<string, LiveAnchor>;
  active: string | null;
  deco: DecorationSet;
}

export const anchorsKey = new PluginKey<PState>('foliumComments');

type Meta = { set?: Map<string, LiveAnchor>; active?: string | null };

function build(doc: PMNode, anchors: Map<string, LiveAnchor>, active: string | null): DecorationSet {
  const decos: Decoration[] = [];
  for (const [id, a] of anchors) {
    const cls = `fx-comment ${id === active ? 'is-active' : ''}`;
    if (a.kind === 'text' && a.to > a.from) decos.push(Decoration.inline(a.from, a.to, { class: cls, 'data-comment': id }));
    else
      decos.push(
        Decoration.widget(
          a.from,
          () => {
            const el = document.createElement('span');
            el.className = `fx-comment-dot ${id === active ? 'is-active' : ''}`;
            el.dataset.comment = id;
            el.contentEditable = 'false';
            return el;
          },
          { side: -1, key: `${id}:${id === active}` },
        ),
      );
  }
  return DecorationSet.create(doc, decos);
}

/** Avvisa quando un'ancora sparisce (testo cancellato) o si sposta. */
let onChange: ((a: Map<string, LiveAnchor>, orphaned: string[]) => void) | null = null;
export function setAnchorsListener(f: typeof onChange) {
  onChange = f;
}

export const CommentAnchors = Extension.create({
  name: 'commentAnchors',
  addProseMirrorPlugins() {
    return [
      new Plugin<PState>({
        key: anchorsKey,
        state: {
          init: () => ({ anchors: new Map(), active: null, deco: DecorationSet.empty }),
          apply(tr, prev, _old, state) {
            const meta = tr.getMeta(anchorsKey) as Meta | undefined;
            let anchors = prev.anchors;
            let active = prev.active;
            const orphaned: string[] = [];
            if (meta?.set) anchors = new Map(meta.set);
            if (meta && 'active' in meta) active = meta.active ?? null;
            if (tr.docChanged && !meta?.set) {
              const next = new Map<string, LiveAnchor>();
              for (const [id, a] of anchors) {
                if (a.kind === 'line') {
                  const p = tr.mapping.mapResult(a.from, -1);
                  if (p.deletedAcross && p.deleted) {
                    orphaned.push(id);
                    continue;
                  }
                  next.set(id, { ...a, from: p.pos, to: p.pos });
                  continue;
                }
                const from = tr.mapping.mapResult(a.from, 1);
                const to = tr.mapping.mapResult(a.to, -1);
                if ((from.deleted && to.deleted) || to.pos <= from.pos) {
                  orphaned.push(id);
                  continue;
                }
                next.set(id, { ...a, from: from.pos, to: to.pos });
              }
              anchors = next;
            }
            if (anchors === prev.anchors && active === prev.active) {
              return tr.docChanged ? { ...prev, deco: prev.deco.map(tr.mapping, tr.doc) } : prev;
            }
            if (tr.docChanged && onChange) {
              const cb = onChange;
              const a = anchors;
              queueMicrotask(() => cb(a, orphaned));
            }
            return { anchors, active, deco: build(state.doc, anchors, active) };
          },
        },
        props: {
          decorations: (state) => anchorsKey.getState(state)?.deco ?? DecorationSet.empty,
        },
      }),
    ];
  },
});

/** Testo piatto del documento: blocchi separati da \n, nodi atomici come U+FFFC. */
export function flatText(doc: PMNode): FlatText {
  let text = '';
  const map: number[] = [];
  let first = true;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (!first) {
      text += '\n';
      map.push(pos);
    }
    first = false;
    node.forEach((child, offset) => {
      const p = pos + 1 + offset;
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) map.push(p + i);
        text += child.text;
      } else {
        map.push(p);
        text += '￼';
      }
    });
    // posizione subito dopo l'ultimo carattere del blocco (punto a fine paragrafo)
    return false;
  });
  return { text, map };
}
