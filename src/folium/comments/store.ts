// Marginalia del foglio: i commenti stanno nel foglio (marginalia.json), le ancore vive nel plugin
// dell'editor. Qui si caricano, si creano, si risponde, si risolvono e si eliminano.
import { create } from 'zustand';
import type { Editor } from '@tiptap/core';
import { makeAnchor, newCommentId, reanchor, statusFields, type Comment } from 'logos/comments/model';
import { useFolium } from '../store';
import { anchorsKey, flatText, setAnchorsListener, type LiveAnchor } from './anchors';
import { getEditor } from '../editor/editorRef';
import { t } from '../../i18n';

interface UiState {
  /** commento aperto nella nuvoletta */
  open: string | null;
  /** nuovo commento in scrittura: posizione dell'ancora */
  draft: { from: number; to: number; kind: 'line' | 'text' } | null;
}

export const useCommentUi = create<UiState>(() => ({ open: null, draft: null }));

function comments(): Comment[] {
  return useFolium.getState().sheet?.comments.comments ?? [];
}

function save(list: Comment[]) {
  useFolium.getState().setComments({ version: 1, comments: list });
}

function setAnchors(editor: Editor, anchors: Map<string, LiveAnchor>) {
  editor.view.dispatch(editor.state.tr.setMeta(anchorsKey, { set: anchors }).setMeta('addToHistory', false));
}

export function setActive(editor: Editor | null, id: string | null) {
  if (!editor) return;
  editor.view.dispatch(editor.state.tr.setMeta(anchorsKey, { active: id }).setMeta('addToHistory', false));
}

/** Ancore vive dei commenti del foglio appena caricato (ritrovate dal testo citato se serve). */
export function loadComments(editor: Editor) {
  const flat = flatText(editor.state.doc);
  const anchors = new Map<string, LiveAnchor>();
  const size = editor.state.doc.content.size;
  for (const c of comments()) {
    if (!c.anchor || c.status !== 'open') continue;
    if (c.anchor.kind === 'line') {
      const pos = Math.min(Math.max(1, c.anchor.from), size - 1);
      anchors.set(c.id, { from: pos, to: pos, kind: 'line' });
      continue;
    }
    const hit = reanchor(flat, c.anchor);
    if (hit && hit.to > hit.from) anchors.set(c.id, { from: hit.from, to: hit.to, kind: 'text' });
  }
  setAnchors(editor, anchors);
  useCommentUi.setState({ open: null, draft: null });
}

// le ancore si spostano scrivendo: le posizioni salvate seguono, i commenti persi diventano orfani
setAnchorsListener((anchors, orphaned) => {
  const editor = getEditor();
  if (!editor) return;
  const flat = flatText(editor.state.doc);
  let changed = false;
  const next = comments().map((c) => {
    if (orphaned.includes(c.id) && c.anchor) {
      changed = true;
      return { ...c, anchor: null };
    }
    const a = anchors.get(c.id);
    if (!a || !c.anchor || (c.anchor.from === a.from && c.anchor.to === a.to)) return c;
    changed = true;
    return { ...c, anchor: makeAnchor(flat, a.from, a.to, a.kind) };
  });
  if (changed) save(next);
});

/** Apre la nuvoletta per un commento nuovo: sulla selezione o, senza selezione, nel punto del cursore. */
export function startComment(editor: Editor) {
  const { from, to, empty } = editor.state.selection;
  useCommentUi.setState({ draft: empty ? { from, to: from, kind: 'line' } : { from, to, kind: 'text' }, open: null });
}

export function commitDraft(editor: Editor, body: string) {
  const d = useCommentUi.getState().draft;
  useCommentUi.setState({ draft: null });
  if (!d || !body.trim()) return;
  const flat = flatText(editor.state.doc);
  const c: Comment = {
    id: newCommentId(),
    author: useFolium.getState().app.author || t('comment.me'),
    body: body.trim(),
    created: new Date().toISOString(),
    anchor: makeAnchor(flat, d.from, d.to, d.kind),
    offsetX: null,
    offsetY: null,
    commits: [],
    replies: [],
    origin: { kind: 'author' },
    ...statusFields('open'),
  };
  save([...comments(), c]);
  const anchors = new Map(anchorsKey.getState(editor.state)?.anchors ?? []);
  anchors.set(c.id, { from: d.from, to: d.to, kind: d.kind });
  setAnchors(editor, anchors);
}

export function reply(id: string, body: string) {
  if (!body.trim()) return;
  const author = useFolium.getState().app.author || t('comment.me');
  save(comments().map((c) => (c.id === id ? { ...c, replies: [...c.replies, { id: newCommentId(), author, body: body.trim(), created: new Date().toISOString() }] } : c)));
}

function dropAnchor(id: string) {
  const editor = getEditor();
  if (!editor) return;
  const anchors = new Map(anchorsKey.getState(editor.state)?.anchors ?? []);
  if (anchors.delete(id)) setAnchors(editor, anchors);
}

export function resolve(id: string) {
  save(comments().map((c) => (c.id === id ? { ...c, ...statusFields('resolved'), updated: new Date().toISOString() } : c)));
  dropAnchor(id);
  useCommentUi.setState({ open: null });
}

export function reopen(id: string) {
  save(comments().map((c) => (c.id === id ? { ...c, ...statusFields('open') } : c)));
  const editor = getEditor();
  if (editor) loadComments(editor);
}

export function removeComment(id: string) {
  save(comments().filter((c) => c.id !== id));
  dropAnchor(id);
  useCommentUi.setState({ open: null });
}

/** Commento sotto la posizione (per il clic destro e il clic sul testo sottolineato). */
export function commentAt(editor: Editor, pos: number): string | null {
  const anchors = anchorsKey.getState(editor.state)?.anchors;
  if (!anchors) return null;
  for (const [id, a] of anchors) if (a.kind === 'text' ? pos >= a.from && pos <= a.to : pos === a.from) return id;
  return null;
}

export function openComment(id: string | null) {
  useCommentUi.setState({ open: id, draft: null });
  setActive(getEditor(), id);
}

/** Porta il testo al commento e apre la nuvoletta (dall'Index). */
export function focusComment(id: string) {
  const editor = getEditor();
  const a = editor ? anchorsKey.getState(editor.state)?.anchors.get(id) : undefined;
  if (editor && a) {
    editor.chain().setTextSelection(a.from).scrollIntoView().run();
  }
  openComment(id);
}
