// Nuvolette delle Marginalia dentro la pagina: quella per scrivere un commento nuovo (Invio salva,
// Esc annulla) e quella di un commento esistente (risposte, Risolvi, Elimina nel "…").
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { MoreHorizontal, Check } from 'lucide-react';
import { useColumn } from '../store';
import { useCommentUi, commitDraft, reply, resolve, removeComment, openComment, commentAt } from './store';
import { anchorsKey } from './anchors';
import { openContextMenu } from '../../components/ContextMenu';
import { t, useLang } from '../../i18n';

/** Posizione nella pagina (coordinate relative al contenitore .fx-page) sotto un punto del testo. */
function placeAt(editor: Editor, pos: number, page: HTMLElement | null): { x: number; y: number } | null {
  if (!page) return null;
  try {
    const c = editor.view.coordsAtPos(Math.min(pos, editor.state.doc.content.size));
    const r = page.getBoundingClientRect();
    const zoom = r.width / page.offsetWidth || 1;
    return { x: (c.left - r.left) / zoom, y: (c.bottom - r.top) / zoom + 6 };
  } catch {
    return null;
  }
}

function when(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function CommentLayer({ editor }: { editor: Editor }) {
  useLang();
  const draft = useCommentUi((s) => s.draft);
  const open = useCommentUi((s) => s.open);
  const sheet = useColumn((s) => s.sheet);
  const host = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState('');
  const comment = open ? sheet?.comments.comments.find((c) => c.id === open) : undefined;

  // clic sul testo commentato (o sul punto): apre il commento
  useEffect(() => {
    const dom = editor.view.dom;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-comment]');
      if (el?.dataset.comment) {
        openComment(el.dataset.comment);
        return;
      }
      const at = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos;
      if (at === undefined || !editor.state.selection.empty) return;
      const id = commentAt(editor, at);
      if (id && id !== useCommentUi.getState().open) openComment(id);
    };
    dom.addEventListener('click', onClick);
    return () => dom.removeEventListener('click', onClick);
  }, [editor]);

  // dove sta la nuvoletta
  useLayoutEffect(() => {
    const page = host.current?.parentElement ?? null;
    if (draft) setPos(placeAt(editor, draft.to, page));
    else if (open) {
      const a = anchorsKey.getState(editor.state)?.anchors.get(open);
      setPos(a ? placeAt(editor, a.to, page) : null);
    } else setPos(null);
    setText('');
  }, [draft, open, editor]);

  // Esc o clic fuori chiudono
  useEffect(() => {
    if (!draft && !open) return;
    const onDown = (e: MouseEvent) => {
      const tgt = e.target as HTMLElement;
      if (host.current?.contains(tgt) || tgt.closest('[data-comment]') || tgt.closest('.context-menu')) return;
      if (draft) useCommentUi.setState({ draft: null });
      else openComment(null);
    };
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, [draft, open]);

  const close = () => {
    useCommentUi.setState({ draft: null });
    openComment(null);
    editor.commands.focus();
  };

  return (
    <div ref={host} className="fx-comment-layer">
      {draft && pos && (
        <div className="fx-bubble" style={{ left: pos.x, top: pos.y }} role="dialog" aria-label={t('comment.new')}>
          <textarea
            className="fx-bubble__input"
            autoFocus
            rows={2}
            value={text}
            placeholder={t('comment.placeholder')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                close();
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitDraft(editor, text);
                editor.commands.focus();
              }
            }}
          />
          <div className="fx-bubble__hint">{t('comment.hint')}</div>
        </div>
      )}
      {comment && pos && (
        <div className="fx-bubble fx-bubble--thread" style={{ left: pos.x, top: pos.y }} role="dialog" aria-label={t('comment.thread')}>
          <div className="fx-thread__head">
            <strong>{comment.author}</strong>
            <span className="fx-muted">{when(comment.created)}</span>
            <span className="fx-spacer" />
            <button className="fx-icon" title={t('cmd.comment.resolve')} aria-label={t('cmd.comment.resolve')} onClick={() => resolve(comment.id)}>
              <Check size={15} />
            </button>
            <button
              className="fx-icon"
              title={t('common.more')}
              aria-label={t('common.more')}
              onClick={(e) => openContextMenu(e, [{ label: t('cmd.comment.delete'), danger: true, onClick: () => removeComment(comment.id) }])}
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
          <p className="fx-thread__body">{comment.body}</p>
          {comment.replies.map((r) => (
            <div key={r.id} className="fx-thread__reply">
              <strong>{r.author}</strong> <span className="fx-muted">{when(r.created)}</span>
              <p>{r.body}</p>
            </div>
          ))}
          <textarea
            className="fx-bubble__input"
            rows={1}
            value={text}
            placeholder={t('cmd.comment.reply')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                close();
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                reply(comment.id, text);
                setText('');
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
