// Riferimento all'editor attivo, per comandi e pannelli che vivono fuori dal componente.
import type { Editor } from '@tiptap/core';
import { notifyCommandState } from '../commands/registry';

let current: Editor | null = null;
const listeners = new Set<(e: Editor | null) => void>();

export function setEditor(e: Editor | null) {
  current = e;
  // accesso per i test nel browser (solo sviluppo)
  if (import.meta.env.DEV) (window as unknown as { __editor?: Editor | null }).__editor = e;
  listeners.forEach((l) => l(e));
  notifyCommandState();
}

export function getEditor(): Editor | null {
  return current && !current.isDestroyed ? current : null;
}

export function onEditor(cb: (e: Editor | null) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Esegue una catena di comandi TipTap sull'editor attivo, se c'e'. */
export function withEditor(f: (e: Editor) => void) {
  const e = getEditor();
  if (e) f(e);
}
