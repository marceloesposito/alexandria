// Modulo Version control: vista, dialoghi, comandi e checkpoint automatici.
import { GitCommitHorizontal, Save, GitBranch, GitBranchPlus, GitMerge, GitCompare, RotateCcw, Cloud, CloudUpload, CloudDownload } from 'lucide-react';
import { registerCommands } from '../commands/registry';
import { viewComponents } from '../shell/views';
import { registerDialog } from '../shell/DialogHost';
import { HistoryView } from './HistoryView';
import { CommitDialog, NewBranchDialog, SwitchBranchDialog, MergeDialog } from './dialogs';
import { RemoteDialog } from './RemoteDialog';
import { OpenRemoteDialog } from './OpenRemoteDialog';
import { useWorkspace, ws } from '../state/workspace';
import { useVersions } from './store';
import { checkpoint, push, pull, restoreVersion, startAutoCheckpoints, noteEdit } from './actions';
import { onAfterSave } from '../editor/session';
import { t } from '../i18n';
import { confirmDialog } from '../components/confirm';
import { platform } from '../platform';

export function registerVersions() {
  viewComponents.versions = HistoryView;
  registerDialog('commit', CommitDialog);
  registerDialog('newBranch', NewBranchDialog);
  registerDialog('switchBranch', SwitchBranchDialog);
  registerDialog('merge', MergeDialog);
  registerDialog('remote', RemoteDialog);
  registerDialog('openRemote', OpenRemoteDialog);

  const hasRepo = () => !!useVersions.getState().log;
  registerCommands([
    { id: 'vc.commit', label: 'cmd.vc.commit', icon: GitCommitHorizontal, shortcut: 'Mod+Shift+C', category: 'versions', run: () => ws().openDialog('commit') },
    {
      id: 'vc.checkpoint',
      label: 'cmd.vc.checkpoint',
      icon: Save,
      category: 'versions',
      run: async () => {
        const sha = await checkpoint();
        ws().toast(sha ? t('vc.checkpointDone') : t('vc.nothingToCommit'), sha ? 'ok' : 'info');
      },
    },
    { id: 'vc.newBranch', label: 'cmd.vc.newBranch', icon: GitBranchPlus, category: 'versions', isEnabled: hasRepo, run: () => ws().openDialog('newBranch') },
    { id: 'vc.switchBranch', label: 'cmd.vc.switchBranch', icon: GitBranch, category: 'versions', isEnabled: hasRepo, run: () => ws().openDialog('switchBranch') },
    { id: 'vc.merge', label: 'cmd.vc.merge', icon: GitMerge, category: 'versions', isEnabled: hasRepo, run: () => ws().openDialog('merge') },
    {
      id: 'vc.compare',
      label: 'cmd.vc.compare',
      icon: GitCompare,
      category: 'versions',
      run: () => {
        ws().setView('versions');
        ws().toast(t('vc.compareHint'), 'info');
      },
    },
    {
      id: 'vc.restore',
      label: 'cmd.vc.restore',
      icon: RotateCcw,
      category: 'versions',
      isEnabled: () => !!useVersions.getState().selected && useVersions.getState().selected !== 'WORKTREE',
      run: async () => {
        const st = useVersions.getState();
        const c = st.log?.commits.find((x) => x.sha === st.selected);
        if (!c) return;
        const label = c.message.split('\n')[0];
        if (await confirmDialog(t('vc.restore.confirm', { label }), t('vc.restore.hint'))) await restoreVersion(c.sha, label);
      },
    },
    { id: 'vc.remote', label: 'cmd.vc.remote', icon: Cloud, category: 'versions', run: () => ws().openDialog('remote') },
    { id: 'vc.push', label: 'cmd.vc.push', icon: CloudUpload, category: 'versions', run: () => push() },
    { id: 'vc.pull', label: 'cmd.vc.pull', icon: CloudDownload, category: 'versions', run: () => pull() },
  ]);

  // checkpoint automatici: attivi quando c'e' un vault
  let stop: (() => void) | null = null;
  useWorkspace.subscribe((s, p) => {
    if (s.ready && !p.ready) stop = startAutoCheckpoints();
    // i commit portano il nome scelto nelle preferenze
    const author = s.app.prefs.authorName;
    if (s.vaultRoot && (s.vaultRoot !== p.vaultRoot || author !== p.app.prefs.authorName)) {
      void platform.gitSetAuthor(s.vaultRoot, author).catch(() => undefined);
    }
  });
  onAfterSave(() => {
    noteEdit();
    void useVersions.getState().refresh();
  });
  window.addEventListener('beforeunload', () => stop?.());
}
