// Mostra la finestra di dialogo aperta. I moduli registrano le proprie.
import type { ComponentType } from 'react';
import { useWorkspace, type DialogId } from '../state/workspace';
import { RibbonCustomizer } from './RibbonCustomizer';
import { PreferencesDialog } from './dialogs/Preferences';
import { QuickSwitcher } from './QuickSwitcher';
import { TypesDialog } from '../types/TypesDialog';
import { RenameDocDialog, GoToLineDialog, AboutDialog, ShortcutsDialog, MarkdownGuideDialog, HelpDialog } from './dialogs/SimpleDialogs';

const registry = new Map<Exclude<DialogId, null>, ComponentType>([
  ['ribbonCustomize', RibbonCustomizer],
  ['preferences', PreferencesDialog],
  ['renameDoc', RenameDocDialog],
  ['goToLine', GoToLineDialog],
  ['about', AboutDialog],
  ['shortcuts', ShortcutsDialog],
  ['markdownGuide', MarkdownGuideDialog],
  ['help', HelpDialog],
  ['quickSwitcher', QuickSwitcher],
  ['types', TypesDialog],
]);

export function registerDialog(id: Exclude<DialogId, null>, c: ComponentType) {
  registry.set(id, c);
}

export function DialogHost() {
  const dialog = useWorkspace((s) => s.dialog);
  if (!dialog || dialog === 'findReplace') return null;
  const C = registry.get(dialog);
  return C ? <C /> : null;
}
