// Modulo Revisione: modalità Suggerisci, accettare e rifiutare le revisioni tracciate.
import { PenLine, Check, X, CheckCheck, XCircle, ArrowDownToLine, FileInput } from 'lucide-react';
import { registerCommands } from '../commands/registry';
import { getEditor } from '../state/editorRef';
import { useWorkspace } from '../state/workspace';
import { useTrack, resolveChanges, changeAt, nextChange, listChanges } from '../editor/extensions/track';
import { t } from '../i18n';

const toast = (m: string) => useWorkspace.getState().toast(m, 'info');

function resolveHere(accept: boolean) {
  const e = getEditor();
  if (!e) return;
  const { from, to, empty } = e.state.selection;
  const here = changeAt(e);
  const n = empty
    ? here
      ? resolveChanges(e, accept, (c) => c.from === here.from && c.to === here.to)
      : 0
    : resolveChanges(e, accept, (c) => c.to > from && c.from < to);
  if (!n) toast(t('track.noneHere'));
  else nextChange(e);
}

export function registerRevision() {
  // le revisioni si firmano con il nome delle preferenze
  const sync = () => {
    const name = useWorkspace.getState().app.prefs.authorName;
    useTrack.getState().set({ author: name || t('comments.me') });
  };
  sync();
  useWorkspace.subscribe((s, p) => s.app.prefs.authorName !== p.app.prefs.authorName && sync());

  const hasChanges = () => {
    const e = getEditor();
    return !!e && listChanges(e.state.doc).length > 0;
  };
  registerCommands([
    { id: 'track.importWord', label: 'cmd.track.importWord', hint: 'cmd.track.importWordHint', icon: FileInput, category: 'edit', views: ['editor'], run: async () => (await import('./word')).importWordReview() },
    {
      id: 'track.suggest',
      label: 'cmd.track.suggest',
      hint: 'cmd.track.suggestHint',
      icon: PenLine,
      shortcut: 'Mod+Alt+T',
      category: 'edit',
      views: ['editor'],
      isActive: () => useTrack.getState().suggest,
      run: () => {
        const on = !useTrack.getState().suggest;
        useTrack.getState().set({ suggest: on });
        toast(on ? t('track.on') : t('track.off'));
      },
    },
    { id: 'track.accept', label: 'cmd.track.accept', icon: Check, category: 'edit', views: ['editor'], run: () => resolveHere(true) },
    { id: 'track.reject', label: 'cmd.track.reject', icon: X, category: 'edit', views: ['editor'], run: () => resolveHere(false) },
    {
      id: 'track.next',
      label: 'cmd.track.next',
      icon: ArrowDownToLine,
      category: 'edit',
      views: ['editor'],
      run: () => {
        const e = getEditor();
        if (e && !nextChange(e)) toast(t('track.none'));
      },
    },
    {
      id: 'track.acceptAll',
      label: 'cmd.track.acceptAll',
      icon: CheckCheck,
      category: 'edit',
      views: ['editor'],
      isEnabled: hasChanges,
      run: () => {
        const e = getEditor();
        if (e) toast(t('track.done', { n: resolveChanges(e, true) }));
      },
    },
    {
      id: 'track.rejectAll',
      label: 'cmd.track.rejectAll',
      icon: XCircle,
      category: 'edit',
      views: ['editor'],
      isEnabled: hasChanges,
      run: () => {
        const e = getEditor();
        if (e) toast(t('track.done', { n: resolveChanges(e, false) }));
      },
    },
  ]);
}
