// Registrazione di template e master page: vista, comandi del ribbon e del menu File.
import { LayoutTemplate, FilePlus2, Save, PanelsTopLeft } from 'lucide-react';
import { registerCommands } from '../commands/registry';
import { globalComponents } from '../shell/views';
import { ws } from '../state/workspace';
import { TemplatesView } from './TemplatesView';
import { saveCurrentAsTemplate } from './templateStore';
import { useDocSettings } from './docSettings';
import { promptDialog } from '../components/confirm';
import { t } from '../i18n';

export function registerTemplates() {
  globalComponents.push(TemplatesView);
  registerCommands([
    { id: 'tpl.manage', label: 'cmd.tpl.manage', icon: LayoutTemplate, category: 'layout', views: ['editor'], run: () => ws().openDialog('templates', { tab: 'templates' }) },
    { id: 'tpl.newFrom', label: 'cmd.tpl.newFrom', icon: FilePlus2, category: 'file', run: () => ws().openDialog('templates', { tab: 'templates' }) },
    {
      id: 'tpl.saveAs',
      label: 'cmd.tpl.saveAs',
      icon: Save,
      category: 'layout',
      views: ['editor'],
      isEnabled: () => !!ws().activeDoc,
      run: async () => {
        const name = await promptDialog(t('tpl.saveAsName'), useDocSettings.getState().settings.title || t('tpl.myTemplate'));
        if (!name?.trim()) return;
        const made = await saveCurrentAsTemplate(name.trim(), '');
        if (made) ws().toast(t('tpl.saved', { name: made.name }), 'ok');
      },
    },
    // sostituisce il comando del dialogo Impostazioni: le master hanno ora la loro vista
    { id: 'layout.masters', label: 'cmd.layout.masters', icon: PanelsTopLeft, category: 'layout', views: ['editor'], run: () => ws().openDialog('templates', { tab: 'masters' }) },
  ]);
}
