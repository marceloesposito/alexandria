// Conteggi del foglio (parole, caratteri, tempo di lettura) e della selezione.
import { create } from 'zustand';
import type { Editor } from '@tiptap/core';
import { countText, type Counts } from 'logos/doc/counts';
import { bumpEditor } from './editorRef';

interface CountsState {
  doc: Counts | null;
  selection: { words: number; chars: number } | null;
  setDoc(c: Counts): void;
  setSelection(editor: Editor): void;
}

export const useCounts = create<CountsState>((set, get) => ({
  doc: null,
  selection: null,
  setDoc(c) {
    set({ doc: c });
  },
  setSelection(editor) {
    bumpEditor();
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      if (get().selection) set({ selection: null });
      return;
    }
    const c = countText(editor.state.doc.textBetween(from, to, '\n', ' '));
    set({ selection: { words: c.words, chars: c.chars } });
  },
}));

export function wordsNow(): number {
  return useCounts.getState().doc?.words ?? 0;
}
