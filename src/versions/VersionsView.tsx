// Schermata Version control: timeline in alto, dettagli e confronto della versione scelta sotto.
import { useEffect, useMemo, useState } from 'react';
import { GitCommitHorizontal, FileText, RotateCcw, GitBranch, ArrowLeftRight } from 'lucide-react';
import { Timeline } from './Timeline';
import { useVersions } from './store';
import { MergeView } from './MergeView';
import { DiffView } from './DiffView';
import { platform, type FileChange } from '../platform';
import { useWorkspace } from '../state/workspace';
import { summarize, describeSummary, docTitle } from './diffSummary';
import { t, useLang } from '../i18n';
import { restoreVersion, saveAll } from './actions';
import { confirmDialog } from '../components/confirm';
import { runCommand } from '../commands/registry';

export function VersionsView() {
  useLang();
  const merging = useVersions((s) => s.merging);
  const log = useVersions((s) => s.log);
  const selected = useVersions((s) => s.selected);
  const compareWith = useVersions((s) => s.compareWith);
  const root = useWorkspace((s) => s.vaultRoot);
  const [changes, setChanges] = useState<FileChange[] | null>(null);
  const [file, setFile] = useState<string | null>(null);

  useEffect(() => {
    void saveAll().then(() => useVersions.getState().refresh());
  }, []);

  // versione mostrata: quella scelta, altrimenti l'ultima
  const sha = selected ?? log?.head ?? null;
  const commit = log?.commits.find((c) => c.sha === sha) ?? null;

  useEffect(() => {
    if (!root || !sha) {
      setChanges(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      let ch: FileChange[];
      if (compareWith && compareWith !== sha) {
        const a = log?.commits.find((c) => c.sha === compareWith);
        const b = log?.commits.find((c) => c.sha === sha);
        // dal piu' vecchio al piu' recente
        const [from, to] = a && b && a.time > b.time ? [sha, compareWith] : [compareWith, sha];
        ch = await platform.gitCompare(root, from, to);
      } else if (sha === 'WORKTREE') {
        ch = log?.head ? await platform.gitCompare(root, log.head, 'WORKTREE') : [];
      } else ch = await platform.gitChanges(root, sha);
      if (cancelled) return;
      setChanges(ch);
      const docs = ch.filter((c) => c.path.startsWith('documents/'));
      setFile((f) => (f && ch.some((c) => c.path === f) ? f : (docs[0] ?? ch[0])?.path ?? null));
    })();
    return () => {
      cancelled = true;
    };
  }, [root, sha, compareWith, log]);

  const summary = useMemo(() => (changes ? summarize(changes) : null), [changes]);
  const current = changes?.find((c) => c.path === file) ?? null;

  if (merging) {
    return (
      <div className="versions">
        <Timeline />
        <MergeView merge={merging} />
      </div>
    );
  }

  const label = commit?.message.split('\n')[0] ?? '';

  return (
    <div className="versions">
      <Timeline />
      <div className="versions__body">
        <aside className="versions__details">
          {sha === 'WORKTREE' ? (
            <>
              <h2 className="versions__title">{t('vc.wipTitle')}</h2>
              <p className="hint">{t('vc.wipHint')}</p>
              <button className="btn btn--primary" onClick={() => runCommand('vc.commit')}>
                <GitCommitHorizontal size={14} /> {t('cmd.vc.commit')}
              </button>
            </>
          ) : commit ? (
            <>
              <h2 className="versions__title">{commit.message.startsWith('checkpoint:') ? t('vc.checkpoint') : label}</h2>
              <div className="hint">
                {new Date(commit.time * 1000).toLocaleString()} · {commit.author} · <code>{commit.sha.slice(0, 7)}</code>
              </div>
              {compareWith && compareWith !== sha && (
                <div className="versions__compare">
                  <ArrowLeftRight size={13} /> {t('vc.comparing', { sha: compareWith.slice(0, 7) })}
                  <button className="btn small" onClick={() => useVersions.getState().setCompare(null)}>
                    {t('common.close')}
                  </button>
                </div>
              )}
              {summary && <p className="versions__summary">{describeSummary(summary)}</p>}
              <div className="versions__actions">
                <button
                  className="btn small"
                  onClick={async () => {
                    if (await confirmDialog(t('vc.restore.confirm', { label }), t('vc.restore.hint'))) await restoreVersion(commit.sha, label);
                  }}
                >
                  <RotateCcw size={13} /> {t('cmd.vc.restore')}
                </button>
                <button className="btn small" onClick={() => runCommand('vc.newBranch')}>
                  <GitBranch size={13} /> {t('vc.branchFromHere')}
                </button>
              </div>
            </>
          ) : (
            <p className="hint">{t('vc.noHistory')}</p>
          )}
          {changes && changes.length > 0 && (
            <ul className="versions__files">
              {changes.map((c) => (
                <li key={c.path}>
                  <button className={`versions__file ${c.path === file ? 'is-active' : ''} is-${c.status}`} onClick={() => setFile(c.path)}>
                    <FileText size={13} />
                    <span>{c.path.startsWith('documents/') ? docTitle(c.path) : c.path}</span>
                    <span className="versions__status">{t(`vc.status.${c.status}`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="versions__diff">
          {current ? (
            current.binary ? (
              <p className="hint">{t('vc.diff.binary')}</p>
            ) : (
              <DiffView before={current.before ?? ''} after={current.after ?? ''} />
            )
          ) : (
            <p className="hint">{t('vc.diff.pick')}</p>
          )}
        </section>
      </div>
    </div>
  );
}
