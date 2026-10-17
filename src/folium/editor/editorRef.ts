// L'editor del foglio aperto, per comandi e pannelli che non stanno dentro lo Scriptorium.
import { create } from 'zustand';
import type { Editor } from '@tiptap/core';

export const useEditorRef = create<{ editor: Editor | null; tick: number }>(() => ({ editor: null, tick: 0 }));

export function setEditor(editor: Editor | null) {
  if (useEditorRef.getState().editor !== editor) useEditorRef.setState({ editor });
}

export function getEditor(): Editor | null {
  return useEditorRef.getState().editor;
}

/** Da chiamare quando cambia la selezione o il documento: i pulsanti attivi si aggiornano. */
export function bumpEditor() {
  useEditorRef.setState((s) => ({ tick: s.tick + 1 }));
}
