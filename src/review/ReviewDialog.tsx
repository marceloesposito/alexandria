// Risposta ai revisori: round di revisione con i punti, le risposte, le versioni collegate e l'export
// della lettera e della versione con le modifiche evidenziate.
import { useEffect, useState } from 'react';
import { Plus, Trash2, ClipboardPaste, MessageSquare, FileOutput, GitCompare, GitCommitHorizontal, Link2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWorkspace } from '../state/workspace';
import { useRounds, newRound, itemsFromMarginalia, itemsFromLetter, exportLetter, exportChanges } from './store';
import type { ReviewRound, ReviewItem, ItemStatus } from './model';
import { CommitPicker, CommitChip } from '../comments/CommentsColumn';
import { openContextMenu } from '../components/ContextMenu';
import { promptDialog, confirmDialog } from '../components/confirm';
import { useComments } from '../comments/store';
import type { ExportFormat } from '../export/run';
import { t, useLang } from '../i18n';

export function ReviewDialog() {
  useLang();
  const close = () => useWorkspace.getState().closeDialog();
  const rounds = useRounds((s) => s.rounds);
  const [sel, setSel] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const round = rounds.find((r) => r.id === sel) ?? rounds[0] ?? null;
  useEffect(() => {
    void useRounds.getState().load();
  }, []);
  const save = (r: ReviewRound) => void useRounds.getState().save(r);
  const editItem = (id: string, patch: Partial<ReviewItem>) => round && save({ ...round, items: round.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  const exportMenu = (e: React.MouseEvent, f: (r: ReviewRound, x: ExportFormat) => Promise<void>) =>
    round &&
    openContextMenu(e, [
      { label: 'PDF', onClick: () => void f(round, 'pdf') },
      { label: 'Word (.docx)', onClick: () => void f(round, 'docx') },
      { label: 'HTML', onClick: () => void f(round, 'html') },
    ]);

  return (
    <Modal title={t('review.title')} onClose={close} size="large">
      <div className="review-dlg">
        <aside className="review-dlg__rounds">
          {rounds.map((r) => (
            <div key={r.id} className={`review-dlg__round ${round?.id === r.id ? 'is-active' : ''}`} onClick={() => setSel(r.id)}>
              <strong>{r.name}</strong>
              <span className="hint">
                {new Date(r.created).toLocaleDateString()} · {t('review.count', { done: r.items.filter((i) => i.status !== 'todo').length, n: r.items.length })}
              </span>
            </div>
          ))}
          <button
            className="btn small"
            onClick={async () => {
              const name = await promptDialog(t('review.newName'), t('review.defaultName'));
              if (name?.trim()) setSel((await newRound(name.trim())).id);
            }}
          >
            <Plus size={13} /> {t('review.new')}
          </button>
          <p className="hint">{t('review.hint')}</p>
        </aside>
        {round ? (
          <section className="review-dlg__main">
            <div className="review-dlg__bar">
              <button className="btn small" onClick={async () => save({ ...round, items: [...round.items, ...(await itemsFromMarginalia(round))] })}>
                <MessageSquare size={13} /> {t('review.fromMarginalia')}
              </button>
              <button className="btn small" onClick={() => setPasting(true)}>
                <ClipboardPaste size={13} /> {t('review.fromLetter')}
              </button>
              <button className="btn small" onClick={() => save({ ...round, items: [...round.items, { id: `i${Date.now().toString(36)}`, reviewer: round.items[round.items.length - 1]?.reviewer ?? t('review.reviewerN', { n: 1 }), text: '', response: '', status: 'todo', commits: [] }] })}>
                <Plus size={13} /> {t('review.addItem')}
              </button>
              <span className="grow" />
              <button className="btn small" onClick={(e) => exportMenu(e, exportLetter)}>
                <FileOutput size={13} /> {t('review.exportLetter')}
              </button>
              <button className="btn small" disabled={!round.baseSha} title={t('review.exportChangesHint')} onClick={(e) => exportMenu(e, exportChanges)}>
                <GitCompare size={13} /> {t('review.exportChanges')}
              </button>
              <button
                className="icon-btn"
                title={t('common.delete')}
                onClick={async () => {
                  if (await confirmDialog(t('review.confirmDelete', { name: round.name }), undefined, { danger: true, okLabel: t('common.delete') })) {
                    await useRounds.getState().remove(round.id);
                    setSel(null);
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
            {!round.items.length && <p className="hint review-dlg__empty">{t('review.empty')}</p>}
            <ol className="review-items">
              {round.items.map((i) => (
                <Item key={i.id} item={i} onChange={(p) => editItem(i.id, p)} onRemove={() => save({ ...round, items: round.items.filter((x) => x.id !== i.id) })} />
              ))}
            </ol>
          </section>
        ) : (
          <p className="hint">{t('review.none')}</p>
        )}
      </div>
      {pasting && round && (
        <LetterPaste
          onClose={() => setPasting(false)}
          onAdd={(text) => {
            save({ ...round, items: [...round.items, ...itemsFromLetter(text)] });
            setPasting(false);
          }}
        />
      )}
    </Modal>
  );
}

function Item({ item, onChange, onRemove }: { item: ReviewItem; onChange: (p: Partial<ReviewItem>) => void; onRemove: () => void }) {
  const [picking, setPicking] = useState(false);
  const [response, setResponse] = useState(item.response);
  const [text, setText] = useState(item.text);
  useEffect(() => setResponse(item.response), [item.response]);
  return (
    <li className={`review-item is-${item.status}`}>
      <div className="review-item__head">
        <input className="input review-item__reviewer" defaultValue={item.reviewer} onBlur={(e) => e.target.value !== item.reviewer && onChange({ reviewer: e.target.value })} aria-label={t('comments.reviewer')} />
        <select className="select small" value={item.status} onChange={(e) => onChange({ status: e.target.value as ItemStatus })}>
          <option value="todo">{t('review.status.todo')}</option>
          <option value="done">{t('review.status.done')}</option>
          <option value="declined">{t('review.status.declined')}</option>
        </select>
        {item.source && (
          <button
            className="btn small"
            title={t('review.goComment')}
            onClick={() => {
              const ws = useWorkspace.getState();
              ws.closeDialog();
              ws.openDoc(item.source!.rel);
              ws.setView('editor');
              setTimeout(() => useComments.getState().setActive(item.source!.commentId), 600);
            }}
          >
            <Link2 size={12} />
          </button>
        )}
        <span className="grow" />
        <button className="icon-btn tiny" title={t('common.delete')} onClick={onRemove}>
          <Trash2 size={12} />
        </button>
      </div>
      <textarea className="input review-item__text" rows={2} value={text} placeholder={t('review.textHint')} onChange={(e) => setText(e.target.value)} onBlur={() => text !== item.text && onChange({ text })} />
      <textarea className="input review-item__response" rows={2} value={response} placeholder={t('review.responseHint')} onChange={(e) => setResponse(e.target.value)} onBlur={() => response !== item.response && onChange({ response })} />
      <div className="review-item__commits">
        {item.commits.map((sha) => (
          <CommitChip key={sha} sha={sha} onRemove={() => onChange({ commits: item.commits.filter((x) => x !== sha) })} />
        ))}
        <button className="btn small" onClick={() => setPicking(true)}>
          <GitCommitHorizontal size={12} /> {t('comments.linkCommit')}
        </button>
      </div>
      {picking && <CommitPicker onPick={(sha) => onChange({ commits: [...new Set([...item.commits, sha])], status: item.status === 'todo' ? 'done' : item.status })} onClose={() => setPicking(false)} />}
    </li>
  );
}

function LetterPaste({ onClose, onAdd }: { onClose: () => void; onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <Modal
      title={t('review.fromLetter')}
      onClose={onClose}
      size="medium"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn--primary" disabled={!text.trim()} onClick={() => onAdd(text)}>
            {t('review.split', { n: itemsFromLetter(text).length })}
          </button>
        </>
      }
    >
      <p className="hint">{t('review.letterHint')}</p>
      <textarea className="input" rows={14} autoFocus value={text} onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}
