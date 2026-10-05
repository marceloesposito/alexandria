// Mini navbar: Bookshelf · Scriptorium · History | Library, piu' vault, branch e stato del salvataggio.
import { Library, Landmark, PenLine, History, GitBranch, CircleCheck, CircleDot, LoaderCircle, CircleAlert } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { runCommand, getCommand, displayShortcut } from '../commands/registry';
import { useCommandTick } from './useCommands';
import { WorkspaceSwitcher } from './WorkspaceMenu';
import { t, useLang } from '../i18n';
import { useVersions } from '../versions/store';

export function NavBar() {
  useLang();
  const vault = useWorkspace((s) => s.vault);
  const saveState = useWorkspace((s) => s.saveState);
  const branch = useVersions((s) => s.log?.branch ?? null);
  const docTitle = useWorkspace((s) => s.docs.find((d) => d.rel === s.activeDoc)?.title ?? '');

  useCommandTick();
  // la Library sta fuori dal vault: tab separata in fondo
  const tabs = [
    { cmd: 'view.resources', icon: Library, label: t('nav.resources'), color: 'var(--series-1)' },
    { cmd: 'view.editor', icon: PenLine, label: t('nav.editor'), color: 'var(--series-2)' },
    { cmd: 'view.versions', icon: History, label: t('nav.versions'), color: 'var(--series-3)' },
    { cmd: 'view.library', icon: Landmark, label: t('nav.library'), color: 'var(--series-4)', apart: true },
  ];
  const isActive = (cmd: string) => getCommand(cmd)?.isActive?.() ?? false;

  const SaveIcon = saveState === 'saved' ? CircleCheck : saveState === 'saving' ? LoaderCircle : saveState === 'error' ? CircleAlert : CircleDot;

  return (
    <nav className="navbar">
      <div className="navbar__tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.cmd}
            role="tab"
            aria-selected={isActive(tab.cmd)}
            className={`navbar__tab ${isActive(tab.cmd) ? 'is-active' : ''} ${tab.apart ? 'navbar__tab--apart' : ''}`}
            onClick={() => runCommand(tab.cmd)}
            title={getCommand(tab.cmd)?.shortcut ? `${tab.label} (${displayShortcut(getCommand(tab.cmd)!.shortcut!)})` : tab.label}
            style={{ '--section': tab.color } as React.CSSProperties}
          >
            <tab.icon size={20} strokeWidth={1.7} className="navbar__tab-icon" />
            <span className="navbar__tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="navbar__context">
        <WorkspaceSwitcher />
        <span className="navbar__vault" title={useWorkspace.getState().vaultRoot ?? ''}>
          {vault?.name}
        </span>
        {docTitle && <span className="navbar__doc">/ {docTitle}</span>}
        {branch && (
          <button className="navbar__branch" onClick={() => runCommand('vc.switchBranch')} title={t('nav.branch')}>
            <GitBranch size={13} /> {branch}
          </button>
        )}
        <span className={`navbar__save is-${saveState}`} title={t(`save.${saveState}`)}>
          <SaveIcon size={13} className={saveState === 'saving' ? 'spin' : ''} />
          <span>{t(`save.${saveState}`)}</span>
        </span>
      </div>
    </nav>
  );
}
