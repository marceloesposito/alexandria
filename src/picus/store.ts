// Picus: stato dell'interfaccia (rilievi, pannello, fumetto) e impostazioni della pergamena (tono e
// rilievi ignorati, in .alexandria/picus/<pergamena>.json). Le posizioni dei rilievi le tiene il
// plugin dell'editor, che le segue mentre si scrive; qui arriva una copia a ogni cambio.
import { create } from 'zustand';
import { useWorkspace } from '../state/workspace';
import { getEditor } from '../state/editorRef';
import { readJson, writeJson } from '../vault/vault';
import { abs, picusFile } from '../vault/paths';
import { picusHooks, type Live } from './plugin';
import type { Tone } from './rank';

export type Bubble = { kind: 'result'; n: number } | { kind: 'quiet' } | { kind: 'done' } | { kind: 'nopack'; lang: string } | { kind: 'error'; text: string };

interface DocFile {
  tone: Tone | null;
  ignored: string[];
}

interface S extends DocFile {
  items: Live[];
  current: number;
  /** pannello del rilievo corrente aperto */
  open: boolean;
  /** cresce quando il pannello deve prendere il focus (domanda da tastiera) */
  focus: number;
  bubble: Bubble | null;
  rel: string | null;
}

export const usePicus = create<S>(() => ({ items: [], current: -1, open: false, focus: 0, bubble: null, rel: null, tone: null, ignored: [] }));

picusHooks.change = (items, current) => {
  const st = usePicus.getState();
  // il fumetto conta i rilievi rimasti; finiti tutti (sostituiti o spariti) dice "fatto" e il pannello si chiude
  let bubble = st.bubble;
  if (bubble?.kind === 'result') bubble = items.length ? { kind: 'result', n: items.length } : { kind: 'done' };
  // finiti i rilievi mentre si lavorava nel pannello: il focus torna al testo
  if (st.open && !items.length && document.activeElement?.closest('.picus-panel')) getEditor()?.commands.focus();
  usePicus.setState({ items, current, open: st.open && items.length > 0, bubble });
};

function normalize(raw: unknown): DocFile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<DocFile>;
  const tone = r.tone === 'formal' || r.tone === 'neutral' || r.tone === 'casual' ? r.tone : null;
  return { tone, ignored: Array.isArray(r.ignored) ? r.ignored.filter((k): k is string => typeof k === 'string') : [] };
}

export function saveDocFile(patch: Partial<DocFile>) {
  usePicus.setState(patch);
  const { rel, tone, ignored } = usePicus.getState();
  const root = useWorkspace.getState().vaultRoot;
  if (root && rel) void writeJson(abs(root, picusFile(rel)), { tone, ignored });
}

// un dialogo che si apre chiude il pannello
useWorkspace.subscribe((st, prev) => {
  if (st.dialog && st.dialog !== prev.dialog && usePicus.getState().open) usePicus.setState({ open: false });
});

// segue il documento attivo
useWorkspace.subscribe((st, prev) => {
  if (st.activeDoc === prev.activeDoc && st.vaultRoot === prev.vaultRoot) return;
  usePicus.setState({ rel: st.activeDoc, open: false, bubble: null, tone: null, ignored: [] });
  if (!st.vaultRoot || !st.activeDoc) return;
  const rel = st.activeDoc;
  void readJson<unknown>(abs(st.vaultRoot, picusFile(rel)), null).then((raw) => {
    if (usePicus.getState().rel === rel) usePicus.setState(normalize(raw));
  });
});
