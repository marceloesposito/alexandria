// Merge manuale: diff unificato con le regioni in conflitto risolvibili sul posto
// (mio / loro / entrambi / modifica). I file accanto in JSON si uniscono da soli.
import { useMemo, useState } from 'react';
import { GitMerge, X, Check } from 'lucide-react';
import type { MergeResult } from '../platform';
import { mergeText, resolveText, conflictsLeft, mergeJsonText, withMarkers, type MergeChunk, type Choice } from './merge';
import { completeMerge, abortMerge } from './actions';
import { t } from '../i18n';
import { docTitle } from './diffSummary';
import { isDocPath } from '../vault/paths';

interface FileState {
  path: string;
  kind: 'text' | 'json' | 'binary';
  chunks: MergeChunk[];
  auto: string | null; // risultato automatico (json)
  binaryChoice: 'ours' | 'theirs' | null;
  oursExists: boolean;
  theirsExists: boolean;
}

function initial(m: MergeResult): FileState[] {
  return m.conflicts.map((c) => {
    if (c.binary) return { path: c.path, kind: 'binary', chunks: [], auto: null, binaryChoice: null, oursExists: c.ours !== null, theirsExists: c.theirs !== null };
    if (c.path.endsWith('.json')) {
      const auto = mergeJsonText(c.base, c.ours, c.theirs);
      if (auto !== null)
        return { path: c.path, kind: 'json', chunks: [], auto, binaryChoice: null, oursExists: true, theirsExists: true };
    }
    return {
      path: c.path,
      kind: 'text',
      chunks: mergeText(c.base, c.ours, c.theirs),
      auto: null,
      binaryChoice: null,
      oursExists: c.ours !== null,
      theirsExists: c.theirs !== null,
    };
  });
}

export function MergeView({ merge }: { merge: MergeResult }) {
  const [files, setFiles] = useState<FileState[]>(() => initial(merge));
  const [message, setMessage] = useState(() => t('vc.merge.message'));
  const [busy, setBusy] = useState(false);
  const left = useMemo(
    () => files.reduce((n, f) => n + (f.kind === 'text' ? conflictsLeft(f.chunks) : 0), 0),
    [files],
  );

  const choose = (fi: number, ci: number, choice: Choice, custom?: string) => {
    setFiles((fs) =>
      fs.map((f, i) =>
        i !== fi
          ? f
          : {
              ...f,
              chunks: f.chunks.map((c, j) => (j === ci && c.kind === 'conflict' ? { ...c, choice, custom: custom ?? c.custom } : c)),
            },
      ),
    );
  };

  const finish = async () => {
    setBusy(true);
    // i file binari restano nella versione di questo branch (gia' nella cartella di lavoro)
    const resolved = files
      .filter((f) => f.kind !== 'binary')
      .map((f) => ({
        path: f.path,
        content: f.kind === 'json' ? f.auto : (resolveText(f.chunks) ?? withMarkers(f.chunks)),
      }));
    await completeMerge(resolved, message);
    setBusy(false);
  };

  return (
    <div className="merge">
      <header className="merge__head">
        <GitMerge size={16} />
        <strong>{t('vc.merge.title')}</strong>
        <span className="hint">{left ? t('vc.merge.left', { n: left }) : t('vc.merge.ready')}</span>
        <span className="grow" />
        <input className="input merge__msg" value={message} onChange={(e) => setMessage(e.target.value)} />
        <button className="btn" onClick={() => void abortMerge()} disabled={busy}>
          <X size={14} /> {t('vc.merge.abort')}
        </button>
        <button className="btn btn--primary" disabled={!!left || busy} onClick={() => void finish()}>
          <Check size={14} /> {t('vc.merge.complete')}
        </button>
      </header>
      <div className="merge__files">
        {files.map((f, fi) => (
          <section key={f.path} className="merge__file">
            <h3>{isDocPath(f.path) ? docTitle(f.path) : f.path}</h3>
            {f.kind === 'json' && <p className="hint">{t('vc.merge.jsonAuto')}</p>}
            {f.kind === 'binary' && <p className="hint">{t('vc.merge.binary')}</p>}
            {f.kind === 'text' &&
              f.chunks.map((c, ci) =>
                c.kind === 'ok' ? (
                  <div key={ci} className="merge__ok">
                    {c.lines.filter((l) => l.trim()).slice(0, 2).map((l, k) => (
                      <div key={k} className="merge__line">
                        {l}
                      </div>
                    ))}
                    {c.lines.filter((l) => l.trim()).length > 2 && <div className="diff__skip">…</div>}
                  </div>
                ) : (
                  <Conflict key={ci} c={c} onChoose={(choice, custom) => choose(fi, ci, choice, custom)} />
                ),
              )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Conflict({ c, onChoose }: { c: Extract<MergeChunk, { kind: 'conflict' }>; onChoose: (c: Choice, custom?: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.custom);
  return (
    <div className={`conflict ${c.choice ? 'is-resolved' : ''}`}>
      <div className={`conflict__side is-ours ${c.choice === 'ours' || c.choice === 'both' ? 'is-chosen' : ''}`}>
        <div className="conflict__label">{t('vc.merge.ours')}</div>
        {c.ours.length ? c.ours.map((l, i) => <div key={i}>{l || ' '}</div>) : <em className="hint">{t('vc.merge.empty')}</em>}
      </div>
      <div className={`conflict__side is-theirs ${c.choice === 'theirs' || c.choice === 'both' ? 'is-chosen' : ''}`}>
        <div className="conflict__label">{t('vc.merge.theirs')}</div>
        {c.theirs.length ? c.theirs.map((l, i) => <div key={i}>{l || ' '}</div>) : <em className="hint">{t('vc.merge.empty')}</em>}
      </div>
      {editing && (
        <textarea className="input conflict__edit" rows={Math.max(3, text.split('\n').length)} value={text} onChange={(e) => setText(e.target.value)} />
      )}
      <div className="conflict__actions">
        <button className={`btn small ${c.choice === 'ours' ? 'btn--primary' : ''}`} onClick={() => onChoose('ours')}>
          {t('vc.merge.keepOurs')}
        </button>
        <button className={`btn small ${c.choice === 'theirs' ? 'btn--primary' : ''}`} onClick={() => onChoose('theirs')}>
          {t('vc.merge.keepTheirs')}
        </button>
        <button className={`btn small ${c.choice === 'both' ? 'btn--primary' : ''}`} onClick={() => onChoose('both')}>
          {t('vc.merge.keepBoth')}
        </button>
        {editing ? (
          <button
            className="btn small btn--primary"
            onClick={() => {
              onChoose('custom', text);
              setEditing(false);
            }}
          >
            {t('vc.merge.useEdit')}
          </button>
        ) : (
          <button
            className={`btn small ${c.choice === 'custom' ? 'btn--primary' : ''}`}
            onClick={() => {
              setText(c.choice === 'theirs' ? c.theirs.join('\n') : c.ours.join('\n') + (c.choice === 'both' ? '\n\n' + c.theirs.join('\n') : ''));
              setEditing(true);
            }}
          >
            {t('vc.merge.edit')}
          </button>
        )}
      </div>
    </div>
  );
}
