// Mini navbar: Risorse · Editor · Versioni, piu' vault, branch e stato del salvataggio.
import { Library, PenLine, History, GitBranch, CircleCheck, CircleDot, LoaderCircle, CircleAlert } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { runCommand } from '../commands/registry';
import { t, useLang } from '../i18n';
import { useVersions } from '../versions/store';

export function NavBar() {
  useLang();
  const view = useWorkspace((s) => s.app.view);
  const vault = useWorkspace((s) => s.vault);
  const saveState = useWorkspace((s) => s.saveState);
  const branch = useVersions((s) => s.log?.branch ?? null);
  const docTitle = useWorkspace((s) => s.docs.find((d) => d.rel === s.activeDoc)?.title ?? '');

  const tabs = [
    { id: 'resources', cmd: 'view.resources', icon: Library, label: t('nav.resources') },
    { id: 'editor', cmd: 'view.editor', icon: PenLine, label: t('nav.editor') },
    { id: 'versions', cmd: 'view.versions', icon: History, label: t('nav.versions') },
  ] as const;

  const SaveIcon = saveState === 'saved' ? CircleCheck : saveState === 'saving' ? LoaderCircle : saveState === 'error' ? CircleAlert : CircleDot;

  return (
    <nav className="navbar">
      <div className="navbar__tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={view === tab.id}
            className={`navbar__tab ${view === tab.id ? 'is-active' : ''}`}
            onClick={() => runCommand(tab.cmd)}
          >
            <tab.icon size={15} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="navbar__context">
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
