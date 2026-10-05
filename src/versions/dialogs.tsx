// Dialoghi del version control: commit, nuovo branch, cambio branch, merge, remoto.
import { useEffect, useState } from 'react';
import { GitBranch, Check } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWorkspace } from '../state/workspace';
import { useVersions } from './store';
import { t } from '../i18n';
import { commit, createBranch, switchBranch, startMerge, saveAll, workingChanges } from './actions';
import { summarize, suggestCommitMessage, describeSummary, type ChangeSummary } from './diffSummary';

const close = () => useWorkspace.getState().closeDialog();

export function CommitDialog() {
  const suggest = useWorkspace((s) => s.app.prefs.suggestCommitMessage);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState<ChangeSummary | null>(null);
  const [fold, setFold] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void (async () => {
      await saveAll();
      await useVersions.getState().refresh();
      const s = summarize(await workingChanges());
      setSummary(s);
      if (suggest) setMessage((m) => m || suggestCommitMessage(s));
    })();
  }, [suggest]);
  const submit = async () => {
    if (!message.trim()) return;
    setBusy(true);
    if (await commit(message, fold)) close();
    setBusy(false);
  };
  return (
    <Modal
      title={t('vc.commit.title')}
      onClose={close}
      footer={
        <>
          <label className="check">
            <input type="checkbox" checked={fold} onChange={(e) => setFold(e.target.checked)} />
            {t('vc.commit.fold')}
          </label>
          <span className="grow" />
          <button className="btn" onClick={close}>
            {t('common.cancel')}
          </button>
          <button className="btn btn--primary" disabled={!message.trim() || busy} onClick={submit}>
            <Check size={14} /> {t('cmd.vc.commit')}
          </button>
        </>
      }
    >
      <p className="hint">{summary ? describeSummary(summary) : t('vc.loading')}</p>
      <label className="field-label">{t('vc.commit.message')}</label>
      <textarea
        className="input"
        rows={3}
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit();
        }}
      />
      <p className="hint">{t('vc.commit.hint')}</p>
    </Modal>
  );
}

export function NewBranchDialog() {
  const selected = useVersions((s) => s.selected);
  const log = useVersions((s) => s.log);
  const [name, setName] = useState('');
  const [switchTo, setSwitchTo] = useState(true);
  const from = selected && selected !== 'WORKTREE' ? selected : log?.head ?? null;
  const fromLabel = log?.commits.find((c) => c.sha === from)?.message.split('\n')[0] ?? '';
  const submit = async () => {
    if (await createBranch(name, from, switchTo)) close();
  };
  return (
    <Modal
      title={t('vc.newBranch.title')}
      onClose={close}
      size="small"
      footer={
        <>
          <button className="btn" onClick={close}>
            {t('common.cancel')}
          </button>
          <button className="btn btn--primary" disabled={!name.trim()} onClick={submit}>
            <GitBranch size={14} /> {t('cmd.vc.newBranch')}
          </button>
        </>
      }
    >
      <input className="input" autoFocus placeholder={t('vc.newBranch.placeholder')} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <p className="hint">{t('vc.newBranch.from', { label: fromLabel || '—' })}</p>
      <label className="check">
        <input type="checkbox" checked={switchTo} onChange={(e) => setSwitchTo(e.target.checked)} />
        {t('vc.newBranch.switch')}
      </label>
    </Modal>
  );
}

export function SwitchBranchDialog() {
  const log = useVersions((s) => s.log);
  return (
    <Modal title={t('cmd.vc.switchBranch')} onClose={close} size="small">
      <ul className="pick-list">
        {log?.branches.map((b) => (
          <li key={b.name}>
            <button
              className={`pick-list__item ${b.name === log.branch ? 'is-active' : ''}`}
              onClick={async () => {
                if (b.name !== log.branch) await switchBranch(b.name);
                close();
              }}
            >
              <GitBranch size={14} /> {b.name}
              {b.name === log.branch && <span className="hint"> · {t('vc.current')}</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">{t('vc.switch.hint')}</p>
    </Modal>
  );
}

export function MergeDialog() {
  const log = useVersions((s) => s.log);
  const others = log?.branches.filter((b) => b.name !== log.branch) ?? [];
  return (
    <Modal title={t('vc.merge.dialog', { name: log?.branch ?? '' })} onClose={close} size="small">
      {others.length ? (
        <ul className="pick-list">
          {others.map((b) => (
            <li key={b.name}>
              <button
                className="pick-list__item"
                onClick={async () => {
                  close();
                  await startMerge(b.name);
                }}
              >
                <GitBranch size={14} /> {b.name}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{t('vc.merge.noOthers')}</p>
      )}
      <p className="hint">{t('vc.merge.hint')}</p>
    </Modal>
  );
}
