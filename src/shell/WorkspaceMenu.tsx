// Scelta del workspace (Beginner, Studio, Pro e quelli salvati): selettore nella navbar, come in
// Illustrator, e voci del menu Visualizza > Workspace.
import { LayoutDashboard, ChevronDown } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { BUILT_IN } from '../state/workspaces';
import { openContextMenu, type CtxItem } from '../components/ContextMenu';
import { promptDialog, confirmDialog } from '../components/confirm';
import { t, useLang } from '../i18n';

export function workspaceName(id: string): string {
  const user = useWorkspace.getState().app.workspaces.find((w) => w.id === id);
  return user ? user.name : t(`workspace.${id}`);
}

export async function saveWorkspaceAs() {
  const ws = useWorkspace.getState();
  const cur = ws.app.workspaces.find((w) => w.id === ws.app.workspace);
  const name = await promptDialog(t('workspace.saveName'), cur?.name ?? t('workspace.myLayout'), t('workspace.saveHint'));
  if (!name?.trim()) return;
  ws.saveWorkspaceLayout(name.trim());
  ws.toast(t('workspace.saved', { name: name.trim() }), 'ok');
}

export async function deleteWorkspace(id: string) {
  const ws = useWorkspace.getState();
  if (await confirmDialog(t('workspace.deleteConfirm', { name: workspaceName(id) }), undefined, { danger: true, okLabel: t('common.delete') })) ws.deleteWorkspaceLayout(id);
}

/** Voci comuni al selettore e al menu. */
export function workspaceItems(): CtxItem[] {
  const ws = useWorkspace.getState();
  const active = ws.app.workspace;
  const user = ws.app.workspaces;
  return [
    ...BUILT_IN.map((id) => ({ label: t(`workspace.${id}`), checked: active === id, onClick: () => ws.applyWorkspaceLayout(id) })),
    ...(user.length ? [{ sep: true, label: '' }] : []),
    ...user.map((w) => ({ label: w.name, checked: active === w.id, onClick: () => ws.applyWorkspaceLayout(w.id) })),
    { sep: true, label: '' },
    { label: t('workspace.save'), onClick: () => void saveWorkspaceAs() },
    { label: t('workspace.reset', { name: workspaceName(active) }), onClick: () => ws.applyWorkspaceLayout(active) },
    ...(user.some((w) => w.id === active) ? [{ label: t('workspace.delete', { name: workspaceName(active) }), danger: true, onClick: () => void deleteWorkspace(active) }] : []),
  ];
}

export function WorkspaceSwitcher() {
  useLang();
  const active = useWorkspace((s) => s.app.workspace);
  useWorkspace((s) => s.app.workspaces);
  return (
    <button
      className="ws-switch"
      title={t('workspace.hint')}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        openContextMenu({ clientX: r.right - 220, clientY: r.bottom + 4 }, workspaceItems());
      }}
    >
      <LayoutDashboard size={14} />
      <span>{workspaceName(active)}</span>
      <ChevronDown size={12} />
    </button>
  );
}
