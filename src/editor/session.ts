// Sessione del documento aperto: caricamento, salvataggio automatico, conteggi, modalita' sorgente.
import { create } from 'zustand';
import type { Editor } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { parseMarkdown } from '../doc/parse';
import { serializeMarkdown } from '../doc/serialize';
import { countDoc, countText, type Counts } from '../doc/counts';
import type { PMNode } from '../doc/types';
import { readDocument, writeDocument } from '../vault/vault';
import { useWorkspace } from '../state/workspace';
import { notifyCommandState } from '../commands/registry';

interface DocState {
  rel: string | null;
  counts: Counts | null;
  selection: { chars: number; words: number } | null;
  sourceMode: boolean;
  sourceText: string;
  /** pagine reali dell'ultima anteprima Typst (null = non ancora impaginato) */
  realPages: number | null;
  setSource(on: boolean): void;
  setSourceText(s: string): void;
}

export const useDoc = create<DocState>((set) => ({
  rel: null,
  counts: null,
  selection: null,
  sourceMode: false,
  sourceText: '',
  realPages: null,
  setSource(on) {
    set({ sourceMode: on });
  },
  setSourceText(s) {
    set({ sourceText: s });
  },
}));

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let countTimer: ReturnType<typeof setTimeout> | null = null;
let pending: { root: string; rel: string; md: string } | null = null;
let lastSaved = new Map<string, string>();
const afterSaveHooks = new Set<(rel: string) => void>();

export function onAfterSave(h: (rel: string) => void): () => void {
  afterSaveHooks.add(h);
  return () => afterSaveHooks.delete(h);
}

/** Markdown corrente del documento aperto (dall'editor o dalla vista sorgente). */
export function currentMarkdown(editor: Editor | null): string {
  const d = useDoc.getState();
  if (d.sourceMode) return d.sourceText;
  return editor ? serializeMarkdown(editor.getJSON() as PMNode) : '';
}

export async function loadDocument(editor: Editor, root: string, rel: string): Promise<void> {
  await flushSave();
  const md = await readDocument(root, rel);
  lastSaved.set(`${root}|${rel}`, md);
  const doc = parseMarkdown(md);
  // stato nuovo: la cronologia di annulla non deve tornare al documento precedente
  const state = EditorState.create({
    doc: editor.schema.nodeFromJSON(doc),
    plugins: editor.state.plugins,
  });
  editor.view.updateState(state);
  useDoc.setState({ rel, counts: countDoc(doc), selection: null, realPages: null, sourceText: md });
  useWorkspace.getState().setSaveState('saved');
  notifyCommandState();
}

export function scheduleSave(editor: Editor) {
  const ws = useWorkspace.getState();
  const rel = useDoc.getState().rel;
  if (!ws.vaultRoot || !rel) return;
  pending = { root: ws.vaultRoot, rel, md: '' };
  ws.setSaveState('dirty');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (pending) pending.md = currentMarkdown(editor);
    void flushSave();
  }, 700);
  if (countTimer) clearTimeout(countTimer);
  countTimer = setTimeout(() => {
    if (!useDoc.getState().sourceMode) useDoc.setState({ counts: countDoc(editor.getJSON() as PMNode) });
  }, 250);
}

/** Da chiamare prima di cambiare documento, vista o alla chiusura. */
export async function flushSave(editor?: Editor | null): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const p = pending;
  if (!p) return;
  if (!p.md && editor) p.md = currentMarkdown(editor);
  pending = null;
  const key = `${p.root}|${p.rel}`;
  if (lastSaved.get(key) === p.md) {
    useWorkspace.getState().setSaveState('saved');
    return;
  }
  try {
    useWorkspace.getState().setSaveState('saving');
    await writeDocument(p.root, p.rel, p.md);
    lastSaved.set(key, p.md);
    useWorkspace.getState().setSaveState('saved');
    afterSaveHooks.forEach((h) => h(p.rel));
  } catch (e) {
    useWorkspace.getState().setSaveState('error');
    useWorkspace.getState().toast(String(e), 'error');
  }
}

export function updateSelectionCounts(editor: Editor) {
  const { from, to, empty } = editor.state.selection;
  if (empty) {
    if (useDoc.getState().selection) useDoc.setState({ selection: null });
    return;
  }
  const text = editor.state.doc.textBetween(from, to, '\n', ' ');
  const c = countText(text);
  useDoc.setState({ selection: { chars: c.chars, words: c.words } });
}

/** Passa dalla vista formattata al sorgente Markdown e viceversa. */
export function toggleSource(editor: Editor | null) {
  const d = useDoc.getState();
  if (!editor) return;
  if (!d.sourceMode) {
    useDoc.setState({ sourceMode: true, sourceText: serializeMarkdown(editor.getJSON() as PMNode) });
  } else {
    const doc = parseMarkdown(d.sourceText);
    editor.commands.setContent(doc, { emitUpdate: true });
    useDoc.setState({ sourceMode: false, counts: countDoc(doc) });
  }
  notifyCommandState();
}

/** Il sorgente e' cambiato nella vista Markdown: salva e aggiorna i conteggi. */
export function sourceChanged(text: string) {
  useDoc.setState({ sourceText: text });
  const ws = useWorkspace.getState();
  const rel = useDoc.getState().rel;
  if (!ws.vaultRoot || !rel) return;
  pending = { root: ws.vaultRoot, rel, md: text };
  ws.setSaveState('dirty');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushSave(), 700);
  if (countTimer) clearTimeout(countTimer);
  countTimer = setTimeout(() => useDoc.setState({ counts: countDoc(parseMarkdown(text)) }), 300);
}

export function resetSavedCache() {
  lastSaved = new Map();
}

/**
 * Il file e' cambiato fuori dall'app (altro editor, sincronizzazione)? Al ritorno della finestra
 * in primo piano lo si rilegge: se non ci sono modifiche in sospeso, si ricarica il documento.
 */
export async function checkExternalChange(): Promise<boolean> {
  const ws = useWorkspace.getState();
  const rel = useDoc.getState().rel;
  if (!ws.vaultRoot || !rel || pending) return false;
  const key = `${ws.vaultRoot}|${rel}`;
  try {
    const md = await readDocument(ws.vaultRoot, rel);
    if (lastSaved.has(key) && lastSaved.get(key) !== md) {
      ws.bumpReload();
      return true;
    }
  } catch {
    /* file sparito: lo gestisce l'elenco dei documenti */
  }
  await ws.refreshDocs();
  return false;
}
