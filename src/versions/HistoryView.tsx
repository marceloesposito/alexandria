// Schermata History, pensata per chi non conosce git (stile GitHub Desktop):
// a sinistra la variante, il riquadro "Salva una versione" e la storia; al centro la pergamena
// come documento. Passando su una versione della storia, il centro si divide in due colonne:
// quella versione e la versione attuale, con le differenze evidenziate.
import { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, ChevronDown, Save, RotateCcw, X, ScrollText, CloudUpload, CloudDownload, Bot, HelpCircle } from 'lucide-react';
import { useVersions } from './store';
import { MergeView } from './MergeView';
import { DocView, DocCompare } from './DocCompare';
import { docDiff, diffCounts } from './docDiff';
import { platform, type FileChange, type GitCommit } from '../platform';
import { useWorkspace } from '../state/workspace';
import { summarize, suggestCommitMessage, docTitle, lineStats } from './diffSummary';
import { isCheckpoint } from './graph';
import { t, tn, useLang, getLang } from '../i18n';
import { commit, restoreVersion, saveAll, switchBranch, workingChanges } from './actions';
import { confirmDialog } from '../components/confirm';
import { openContextMenu } from '../components/ContextMenu';
import { runCommand } from '../commands/registry';
import { abs } from '../vault/paths';

/** "5 minuti fa", "ieri", "3 giorni fa"... */
function ago(sec: number): string {
  const rtf = new Intl.RelativeTimeFormat(getLang(), { numeric: 'auto' });
  const d = sec - Date.now() / 1000;
  const abs_ = Math.abs(d);
  if (abs_ < 60) return rtf.format(Math.round(d), 'second');
  if (abs_ < 3600) return rtf.format(Math.round(d / 60), 'minute');
  if (abs_ < 86400) return rtf.format(Math.round(d / 3600), 'hour');
  if (abs_ < 86400 * 30) return rtf.format(Math.round(d / 86400), 'day');
  return new Date(sec * 1000).toLocaleDateString(getLang());
}

function titleOf(c: GitCommit): string {
  return isCheckpoint(c) ? t('hist.autosave') : c.message.split('\n')[0];
}

/** Variante corrente (branch) con il menu per cambiarla, crearne una o unirne due. */
function BranchBar() {
  const log = useVersions((s) => s.log);
  const branch = log?.branch ?? 'main';
  const open = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const others = (log?.branches ?? []).filter((b) => b.name !== branch);
    openContextMenu({ clientX: r.left, clientY: r.bottom + 4 }, [
      ...others.map((b) => ({ label: t('hist.switchTo', { name: b.name }), onClick: () => void switchBranch(b.name) })),
      ...(others.length ? [{ sep: true, label: '' }] : []),
      { label: t('hist.newVariant'), onClick: () => void runCommand('vc.newBranch') },
      { label: t('hist.mergeVariant'), disabled: !others.length, onClick: () => void runCommand('vc.merge') },
      { sep: true, label: '' },
      { label: t('hist.sync.setup'), onClick: () => void runCommand('vc.remote') },
    ]);
  };
  return (
    <div className="hist__branch">
      <button className="hist__branch-btn" onClick={open} title={t('hist.variantHint')}>
        <GitBranch size={15} />
        <span className="hist__branch-text">
          <small>{t('hist.variant')}</small>
          <strong>{branch}</strong>
        </span>
        <ChevronDown size={14} />
      </button>
      <button className="icon-btn" title={t('cmd.vc.pull')} onClick={() => void runCommand('vc.pull')}>
        <CloudDownload size={15} />
      </button>
      <button className="icon-btn" title={t('cmd.vc.push')} onClick={() => void runCommand('vc.push')}>
        <CloudUpload size={15} />
      </button>
    </div>
  );
}

/** "Salva una versione": cosa e' cambiato dall'ultima versione, un titolo, un pulsante. */
function CommitBox({ onDoc }: { onDoc: (rel: string) => void }) {
  const log = useVersions((s) => s.log);
  const suggest = useWorkspace((s) => s.app.prefs.suggestCommitMessage);
  const [changes, setChanges] = useState<FileChange[] | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const touched = useRef(false);

  useEffect(() => {
    let off = false;
    void (async () => {
      await saveAll();
      const ch = await workingChanges();
      if (off) return;
      setChanges(ch);
      if (suggest && !touched.current) setTitle(ch.length ? suggestCommitMessage(summarize(ch)) : '');
    })();
    return () => {
      off = true;
    };
  }, [log, suggest]);

  const docs = (changes ?? []).filter((c) => c.path.startsWith('documents/') && c.path.endsWith('.md'));
  const others = (changes ?? []).length - docs.length;
  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const msg = desc.trim() ? `${title.trim()}\n\n${desc.trim()}` : title.trim();
    if (await commit(msg, true)) {
      touched.current = false;
      setTitle('');
      setDesc('');
    }
    setBusy(false);
  };

  return (
    <section className="hist__commit">
      <header className="hist__section-head">
        <Save size={13} /> {t('hist.saveTitle')}
        <span className="hist__help" title={t('hist.saveHint')}>
          <HelpCircle size={13} />
        </span>
      </header>
      {changes === null ? (
        <p className="hint">{t('vc.loading')}</p>
      ) : !changes.length ? (
        <p className="hint hist__clean">{log?.head ? t('hist.nothing') : t('hist.firstVersion')}</p>
      ) : (
        <>
          <ul className="hist__changes">
            {docs.map((c) => {
              const s = lineStats(c.before, c.after);
              return (
                <li key={c.path}>
                  <button onClick={() => onDoc(c.path)} title={t('hist.showDoc')}>
                    <ScrollText size={13} />
                    <span className="hist__change-name">{docTitle(c.path)}</span>
                    <span className="hist__change-stat">
                      {c.status === 'added' ? t('hist.new') : c.status === 'deleted' ? t('hist.deleted') : `+${s.added} −${s.removed}`}
                    </span>
                  </button>
                </li>
              );
            })}
            {others > 0 && <li className="hint hist__others">{tn('hist.otherChanges', others)}</li>}
          </ul>
          <input
            className="input"
            value={title}
            placeholder={t('hist.titlePlaceholder')}
            onChange={(e) => {
              touched.current = true;
              setTitle(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
          />
          <textarea className="input" rows={2} value={desc} placeholder={t('hist.descPlaceholder')} onChange={(e) => setDesc(e.target.value)} />
          <button className="btn btn--primary hist__save" disabled={!title.trim() || busy} onClick={() => void save()}>
            <Save size={14} /> {t('hist.saveOn', { branch: log?.branch ?? 'main' })}
          </button>
        </>
      )}
    </section>
  );
}

/** La storia come linea verticale: passando su una versione si vede il confronto, cliccando lo si fissa. */
function HistoryList({ hover, onHover }: { hover: string | null; onHover: (sha: string | null) => void }) {
  const log = useVersions((s) => s.log);
  const selected = useVersions((s) => s.selected);
  const [showAuto, setShowAuto] = useState(false);
  const commits = (log?.commits ?? []).filter((c) => showAuto || !isCheckpoint(c));
  const autos = (log?.commits ?? []).filter(isCheckpoint).length;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enter = (sha: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onHover(sha), 90);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onHover(null), 150);
  };

  const menu = (c: GitCommit, e: React.MouseEvent) =>
    openContextMenu(e, [
      { label: t('hist.restore'), onClick: () => void restore(c) },
      { label: t('hist.variantFromHere'), onClick: () => void runCommand('vc.newBranch') },
    ]);

  return (
    <section className="hist__list-wrap">
      <header className="hist__section-head">
        {t('hist.historyTitle')}
        <span className="grow" />
        {autos > 0 && (
          <button className="hist__toggle" onClick={() => setShowAuto(!showAuto)} title={t('hist.autoHint')}>
            <Bot size={12} /> {showAuto ? t('hist.hideAuto') : tn('hist.showAuto', autos)}
          </button>
        )}
      </header>
      {!commits.length ? (
        <p className="hint">{t('hist.noVersions')}</p>
      ) : (
        <ol className="hist__list" onMouseLeave={leave}>
          {commits.map((c, i) => (
            <li
              key={c.sha}
              className={`hist__item ${c.sha === selected ? 'is-selected' : ''} ${c.sha === hover ? 'is-hover' : ''} ${isCheckpoint(c) ? 'is-auto' : ''} ${c.sha === log?.head ? 'is-head' : ''}`}
              onMouseEnter={() => enter(c.sha)}
              onClick={() => useVersions.getState().select(c.sha === selected ? null : c.sha)}
              onContextMenu={(e) => menu(c, e)}
            >
              <span className="hist__dot" aria-hidden />
              {i < commits.length - 1 && <span className="hist__line" aria-hidden />}
              <span className="hist__item-text">
                <span className="hist__item-title">{titleOf(c)}</span>
                <span className="hist__item-meta">
                  {ago(c.time)} · {c.author}
                  {c.refs.filter((r) => !r.includes('/')).map((r) => (
                    <span key={r} className="hist__ref">
                      {r}
                    </span>
                  ))}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

async function restore(c: GitCommit) {
  const label = titleOf(c);
  if (await confirmDialog(t('hist.restoreConfirm', { label }), t('hist.restoreHint'))) await restoreVersion(c.sha, label);
}

export function HistoryView() {
  useLang();
  const merging = useVersions((s) => s.merging);
  const log = useVersions((s) => s.log);
  const selected = useVersions((s) => s.selected);
  const root = useWorkspace((s) => s.vaultRoot);
  const docs = useWorkspace((s) => s.docs);
  const activeDoc = useWorkspace((s) => s.activeDoc);
  const [doc, setDoc] = useState<string | null>(activeDoc);
  const [hover, setHover] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [past, setPast] = useState<{ sha: string; text: string | null } | null>(null);

  useEffect(() => {
    void saveAll().then(() => useVersions.getState().refresh());
  }, []);
  useEffect(() => {
    if (!doc && activeDoc) setDoc(activeDoc);
  }, [activeDoc, doc]);

  // versione attuale della pergamena (dal disco, gia' salvata)
  useEffect(() => {
    if (!root || !doc) return;
    let off = false;
    void platform.readText(abs(root, doc)).then((txt) => !off && setCurrent(txt), () => !off && setCurrent(''));
    return () => {
      off = true;
    };
  }, [root, doc, log]);

  // versione da confrontare: quella sotto il mouse, altrimenti quella fissata col clic
  const sha = hover ?? selected;
  useEffect(() => {
    if (!root || !doc || !sha) {
      setPast(null);
      return;
    }
    let off = false;
    void platform.gitReadAt(root, sha, doc).then((txt) => !off && setPast({ sha, text: txt }));
    return () => {
      off = true;
    };
  }, [root, doc, sha]);

  const commit_ = log?.commits.find((c) => c.sha === past?.sha) ?? null;
  const counts = useMemo(() => (past && current !== null ? diffCounts(docDiff(past.text ?? '', current)) : null), [past, current]);

  if (merging) return <MergeView merge={merging} />;

  const comparing = !!(past && commit_ && current !== null);
  return (
    <div className="hist">
      <aside className="hist__side">
        <BranchBar />
        <CommitBox onDoc={setDoc} />
        <HistoryList hover={hover} onHover={setHover} />
      </aside>
      <main className="hist__main">
        <header className="hist__main-head">
          <label className="hist__doc-pick">
            <ScrollText size={14} />
            <select className="select" value={doc ?? ''} onChange={(e) => setDoc(e.target.value)} aria-label={t('hist.pickDoc')}>
              {docs.map((d) => (
                <option key={d.rel} value={d.rel}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>
          <span className="grow" />
          {comparing && counts && (
            <span className="hist__counts">
              {counts.changed > 0 && <span className="is-mod">{tn('hist.cnt.changed', counts.changed)}</span>}
              {counts.added > 0 && <span className="is-add">{tn('hist.cnt.added', counts.added)}</span>}
              {counts.removed > 0 && <span className="is-del">{tn('hist.cnt.removed', counts.removed)}</span>}
              {!counts.changed && !counts.added && !counts.removed && <span>{t('hist.cnt.same')}</span>}
            </span>
          )}
          {selected && commit_ && !hover && (
            <>
              <button className="btn small" onClick={() => void restore(commit_)}>
                <RotateCcw size={13} /> {t('hist.restore')}
              </button>
              <button className="icon-btn" title={t('hist.closeCompare')} onClick={() => useVersions.getState().select(null)}>
                <X size={15} />
              </button>
            </>
          )}
        </header>
        {comparing ? (
          <>
            <div className="hist__cols-head">
              <div>
                <small>{new Date(commit_!.time * 1000).toLocaleString(getLang(), { dateStyle: 'medium', timeStyle: 'short' })}</small>
                <strong>{titleOf(commit_!)}</strong>
              </div>
              <div>
                <small>{t('hist.now')}</small>
                <strong>{t('hist.current')}</strong>
              </div>
            </div>
            <div className="hist__scroll">
              <DocCompare before={past!.text ?? ''} after={current!} beforeMissing={past!.text === null} />
            </div>
          </>
        ) : (
          <>
            <div className="hist__cols-head is-single">
              <div>
                <small>{t('hist.now')}</small>
                <strong>{t('hist.current')}</strong>
              </div>
              <span className="hint">{t('hist.hoverHint')}</span>
            </div>
            <div className="hist__scroll">{current === null ? <p className="hint">{t('vc.loading')}</p> : <DocView markdown={current} />}</div>
          </>
        )}
      </main>
    </div>
  );
}

