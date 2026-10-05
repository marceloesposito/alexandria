// Colonna dei commenti, allineata alla pagina e sincronizzata con il suo scorrimento.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Eye, EyeOff, Link2, Unlink, Trash2, CheckCircle2, RotateCcw, ChevronDown, ChevronRight, MessageSquare, GitCommitHorizontal } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useVersions } from '../versions/store';
import { useComments, saveNow } from './store';
import { useCommentUi } from './ui';
import { layoutBubbles, matchesQuery, makeAnchor, type Comment } from './model';
import { lineAt, useLines, getLines } from '../editor/lines';
import { lineRange, posTopInPage, scrollEl, pageEl, dropTarget, revealAnchor } from './geometry';
import { getEditor } from '../state/editorRef';
import { flatText } from './plugin';
import { t, useLang } from '../i18n';
import { openContextMenu } from '../components/ContextMenu';
import { confirmDialog } from '../components/confirm';
import type { PageProps } from '../editor/slots';
import { useDoc } from '../editor/session';
import { useWorkspace } from '../state/workspace';

const BUBBLE_GAP = 8;

function timeAgo(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Sincronizza la traccia dei commenti con lo scorrimento della pagina. */
function useScrollSync(trackRef: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
  useEffect(() => {
    let raf = 0;
    const apply = () => {
      const sc = scrollEl();
      const page = pageEl();
      const track = trackRef.current;
      if (!sc || !page || !track) return;
      const colTop = track.parentElement!.getBoundingClientRect().top;
      const pageTop = page.getBoundingClientRect().top;
      track.style.transform = `translateY(${pageTop - colTop}px)`;
      track.style.height = `${page.offsetHeight}px`;
      useCommentUi.getState().bump();
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    const sc = scrollEl();
    sc?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const ro = new ResizeObserver(onScroll);
    const page = pageEl();
    if (page) ro.observe(page);
    apply();
    return () => {
      sc?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function CommentsColumn(_props: PageProps) {
  useLang();
  const comments = useComments((s) => s.comments);
  const draft = useComments((s) => s.draft);
  const showResolved = useComments((s) => s.showResolved);
  const query = useComments((s) => s.query);
  const active = useComments((s) => s.active);
  const lines = useLines();
  const hoverLine = useCommentUi((s) => s.hoverLine);
  const trackRef = useRef<HTMLDivElement>(null);
  const heights = useRef(new Map<string, number>());
  const [measureTick, setMeasureTick] = useState(0);
  const [showOrphans, setShowOrphans] = useState(true);
  const sourceMode = useDoc((s) => s.sourceMode);
  const activeDoc = useWorkspace((s) => s.activeDoc);
  useScrollSync(trackRef, [sourceMode, activeDoc]);

  const visible = useMemo(
    () => comments.filter((c) => c.anchor && (showResolved || !c.resolved) && matchesQuery(c, query)),
    [comments, showResolved, query],
  );
  const orphans = comments.filter((c) => !c.anchor && (showResolved || !c.resolved));

  // posizioni: allineate all'ancora, poi distanziate; quelle spostate a mano restano ferme
  const positions = useMemo(() => {
    const items = visible.map((c) => {
      const desired = c.offsetY ?? posTopInPage(c.anchor!.from) ?? 0;
      return { id: c.id, y: desired, height: heights.current.get(c.id) ?? 64, pinned: c.offsetY !== null };
    });
    if (draft) items.push({ id: '__draft', y: draft.y, height: heights.current.get('__draft') ?? 90, pinned: true });
    return layoutBubbles(items, BUBBLE_GAP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, draft, lines, measureTick]);

  // i connettori seguono testo e bolle
  useEffect(() => useCommentUi.getState().bump(), [lines, positions]);

  // misura le altezze delle bolle e ricalcola se cambiano
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let changed = false;
    track.querySelectorAll<HTMLElement>('[data-bubble]').forEach((el) => {
      const id = el.dataset.bubble!;
      const h = el.offsetHeight;
      if (Math.abs((heights.current.get(id) ?? 0) - h) > 1) {
        heights.current.set(id, h);
        changed = true;
      }
    });
    if (changed) setMeasureTick((x) => x + 1);
  });

  const yFromEvent = (e: React.MouseEvent) => e.clientY - trackRef.current!.getBoundingClientRect().top;

  const onMove = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-bubble]')) {
      useCommentUi.getState().setHoverLine(null);
      return;
    }
    useCommentUi.getState().setHoverLine(lineAt(getLines(), yFromEvent(e)));
  };

  const onClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-bubble]')) return;
    const line = lineAt(getLines(), yFromEvent(e));
    const st = useComments.getState();
    st.setActive(null);
    if (!line) {
      st.setDraft(null);
      return;
    }
    const range = lineRange(line);
    const editor = getEditor();
    const anchor = range && editor ? makeAnchor(flatText(editor.state.doc), range.from, range.to, 'line') : null;
    st.setDraft({ y: line.top, anchor });
  };

  const count = comments.filter((c) => !c.resolved).length;

  return (
    <div className="comments">
      <header className="comments__head">
        <MessageSquare size={14} />
        <span className="comments__title">{t('comments.title', { n: count })}</span>
        <button
          className={`icon-btn ${showResolved ? 'is-on' : ''}`}
          title={showResolved ? t('comments.hideResolved') : t('comments.showResolved')}
          onClick={() => useComments.getState().setShowResolved(!showResolved)}
        >
          {showResolved ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </header>
      <div className="comments__search">
        <Search size={13} />
        <input
          id="comments-search"
          className="input"
          placeholder={t('comments.search')}
          value={query}
          onChange={(e) => useComments.getState().setQuery(e.target.value)}
        />
        {query && (
          <span className="hint">{t('comments.found', { n: visible.length })}</span>
        )}
      </div>
      <div className="comments__viewport">
        <div
          ref={trackRef}
          className="comments__track"
          onMouseMove={onMove}
          onMouseLeave={() => useCommentUi.getState().setHoverLine(null)}
          onClick={onClick}
        >
          {hoverLine && !draft && <div className="comments__guide" style={{ top: hoverLine.top, height: hoverLine.bottom - hoverLine.top }} />}
          {visible.map((c) => (
            <Bubble key={c.id} c={c} y={positions.get(c.id) ?? 0} active={active === c.id} />
          ))}
          {draft && <DraftBubble y={positions.get('__draft') ?? draft.y} />}
        </div>
      </div>
      {orphans.length > 0 && (
        <section className="comments__orphans">
          <button className="comments__orphans-head" onClick={() => setShowOrphans(!showOrphans)}>
            {showOrphans ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {t('comments.orphans', { n: orphans.length })}
          </button>
          {showOrphans && (
            <div className="comments__orphans-list">
              <p className="hint">{t('comments.orphansHint')}</p>
              {orphans.map((c) => (
                <Bubble key={c.id} c={c} y={null} active={active === c.id} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function DraftBubble({ y }: { y: number }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="bubble bubble--draft" data-bubble="__draft" style={{ top: y }} onClick={(e) => e.stopPropagation()}>
      <textarea
        ref={ref}
        className="bubble__input"
        rows={2}
        value={text}
        placeholder={t('comments.placeholder')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            useComments.getState().create(text);
          }
          if (e.key === 'Escape') useComments.getState().setDraft(null);
        }}
      />
      <div className="bubble__hint">{t('comments.enterHint')}</div>
    </div>
  );
}

function Bubble({ c, y, active }: { c: Comment; y: number | null; active: boolean }) {
  const st = useComments.getState();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(c.body);
  const [reply, setReply] = useState('');
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [pickCommit, setPickCommit] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const linked = c.anchor?.kind === 'text';

  useEffect(() => setBody(c.body), [c.body]);

  // trascinamento della bolla (solo dopo il collegamento)
  const startMove = (e: React.PointerEvent) => {
    if (!linked || y === null) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, textarea, input, .bubble__dot')) return;
    const el = ref.current!;
    const track = el.parentElement!;
    const startX = e.clientX;
    const startY = e.clientY;
    const x0 = c.offsetX ?? 0;
    const y0 = y;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      const maxX = Math.max(0, track.clientWidth - el.offsetWidth - 32);
      setDrag({ x: Math.max(0, Math.min(maxX, x0 + dx)), y: Math.max(0, y0 + dy) });
      useCommentUi.getState().bump();
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) {
        const maxX = Math.max(0, track.clientWidth - el.offsetWidth - 32);
        st.setOffset(c.id, Math.max(0, Math.min(maxX, x0 + ev.clientX - startX)), Math.max(0, y0 + ev.clientY - startY));
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // pallino: trascinandolo si collega il commento a una parola o alla selezione
  const startLink = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x0 = r.left + r.width / 2;
    const y0 = r.top + r.height / 2;
    const ui = useCommentUi.getState();
    ui.setLinking({ id: c.id, x0, y0, x: e.clientX, y: e.clientY });
    document.body.classList.add('is-linking');
    const move = (ev: PointerEvent) => ui.setLinking({ id: c.id, x0, y0, x: ev.clientX, y: ev.clientY });
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('is-linking');
      ui.setLinking(null);
      const target = dropTarget(ev.clientX, ev.clientY);
      if (target) {
        st.link(c.id, target.from, target.to, 'text');
        st.setActive(c.id);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const menu = (e: React.MouseEvent) => {
    e.stopPropagation();
    openContextMenu(e, [
      { label: t('comments.edit'), onClick: () => setEditing(true) },
      c.resolved
        ? { label: t('comments.reopen'), onClick: () => st.setResolved(c.id, false) }
        : { label: t('comments.resolve'), onClick: () => st.setResolved(c.id, true) },
      ...(c.status !== 'accepted' ? [{ label: t('comments.accept'), onClick: () => st.setStatus(c.id, 'accepted') }] : []),
      ...(c.status !== 'rejected' ? [{ label: t('comments.reject'), onClick: () => st.setStatus(c.id, 'rejected') }] : []),
      { label: t('comments.linkCommit'), onClick: () => setPickCommit(true) },
      ...(c.anchor ? [{ label: t('comments.unlink'), onClick: () => st.unlink(c.id) }] : []),
      ...(c.offsetY !== null && c.anchor ? [{ label: t('comments.realign'), onClick: () => st.setOffset(c.id, null, null) }] : []),
      { sep: true, label: '' },
      {
        label: t('common.delete'),
        danger: true,
        onClick: async () => {
          if (await confirmDialog(t('comments.confirmDelete'), undefined, { danger: true, okLabel: t('common.delete') })) st.remove(c.id);
        },
      },
    ]);
  };

  const pos = drag ?? (y === null ? null : { x: c.offsetX ?? 0, y });
  const style = pos ? { top: pos.y, left: pos.x } : undefined;

  return (
    <div
      ref={ref}
      className={`bubble ${active ? 'is-active' : ''} ${c.resolved ? 'is-resolved' : ''} ${linked ? 'is-linked' : ''} ${y === null ? 'is-static' : ''} ${drag ? 'is-dragging' : ''}`}
      data-bubble={c.id}
      style={style}
      onPointerDown={startMove}
      onMouseEnter={() => useComments.getState().setHovered(c.id)}
      onMouseLeave={() => useComments.getState().setHovered(null)}
      onClick={(e) => {
        e.stopPropagation();
        st.setActive(c.id);
      }}
      onDoubleClick={() => c.anchor && revealAnchor(c.anchor.from, c.anchor.to)}
      onContextMenu={menu}
    >
      <button
        className="bubble__close"
        title={c.resolved ? t('comments.reopen') : t('comments.close')}
        onClick={(e) => {
          e.stopPropagation();
          st.setResolved(c.id, !c.resolved);
        }}
      >
        {c.resolved ? <RotateCcw size={12} /> : <X size={12} />}
      </button>
      <span className="bubble__dot" title={t('comments.dotHint')} onPointerDown={startLink} />
      <div className="bubble__meta">
        <span className="bubble__author">{c.author}</span>
        <span className="bubble__time">{timeAgo(c.created)}</span>
        {c.resolved && <CheckCircle2 size={11} className="bubble__resolved" />}
      </div>
      {(c.origin?.kind === 'reviewer' || c.origin?.kind === 'word' || c.status === 'accepted' || c.status === 'rejected') && (
        <div className="bubble__tags">
          {c.origin && c.origin.kind !== 'author' && (
            <span className="bubble__origin" style={{ borderColor: reviewerColor(c.origin.name ?? c.author) }}>
              {c.origin.kind === 'word' ? 'Word' : t('comments.reviewer')} · {c.origin.name ?? c.author}
            </span>
          )}
          {c.status === 'accepted' && <span className="bubble__status is-accepted">{t('comments.status.accepted')}</span>}
          {c.status === 'rejected' && <span className="bubble__status is-rejected">{t('comments.status.rejected')}</span>}
        </div>
      )}
      {c.anchor && c.anchor.kind === 'text' && (
        <div className="bubble__quote" title={t('comments.quoteHint')}>
          <Link2 size={10} /> «{c.anchor.quote.length > 60 ? c.anchor.quote.slice(0, 60) + '…' : c.anchor.quote}»
        </div>
      )}
      {!c.anchor && <div className="bubble__quote is-orphan"><Unlink size={10} /> {t('comments.orphan')}</div>}
      {editing ? (
        <textarea
          className="bubble__input"
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (body.trim() && body !== c.body) st.update(c.id, body.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
            if (e.key === 'Escape') {
              setBody(c.body);
              setEditing(false);
            }
          }}
        />
      ) : (
        <div className="bubble__body" onDoubleClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}>
          {c.body}
        </div>
      )}
      {c.commits.length > 0 && (
        <div className="bubble__commits">
          {c.commits.map((sha) => (
            <CommitChip key={sha} sha={sha} onRemove={() => st.unlinkCommit(c.id, sha)} />
          ))}
        </div>
      )}
      {pickCommit && <CommitPicker onPick={(sha) => st.linkCommit(c.id, sha)} onClose={() => setPickCommit(false)} />}
      {c.replies.map((r) => (
        <div key={r.id} className="bubble__reply">
          <div className="bubble__meta">
            <span className="bubble__author">{r.author}</span>
            <span className="bubble__time">{timeAgo(r.created)}</span>
          </div>
          <div className="bubble__body">{r.body}</div>
        </div>
      ))}
      {active && !c.resolved && (
        <div className="bubble__actions">
          <input
            className="bubble__reply-input"
            placeholder={t('comments.reply')}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && reply.trim()) {
                st.reply(c.id, reply);
                setReply('');
              }
            }}
          />
          <button className="icon-btn tiny" title={t('common.delete')} onClick={async (e) => {
            e.stopPropagation();
            if (await confirmDialog(t('comments.confirmDelete'), undefined, { danger: true, okLabel: t('common.delete') })) st.remove(c.id);
          }}>
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// salvataggio dei commenti prima di chiudere
window.addEventListener('beforeunload', () => void saveNow());

/** Colore stabile per revisore (dal nome), fra i colori delle serie. */
function reviewerColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `var(--series-${(h % 8) + 1})`;
}

/** Versione del Palimpsestus collegata: clic = la apre nel Palimpsestus. */
export function CommitChip({ sha, onRemove }: { sha: string; onRemove: () => void }) {
  const c = useVersions((s) => s.log?.commits.find((x) => x.sha === sha));
  return (
    <span className="bubble__commit">
      <button
        className="bubble__commit-open"
        title={t('comments.openCommit')}
        onClick={(e) => {
          e.stopPropagation();
          useVersions.getState().select(sha);
          useWorkspace.getState().setView('versions');
        }}
      >
        <GitCommitHorizontal size={11} /> {c ? c.message.split('\n')[0].slice(0, 40) : sha.slice(0, 7)}
      </button>
      <button className="icon-btn tiny" title={t('common.delete')} onClick={(e) => (e.stopPropagation(), onRemove())}>
        <X size={10} />
      </button>
    </span>
  );
}

export function CommitPicker({ onPick, onClose }: { onPick: (sha: string) => void; onClose: () => void }) {
  const log = useVersions((s) => s.log);
  useEffect(() => {
    void useVersions.getState().refresh();
  }, []);
  const commits = (log?.commits ?? []).slice(0, 25);
  return (
    <Modal title={t('comments.linkCommit')} onClose={onClose} size="small">
      <p className="hint">{t('comments.linkCommitHint')}</p>
      <ul className="commit-pick">
        {!commits.length && <li className="hint">{t('vc.noHistory')}</li>}
        {commits.map((c) => (
          <li
            key={c.sha}
            onClick={() => {
              onPick(c.sha);
              onClose();
            }}
          >
            <GitCommitHorizontal size={12} />
            <span className="commit-pick__msg">{c.message.split('\n')[0]}</span>
            <span className="hint">{new Date(c.time * 1000).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
