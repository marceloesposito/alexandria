// Comandi dell'app: file, vista, preferenze, aiuto.
import {
  NotebookPen,
  PanelTop,
  Shapes,
  Search,
  Command,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Pencil,
  Copy,
  Trash2,
  Save,
  Settings,
  Settings2,
  PanelLeft,
  PanelRight,
  Hash,
  Focus,
  ZoomIn,
  ZoomOut,
  Sun,
  Moon,
  Monitor,
  LayoutTemplate,
  Maximize,
  Keyboard,
  CircleHelp,
  Info,
  BookText,
  FileCode2,
  Library,
  PenLine,
  History,
  Eye,
  FileText,
  ScrollText,
  Ruler,
  Feather,
  House,
} from 'lucide-react';
import { useDocSettings } from '../layout/docSettings';
import { registerCommands, notifyCommandState } from './registry';
import { useZen } from '../state/zen';
import { useWorkspace, ws } from '../state/workspace';
import { flushSave, toggleSource, useDoc } from '../editor/session';
import { getEditor } from '../state/editorRef';
import { platform, joinPath } from '../platform';
import { t } from '../i18n';
import { isVault } from '../vault/vault';
import { confirmDialog } from '../components/confirm';

const prefs = () => ws().app.prefs;

async function chooseVault(create: boolean) {
  const dir = await platform.pickDirectory(create ? t('vault.pickNew') : t('vault.pickOpen'));
  if (!dir) return;
  await flushSave(getEditor());
  if (!create && !(await isVault(dir))) {
    // una cartella qualsiasi diventa un vault: i .md esistenti in documents/ vengono letti
    ws().toast(t('vault.converted'), 'info');
  }
  await ws().enterVault(dir);
}

export function registerAppCommands() {
  registerCommands([
    // ----- file
    {
      id: 'file.newDoc',
      label: 'cmd.file.newDoc',
      icon: FilePlus,
      shortcut: 'Mod+N',
      category: 'file',
      run: async () => {
        await flushSave(getEditor());
        await ws().newDoc();
        ws().setView('editor');
      },
    },
    {
      id: 'file.home',
      label: 'cmd.file.home',
      icon: House,
      category: 'file',
      run: async () => {
        await flushSave(getEditor());
        ws().closeVault();
      },
    },
    { id: 'file.openVault', label: 'cmd.file.openVault', icon: FolderOpen, shortcut: 'Mod+Alt+O', category: 'file', run: () => chooseVault(false) },
    { id: 'nav.quickSwitcher', label: 'cmd.nav.quickSwitcher', icon: Search, shortcut: 'Mod+O', category: 'view', run: () => ws().openDialog('quickSwitcher') },
    { id: 'nav.commandPalette', label: 'cmd.nav.commandPalette', icon: Command, shortcut: 'Mod+Shift+Space', category: 'view', run: () => ws().openDialog('quickSwitcher', { query: '>' }) },
    { id: 'file.journalToday', label: 'cmd.file.journalToday', icon: NotebookPen, shortcut: 'Mod+Alt+J', category: 'file', run: async () => void (await import('../vault/journal')).openTodayEntry() },
    { id: 'file.newJournal', label: 'cmd.file.newJournal', icon: NotebookPen, category: 'file', run: async () => void (await flushSave(getEditor()), ws().createFromTemplate('journal')) },
    { id: 'file.newVault', label: 'cmd.file.newVault', icon: FolderPlus, category: 'file', run: () => chooseVault(true) },
    {
      id: 'file.renameDoc',
      label: 'cmd.file.renameDoc',
      icon: Pencil,
      shortcut: 'F2',
      category: 'file',
      isEnabled: () => !!ws().activeDoc,
      run: () => ws().openDialog('renameDoc', ws().activeDoc),
    },
    {
      id: 'file.duplicateDoc',
      label: 'cmd.file.duplicateDoc',
      icon: Copy,
      category: 'file',
      isEnabled: () => !!ws().activeDoc,
      run: async () => {
        await flushSave(getEditor());
        if (ws().activeDoc) await ws().duplicateDoc(ws().activeDoc!);
      },
    },
    {
      id: 'file.deleteDoc',
      label: 'cmd.file.deleteDoc',
      icon: Trash2,
      category: 'file',
      isEnabled: () => !!ws().activeDoc,
      run: async () => {
        const rel = ws().activeDoc;
        if (!rel) return;
        const title = ws().docs.find((d) => d.rel === rel)?.title ?? rel;
        if (!(await confirmDialog(t('doc.confirmDelete', { title }), t('doc.confirmDeleteHint'), { danger: true, okLabel: t('common.delete') })))
          return;
        await ws().deleteDoc(rel);
        ws().toast(t('doc.deleted', { title }), 'info');
      },
    },
    {
      id: 'file.save',
      label: 'cmd.file.save',
      icon: Save,
      shortcut: 'Mod+S',
      category: 'file',
      run: async () => {
        await flushSave(getEditor());
        ws().toast(t('doc.savedNow'), 'ok');
      },
    },
    { id: 'file.docSettings', label: 'cmd.file.docSettings', icon: Settings2, category: 'file', run: () => ws().openDialog('docSettings') },
    {
      id: 'file.revealVault',
      label: 'cmd.file.revealVault',
      icon: FolderOpen,
      category: 'file',
      isEnabled: () => !!ws().vaultRoot && platform.kind === 'tauri',
      run: () => platform.openExternal('file:///' + joinPath(ws().vaultRoot!, '').replace(/^\/+/, '')),
    },

    // ----- vista
    { id: 'view.resources', label: 'cmd.view.resources', icon: Library, shortcut: 'Mod+1', category: 'view', run: () => ws().setView('resources'), isActive: () => ws().app.view === 'resources' },
    { id: 'view.editor', label: 'cmd.view.editor', icon: PenLine, shortcut: 'Mod+2', category: 'view', run: () => ws().setView('editor'), isActive: () => ws().app.view === 'editor' },
    { id: 'view.versions', label: 'cmd.view.versions', icon: History, shortcut: 'Mod+3', category: 'view', run: async () => {
      await flushSave(getEditor());
      ws().setView('versions');
    }, isActive: () => ws().app.view === 'versions' },
    { id: 'view.toggleLeft', label: 'cmd.view.toggleLeft', icon: PanelLeft, shortcut: 'Mod+Alt+L', category: 'view', isActive: () => prefs().showLeft, run: () => ws().setPrefs({ showLeft: !prefs().showLeft }) },
    { id: 'view.toggleRight', label: 'cmd.view.toggleRight', icon: PanelRight, shortcut: 'Mod+Alt+R', category: 'view', isActive: () => prefs().showRight, run: () => ws().setPrefs({ showRight: !prefs().showRight }) },
    { id: 'view.lineNumbers', label: 'cmd.view.lineNumbers', icon: Hash, category: 'view', views: ['editor'], isActive: () => prefs().lineNumbers, run: () => ws().setPrefs({ lineNumbers: !prefs().lineNumbers }) },
    {
      id: 'view.source',
      label: 'cmd.view.source',
      icon: FileCode2,
      shortcut: 'Mod+/',
      category: 'view',
      views: ['editor'],
      isActive: () => useDoc.getState().sourceMode,
      run: () => toggleSource(getEditor()),
    },
    { id: 'view.preview', label: 'cmd.view.preview', icon: Eye, shortcut: 'Mod+Shift+P', category: 'view', views: ['editor'], isActive: () => prefs().showPreview, run: () => ws().setPrefs({ showPreview: !prefs().showPreview }) },
    { id: 'view.layoutPage', label: 'cmd.view.layoutPage', icon: FileText, category: 'view', views: ['editor'], isActive: () => prefs().editorLayout === 'page', run: () => ws().setPrefs({ editorLayout: 'page' }) },
    {
      id: 'view.docHeader',
      label: 'cmd.view.docHeader',
      icon: PanelTop,
      category: 'view',
      views: ['editor'],
      isActive: () => {
        const h = useDocSettings.getState().settings.header;
        return prefs().editorLayout === 'borderless' ? h.borderless : h.paged;
      },
      run: () => {
        const st = useDocSettings.getState();
        const h = st.settings.header;
        st.update({ header: prefs().editorLayout === 'borderless' ? { ...h, borderless: !h.borderless } : { ...h, paged: !h.paged } });
      },
    },
    { id: 'doc.types', label: 'cmd.doc.types', icon: Shapes, category: 'view', run: () => ws().openDialog('types') },
    { id: 'view.layoutBorderless', label: 'cmd.view.layoutBorderless', icon: ScrollText, category: 'view', views: ['editor'], isActive: () => prefs().editorLayout === 'borderless', run: () => ws().setPrefs({ editorLayout: 'borderless' }) },
    { id: 'view.rulers', label: 'cmd.view.rulers', icon: Ruler, category: 'view', views: ['editor'], isActive: () => prefs().rulers, isEnabled: () => prefs().editorLayout === 'page', run: () => ws().setPrefs({ rulers: !prefs().rulers }) },
    { id: 'help.onboarding', label: 'cmd.help.onboarding', icon: Feather, category: 'help', run: () => ws().setPrefs({ onboardingDone: false }) },
    { id: 'view.zen', label: 'cmd.view.zen', icon: Feather, shortcut: 'Mod+Shift+D', category: 'view', isActive: () => useZen.getState().on, run: () => useZen.getState().toggle() },
    { id: 'view.focus', label: 'cmd.view.focus', icon: Focus, shortcut: 'Mod+Shift+F', category: 'view', views: ['editor'], isActive: () => prefs().focusMode, run: () => ws().setPrefs({ focusMode: !prefs().focusMode }) },
    { id: 'view.zoomIn', label: 'cmd.view.zoomIn', icon: ZoomIn, shortcut: 'Mod+=', category: 'view', run: () => ws().setPrefs({ zoom: Math.min(2, Math.round((prefs().zoom + 0.1) * 10) / 10) }) },
    { id: 'view.zoomOut', label: 'cmd.view.zoomOut', icon: ZoomOut, shortcut: 'Mod+-', category: 'view', run: () => ws().setPrefs({ zoom: Math.max(0.6, Math.round((prefs().zoom - 0.1) * 10) / 10) }) },
    { id: 'view.zoomReset', label: 'cmd.view.zoomReset', category: 'view', shortcut: 'Mod+0', run: () => ws().setPrefs({ zoom: 1 }) },
    { id: 'view.themeLight', label: 'cmd.view.themeLight', icon: Sun, category: 'view', isActive: () => prefs().theme === 'light', run: () => ws().setPrefs({ theme: 'light' }) },
    { id: 'view.themeDark', label: 'cmd.view.themeDark', icon: Moon, category: 'view', isActive: () => prefs().theme === 'dark', run: () => ws().setPrefs({ theme: 'dark' }) },
    { id: 'view.themeSystem', label: 'cmd.view.themeSystem', icon: Monitor, category: 'view', isActive: () => prefs().theme === 'system', run: () => ws().setPrefs({ theme: 'system' }) },
    { id: 'view.customizeRibbon', label: 'cmd.view.customizeRibbon', icon: LayoutTemplate, category: 'view', run: () => ws().openDialog('ribbonCustomize') },
    {
      id: 'view.ribbonSmall',
      label: 'cmd.view.ribbonSmall',
      category: 'view',
      isActive: () => prefs().ribbonSize === 'small',
      run: () => ws().setPrefs({ ribbonSize: prefs().ribbonSize === 'small' ? 'large' : 'small' }),
    },
    { id: 'view.ribbonCollapse', label: 'cmd.view.ribbonCollapse', shortcut: 'Mod+F1', category: 'view', isActive: () => prefs().ribbonCollapsed, run: () => ws().setPrefs({ ribbonCollapsed: !prefs().ribbonCollapsed }) },
    {
      id: 'view.fullscreen',
      label: 'cmd.view.fullscreen',
      icon: Maximize,
      shortcut: 'F11',
      category: 'view',
      run: async () => {
        if (platform.kind === 'tauri') {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const w = getCurrentWindow();
          await w.setFullscreen(!(await w.isFullscreen()));
        } else if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      },
    },

    // ----- preferenze e aiuto
    { id: 'app.preferences', label: 'cmd.app.preferences', icon: Settings, shortcut: 'Mod+,', category: 'app', run: () => ws().openDialog('preferences') },
    { id: 'help.guide', label: 'cmd.help.guide', icon: CircleHelp, shortcut: 'F1', category: 'help', run: () => ws().openDialog('help') },
    { id: 'help.shortcuts', label: 'cmd.help.shortcuts', icon: Keyboard, category: 'help', run: () => ws().openDialog('shortcuts') },
    { id: 'help.markdown', label: 'cmd.help.markdown', icon: BookText, category: 'help', run: () => ws().openDialog('markdownGuide') },
    { id: 'help.about', label: 'cmd.help.about', icon: Info, category: 'help', run: () => ws().openDialog('about') },
  ]);
}

export function useViewIs(v: 'resources' | 'editor' | 'versions'): boolean {
  return useWorkspace((s) => s.app.view === v);
}

// i pulsanti di menu e ribbon seguono l'ingresso e l'uscita dalla scrittura minimale
useZen.subscribe(() => notifyCommandState());
