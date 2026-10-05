// Rimozione di risorse dalla Bookshelf (comando, menu contestuali, tasto Canc), sempre con conferma.
import { useResources } from '../store';
import { confirmDialog } from '../../components/confirm';
import { t } from '../../i18n';

/** Risorse su cui agisce "Rimuovi": la selezione, altrimenti quella aperta nell'Inspector. */
export function removalTargets(): string[] {
  const st = useResources.getState();
  if (st.selected.length) return st.selected;
  return st.inspector ? [st.inspector] : [];
}

export async function removeWithConfirm(ids: string[] = removalTargets()): Promise<boolean> {
  const st = useResources.getState();
  const list = ids.map((id) => st.get(id)).filter((r) => !!r);
  if (!list.length) return false;
  const onlyLibraryRefs = list.every((r) => r!.library);
  const title = list.length === 1 ? t('res.confirmDelete', { title: list[0]!.title }) : t('res.confirmDeleteMany', { n: list.length });
  const ok = await confirmDialog(title, onlyLibraryRefs ? t('res.confirmDeleteLibRef') : t('res.confirmDeleteHint'), { danger: true, okLabel: t('common.delete') });
  if (!ok) return false;
  if (st.viewer && ids.includes(st.viewer.id)) st.openViewer(null);
  await st.remove(list.map((r) => r!.id));
  return true;
}
