// Trova e sostituisci nell'editor: plugin con decorazioni sulle occorrenze.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/core';

export interface SearchOpts {
  query: string;
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}

export interface Match {
  from: number;
  to: number;
}

interface PState {
  opts: SearchOpts;
  matches: Match[];
  current: number;
  deco: DecorationSet;
}

export const searchKey = new PluginKey<PState>('alexandriaSearch');

export function buildRegex(o: SearchOpts): RegExp | null {
  if (!o.query) return null;
  let src = o.regex ? o.query : o.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (o.wholeWord) src = `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`;
  try {
    return new RegExp(src, `gu${o.caseSensitive ? '' : 'i'}`);
  } catch {
    return null;
  }
}

/** Occorrenze dentro i blocchi di testo (non attraversano i confini dei paragrafi). */
export function findMatches(doc: PMNode, o: SearchOpts): Match[] {
  const re = buildRegex(o);
  if (!re) return [];
  const out: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // testo del blocco con la mappa offset -> posizione del documento
    let text = '';
    const map: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) {
          map.push(pos + 1 + offset + i);
        }
        text += child.text;
      } else {
        map.push(pos + 1 + offset);
        text += '￼';
      }
    });
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const from = map[m.index];
      const to = map[m.index + m[0].length - 1] + 1;
      out.push({ from, to });
    }
    return false;
  });
  return out;
}

function decorate(doc: PMNode, matches: Match[], current: number): DecorationSet {
  return DecorationSet.create(
    doc,
    matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === current ? 'search-hit is-current' : 'search-hit' })),
  );
}

const EMPTY: SearchOpts = { query: '', regex: false, caseSensitive: false, wholeWord: false };

export const SearchHighlight = Extension.create({
  name: 'alexandriaSearch',
  addProseMirrorPlugins() {
    return [
      new Plugin<PState>({
        key: searchKey,
        state: {
          init: () => ({ opts: EMPTY, matches: [], current: -1, deco: DecorationSet.empty }),
          apply(tr: Transaction, prev: PState, _old: EditorState, state: EditorState): PState {
            const meta = tr.getMeta(searchKey) as Partial<PState> | undefined;
            if (meta || tr.docChanged) {
              const opts = meta?.opts ?? prev.opts;
              const matches = findMatches(state.doc, opts);
              let current = meta?.current ?? prev.current;
              if (current >= matches.length) current = matches.length - 1;
              if (current < 0 && matches.length) current = 0;
              return { opts, matches, current, deco: decorate(state.doc, matches, current) };
            }
            return prev;
          },
        },
        props: {
          decorations(state) {
            return searchKey.getState(state)?.deco ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export function searchState(editor: Editor): PState | undefined {
  return searchKey.getState(editor.state);
}

export function setSearch(editor: Editor, opts: SearchOpts) {
  // la prima occorrenza dopo il cursore
  const matches = findMatches(editor.state.doc, opts);
  const from = editor.state.selection.from;
  const idx = Math.max(0, matches.findIndex((m) => m.from >= from));
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, { opts, current: matches.length ? idx : -1 }));
}

export function clearSearch(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, { opts: EMPTY, current: -1 }));
}

export function gotoMatch(editor: Editor, delta: number) {
  const st = searchState(editor);
  if (!st || !st.matches.length) return;
  const current = (st.current + delta + st.matches.length) % st.matches.length;
  const m = st.matches[current];
  const tr = editor.state.tr.setMeta(searchKey, { current }).setSelection(TextSelection.create(editor.state.doc, m.from, m.to));
  editor.view.dispatch(tr.scrollIntoView());
}

/** Sostituzione: con regex sono ammessi i gruppi $1, $2 ... */
export function replacement(o: SearchOpts, matched: string, replace: string): string {
  if (!o.regex) return replace;
  const re = buildRegex(o);
  if (!re) return replace;
  re.lastIndex = 0;
  return matched.replace(new RegExp(re.source, re.flags.replace('g', '')), replace);
}

export function replaceCurrent(editor: Editor, replace: string) {
  const st = searchState(editor);
  if (!st || st.current < 0) return;
  const m = st.matches[st.current];
  const text = replacement(st.opts, editor.state.doc.textBetween(m.from, m.to), replace);
  const tr = editor.state.tr.insertText(text, m.from, m.to);
  editor.view.dispatch(tr);
  gotoMatch(editor, 0);
}

export function replaceAll(editor: Editor, replace: string): number {
  const st = searchState(editor);
  if (!st || !st.matches.length) return 0;
  let tr = editor.state.tr;
  // dall'ultima alla prima, cosi' le posizioni restano valide
  for (const m of [...st.matches].reverse()) {
    const text = replacement(st.opts, editor.state.doc.textBetween(m.from, m.to), replace);
    tr = tr.insertText(text, m.from, m.to);
  }
  editor.view.dispatch(tr);
  return st.matches.length;
}
