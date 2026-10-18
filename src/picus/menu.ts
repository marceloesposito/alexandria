// Picus nel menu del tasto destro: su una parola gia' selezionata il menu di Alexandria con "Chiedi a
// Picus" (sinonimi e alternative). Senza una selezione fatta prima resta il menu del sistema, con i
// suggerimenti del controllo ortografico.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { runCommand } from '../commands/registry';
import { openContextMenu } from '../components/ContextMenu';
import { t } from '../i18n';
import { ask } from './index';

/** testo breve da proporre nel menu: una parola o una locuzione di poche parole */
const shortText = (s: string) => {
  const w = s.trim().replace(/^[\s"'«»“”‘’()[\]{}.,;:!?…-]+|[\s"'«»“”‘’()[\]{}.,;:!?…-]+$/gu, '');
  return w && w.length <= 60 && w.split(/\s+/).length <= 5 ? w : null;
};

export const PicusMenu = Extension.create({
  name: 'picusMenu',
  addProseMirrorPlugins() {
    let hadSelection = false;
    return [
      new Plugin({
        key: new PluginKey('picusMenu'),
        props: {
          handleDOMEvents: {
            mousedown: (view, e) => {
              if (e.button === 2) hadSelection = !view.state.selection.empty;
              return false;
            },
            contextmenu: (view, e) => {
              const sel = hadSelection;
              hadSelection = false;
              if (!sel || view.state.selection.empty) return false;
              const text = shortText(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, ' '));
              if (!text) return false;
              openContextMenu(e, [
                { label: t('picus.askOn', { text }), hint: 'F7', onClick: () => void ask(false) },
                { sep: true, label: '' },
                { label: t('cmd.edit.cut'), onClick: () => void runCommand('edit.cut') },
                { label: t('cmd.edit.copy'), onClick: () => void runCommand('edit.copy') },
                { label: t('cmd.edit.paste'), onClick: () => void runCommand('edit.paste') },
              ]);
              return true;
            },
          },
        },
      }),
    ];
  },
});
