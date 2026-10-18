// Clic destro nel testo: Commenta, link, Taglia/Copia/Incolla (voci da contextMenuModel).
import type { Editor } from '@tiptap/core';
import { openContextMenu, type CtxItem } from '../../components/ContextMenu';
import { textMenuItems, type TextMenuItem } from './contextMenuModel';
import { startComment, commentAt, openComment } from '../comments/store';
import { editLink } from './insertItems';
import { useColumn } from '../store';
import { t } from '../../i18n';
import { shortcutLabel } from '../keys';

/** Incolla dagli appunti di sistema (Ctrl+V resta il modo piu' sicuro se il sistema lo vieta). */
async function paste(editor: Editor) {
  try {
    const text = await navigator.clipboard.readText();
    editor.chain().focus().insertContent(text.replace(/\r\n?/g, '\n')).run();
  } catch {
    useColumn.getState().toast(t('edit.pasteBlocked', { keys: shortcutLabel('Mod+V') }), 'info');
  }
}

function run(editor: Editor, id: TextMenuItem['id'], at: number) {
  switch (id) {
    case 'comment.add':
      startComment(editor);
      return;
    case 'comment.open':
      openComment(commentAt(editor, at));
      return;
    case 'edit.link':
      void editLink(editor);
      return;
    case 'edit.unlink':
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    case 'edit.cut':
    case 'edit.copy':
      editor.commands.focus();
      document.execCommand(id === 'edit.cut' ? 'cut' : 'copy');
      return;
    case 'edit.paste':
      void paste(editor);
  }
}

const LABEL: Record<TextMenuItem['id'], string> = {
  'comment.add': 'cmd.comment.add',
  'comment.open': 'comment.open',
  'edit.link': 'cmd.edit.link',
  'edit.unlink': 'edit.unlink',
  'edit.cut': 'cmd.edit.cut',
  'edit.copy': 'cmd.edit.copy',
  'edit.paste': 'cmd.edit.paste',
};

const KEYS: Partial<Record<TextMenuItem['id'], string>> = { 'comment.add': 'Mod+Alt+M', 'edit.link': 'Mod+L', 'edit.cut': 'Mod+X', 'edit.copy': 'Mod+C', 'edit.paste': 'Mod+V' };

export function openTextMenu(editor: Editor, e: MouseEvent) {
  const at = editor.state.selection.from;
  const items = textMenuItems({ selection: !editor.state.selection.empty, inLink: editor.isActive('link'), onComment: !!commentAt(editor, at) });
  const out: CtxItem[] = [];
  for (const it of items) {
    if (it.sep) out.push({ label: '', sep: true });
    out.push({ label: t(LABEL[it.id]), disabled: it.disabled, hint: KEYS[it.id] ? shortcutLabel(KEYS[it.id]!) : undefined, onClick: () => run(editor, it.id, at) });
  }
  openContextMenu(e, out);
}
