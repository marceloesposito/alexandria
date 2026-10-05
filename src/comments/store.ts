// Stato dei commenti del documento aperto: caricamento, ri-ancoraggio, modifiche, salvataggio.
import { create } from 'zustand';
import type { Editor } from '@tiptap/core';
import {
  type Comment,
  type Anchor,
  type CommentsFile,
  makeAnchor,
  reanchor,
  newCommentId,
  normalizeCommentsFile,
  statusFields,
  type CommentStatus,
} from './model';
import { commentsKey, flatText, setAnchorsListener, type LiveAnchor } from './plugin';
import { readJson, writeJson } from '../vault/vault';
import { abs, commentsFile } from '../vault/paths';
import { useWorkspace } from '../state/workspace';
import { getEditor } from '../state/editorRef';
import { onDocLoaded } from '../editor/session';
import { t } from '../i18n';
import { useTrack } from '../editor/extensions/track';

export interface Draft {
  /** y della riga cliccata (rispetto alla pagina) */
  y: number;
  anchor: Anchor | null;
}

interface CommentsState {
  rel: string | null;
  comments: Comment[];
  draft: Draft | null;
  hovered: string | null;
  active: string | null;
  showResolved: boolean;
  query: string;
  setDraft(d: Draft | null): void;
  create(body: string): string | null;
  update(id: string, body: string): void;
  reply(id: string, body: string): void;
  setResolved(id: string, resolved: boolean): void;
  setStatus(id: string, status: CommentStatus): void;
  linkCommit(id: string, sha: string): void;
  unlinkCommit(id: string, sha: string): void;
  /** commenti arrivati da fuori (Word, copia per revisione) */
  addMany(list: Comment[]): void;
  remove(id: string): void;
  link(id: string, from: number, to: number, kind: Anchor['kind']): void;
  unlink(id: string): void;
  setOffset(id: string, x: number | null, y: number | null): void;
  setHovered(id: string | null): void;
  setActive(id: string | null): void;
  setShowResolved(v: boolean): void;
  setQuery(q: string): void;
}

const author = () => useWorkspace.getState().app.prefs.authorName || t('comments.me');
const now = () => new Date().toISOString();

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function pushAnchorsToEditor(comments: Comment[]) {
  const e = getEditor();
  if (!e) return;
  const set = new Map<string, LiveAnchor>();
  for (const c of comments) if (c.anchor) set.set(c.id, { from: c.anchor.from, to: c.anchor.to, kind: c.anchor.kind });
  e.view.dispatch(e.state.tr.setMeta(commentsKey, { set }).setMeta('addToHistory', false));
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveNow(), 500);
}

export async function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const { rel, comments } = useComments.getState();
  const root = useWorkspace.getState().vaultRoot;
  const e = getEditor();
  if (!rel || !root) return;
  // citazione e contesto aggiornati sul testo corrente
  const flat = e ? flatText(e.state.doc) : null;
  const out: CommentsFile = {
    version: 1,
    comments: comments.map((c) =>
      c.anchor && flat ? { ...c, anchor: makeAnchor(flat, c.anchor.from, c.anchor.to, c.anchor.kind) } : c,
    ),
  };
  const path = abs(root, commentsFile(rel));
  if (!out.comments.length) {
    // nessun commento: niente file (si evita rumore nel version control)
    const { platform } = await import('../platform');
    if (await platform.exists(path)) await platform.remove(path);
    return;
  }
  await writeJson(path, out);
}

export const useComments = create<CommentsState>((set, get) => {
  const mutate = (f: (cs: Comment[]) => Comment[], syncAnchors = false) => {
    const comments = f(get().comments);
    set({ comments });
    if (syncAnchors) pushAnchorsToEditor(comments);
    scheduleSave();
  };
  return {
    rel: null,
    comments: [],
    draft: null,
    hovered: null,
    active: null,
    showResolved: false,
    query: '',
    setDraft(d) {
      set({ draft: d });
    },
    create(body) {
      const d = get().draft;
      if (!body.trim() || !d) return null;
      const c: Comment = {
        id: newCommentId(),
        author: useTrack.getState().reviewer ?? author(),
        ...(useTrack.getState().reviewer ? { origin: { kind: 'reviewer' as const, name: useTrack.getState().reviewer! } } : {}),
        body: body.trim(),
        created: now(),
        anchor: d.anchor,
        offsetX: null,
        offsetY: d.anchor ? null : d.y,
        ...statusFields('open'),
        commits: [],
        replies: [],
      };
      set({ draft: null, active: c.id });
      mutate((cs) => [...cs, c], true);
      return c.id;
    },
    update(id, body) {
      mutate((cs) => cs.map((c) => (c.id === id ? { ...c, body, updated: now() } : c)));
    },
    reply(id, body) {
      if (!body.trim()) return;
      mutate((cs) =>
        cs.map((c) =>
          c.id === id ? { ...c, replies: [...c.replies, { id: newCommentId(), author: useTrack.getState().reviewer ?? author(), body: body.trim(), created: now() }] } : c,
        ),
      );
    },
    setResolved(id, resolved) {
      mutate((cs) => cs.map((c) => (c.id === id ? { ...c, ...statusFields(resolved ? 'resolved' : 'open') } : c)), true);
    },
    setStatus(id, status) {
      mutate((cs) => cs.map((c) => (c.id === id ? { ...c, ...statusFields(status) } : c)), true);
    },
    linkCommit(id, sha) {
      mutate((cs) => cs.map((c) => (c.id === id && !c.commits.includes(sha) ? { ...c, commits: [...c.commits, sha] } : c)), true);
    },
    addMany(list) {
      if (list.length) mutate((cs) => [...cs, ...list], true);
    },
    unlinkCommit(id, sha) {
      mutate((cs) => cs.map((c) => (c.id === id ? { ...c, commits: c.commits.filter((x) => x !== sha) } : c)), true);
    },
    remove(id) {
      mutate((cs) => cs.filter((c) => c.id !== id), true);
    },
    link(id, from, to, kind) {
      const e = getEditor();
      if (!e) return;
      const anchor = makeAnchor(flatText(e.state.doc), from, to, kind);
      // dopo il collegamento la bolla si puo' spostare liberamente: parte dalla posizione dell'ancora
      mutate((cs) => cs.map((c) => (c.id === id ? { ...c, anchor, offsetY: null, offsetX: null } : c)), true);
    },
    unlink(id) {
      mutate((cs) => cs.map((c) => (c.id === id ? { ...c, anchor: null } : c)), true);
    },
    setOffset(id, x, y) {
      mutate((cs) => cs.map((c) => (c.id === id ? { ...c, offsetX: x, offsetY: y } : c)));
    },
    setHovered(id) {
      if (get().hovered !== id) set({ hovered: id });
    },
    setActive(id) {
      if (get().active === id) return;
      set({ active: id });
      const e = getEditor();
      if (e) e.view.dispatch(e.state.tr.setMeta(commentsKey, { active: id }).setMeta('addToHistory', false));
    },
    setShowResolved(v) {
      set({ showResolved: v });
    },
    setQuery(q) {
      set({ query: q });
    },
  };
});

/** Carica i commenti del documento appena aperto e li ri-ancora al testo. */
export async function loadComments(editor: Editor, root: string, rel: string) {
  await saveNow();
  const file = normalizeCommentsFile(await readJson<unknown>(abs(root, commentsFile(rel)), null));
  const flat = flatText(editor.state.doc);
  const comments = file.comments.map((c) => {
    if (!c.anchor) return c;
    const exact = editor.state.doc.content.size >= c.anchor.to && flat.text.length > 0;
    if (exact) {
      const cur = makeAnchor(flat, c.anchor.from, c.anchor.to, c.anchor.kind);
      if (cur.quote === c.anchor.quote) return c;
    }
    const r = reanchor(flat, c.anchor);
    return r ? { ...c, anchor: { ...c.anchor, from: r.from, to: r.to } } : { ...c, anchor: null };
  });
  useComments.setState({ rel, comments, draft: null, active: null, hovered: null });
  pushAnchorsToEditor(comments);
}

// le ancore vive aggiornano lo store (e chi perde il testo diventa orfano)
setAnchorsListener((anchors, orphaned) => {
  const st = useComments.getState();
  let changed = orphaned.length > 0;
  const comments = st.comments.map((c) => {
    if (!c.anchor) return c;
    if (orphaned.includes(c.id)) return { ...c, anchor: null };
    const a = anchors.get(c.id);
    if (!a) return c;
    if (a.from === c.anchor.from && a.to === c.anchor.to) return c;
    changed = true;
    return { ...c, anchor: { ...c.anchor, from: a.from, to: a.to } };
  });
  if (changed) {
    useComments.setState({ comments });
    scheduleSave();
  }
});

onDocLoaded((editor, root, rel) => loadComments(editor, root, rel));
