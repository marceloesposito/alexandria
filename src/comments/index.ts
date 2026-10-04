// Modulo commenti: pannello di destra, sovrapposizioni, comandi.
import { MessageSquarePlus, Search, Eye } from 'lucide-react';
import { createElement } from 'react';
import { registerCommands } from '../commands/registry';
import { rightPanel, centerOverlay } from '../editor/slots';
import { CommentsColumn } from './CommentsColumn';
import { LineHighlight, Connectors } from './Overlays';
import { useComments } from './store';
import { getEditor } from '../state/editorRef';
import { flatText } from './plugin';
import { makeAnchor } from './model';
import { posTopInPage } from './geometry';
import { ws } from '../state/workspace';
import { t } from '../i18n';

function CommentsPanel(props: Parameters<typeof CommentsColumn>[0]) {
  return createElement('div', { className: 'comments-host' }, createElement(CommentsColumn, props), createElement(Connectors));
}

export function registerComments() {
  rightPanel.set(CommentsPanel);
  centerOverlay.set(LineHighlight);
  registerCommands([
    {
      id: 'comment.add',
      label: 'cmd.comment.add',
      icon: MessageSquarePlus,
      shortcut: 'Mod+Alt+M',
      category: 'comments',
      views: ['editor'],
      run: () => {
        const e = getEditor();
        if (!e) return;
        if (!ws().app.prefs.showRight) ws().setPrefs({ showRight: true });
        const { from, to, empty } = e.state.selection;
        const flat = flatText(e.state.doc);
        // con una selezione il commento nasce gia' collegato; altrimenti alla riga del cursore
        const anchor = empty ? null : makeAnchor(flat, from, to, 'text');
        const y = posTopInPage(from) ?? 0;
        useComments.getState().setDraft({ y, anchor });
        if (empty) ws().toast(t('comments.addHint'), 'info');
      },
    },
    {
      id: 'comment.search',
      label: 'cmd.comment.search',
      icon: Search,
      category: 'comments',
      views: ['editor'],
      run: () => {
        if (!ws().app.prefs.showRight) ws().setPrefs({ showRight: true });
        setTimeout(() => (document.getElementById('comments-search') as HTMLInputElement | null)?.focus(), 50);
      },
    },
    {
      id: 'comment.showResolved',
      label: 'cmd.comment.showResolved',
      icon: Eye,
      category: 'comments',
      views: ['editor'],
      isActive: () => useComments.getState().showResolved,
      run: () => useComments.getState().setShowResolved(!useComments.getState().showResolved),
    },
  ]);
}
