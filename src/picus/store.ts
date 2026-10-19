// Picus: stato dell'interfaccia (rilievi, pannelli, fumetto). Nessuna impostazione a priori: si
// seleziona, si chiede, Picus propone. Le posizioni dei rilievi le tiene il plugin dell'editor, che le
// segue mentre si scrive; qui arriva una copia a ogni cambio.
import { create } from 'zustand';
import { useWorkspace } from '../state/workspace';
import { getEditor } from '../state/editorRef';
import { picusHooks, type Live } from './plugin';
import type { Ranked, Tone } from './rank';

export type Bubble = { kind: 'result'; n: number } | { kind: 'quiet' } | { kind: 'done' } | { kind: 'nopack'; lang: string } | { kind: 'error'; text: string };

/** Una modifica nel documento: [from, to) diventa `text`. */
export interface DocEdit {
  from: number;
  to: number;
  text: string;
}

/** Alternativa di un pezzo della riscrittura, gia' nelle posizioni del documento. */
export interface PieceOption {
  text: string;
  base: string;
  register: number;
  flags: number;
  note?: string;
  edit: DocEdit;
}

/** Il pannello delle riscritture: tre versioni del tratto e i pezzi uno per uno. */
export interface RewriteView {
  /** il tratto riscritto nel documento (per ancorare il pannello e controllare che non sia cambiato) */
  from: number;
  to: number;
  original: string;
  versions: { tone: Tone; text: string; changes: { start: number; end: number }[]; edits: DocEdit[] }[];
  pieces: { original: string; label: string; sections: Ranked<PieceOption>[] }[];
}

interface S {
  items: Live[];
  current: number;
  /** pannello del rilievo corrente aperto */
  open: boolean;
  /** cresce quando un pannello deve prendere il focus (domanda da tastiera) */
  focus: number;
  bubble: Bubble | null;
  rewrite: RewriteView | null;
}

export const usePicus = create<S>(() => ({ items: [], current: -1, open: false, focus: 0, bubble: null, rewrite: null }));

picusHooks.change = (items, current) => {
  const st = usePicus.getState();
  // il fumetto conta i rilievi rimasti; finiti tutti (sostituiti o spariti) dice "fatto" e il pannello si chiude
  let bubble = st.bubble;
  if (bubble?.kind === 'result') bubble = items.length ? { kind: 'result', n: items.length } : { kind: 'done' };
  // finiti i rilievi mentre si lavorava nel pannello: il focus torna al testo
  if (st.open && !items.length && document.activeElement?.closest('.picus-panel')) getEditor()?.commands.focus();
  usePicus.setState({ items, current, open: st.open && items.length > 0, bubble });
};

// un dialogo che si apre o un'altra pergamena chiudono i pannelli
useWorkspace.subscribe((st, prev) => {
  const dialog = st.dialog && st.dialog !== prev.dialog;
  if (dialog || st.activeDoc !== prev.activeDoc) usePicus.setState({ open: false, rewrite: null, ...(dialog ? {} : { bubble: null }) });
});
