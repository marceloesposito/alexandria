// Guscio dell'app: menu, navbar, ribbon, vista corrente, barra di stato, dialoghi.
import { useEffect } from 'react';
import { MenuBar } from './shell/MenuBar';
import { NavBar } from './shell/NavBar';
import { Ribbon } from './shell/Ribbon';
import { StatusBar } from './shell/StatusBar';
import { Toasts } from './shell/Toasts';
import { DialogHost } from './shell/DialogHost';
import { ContextMenuHost } from './components/ContextMenu';
import { AskHost } from './components/confirm';
import { EditorView } from './editor/EditorView';
import { useWorkspace } from './state/workspace';
import { findByShortcut, runCommand } from './commands/registry';
import { viewComponents, globalComponents } from './shell/views';
import { useLang, t } from './i18n';

export default function App() {
  useLang();
  const ready = useWorkspace((s) => s.ready);
  const view = useWorkspace((s) => s.app.view);

  useEffect(() => {
    void useWorkspace.getState().init();
  }, []);

  // scorciatoie globali (quelle di formattazione le gestisce l'editor)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const inEditor = !!target?.closest('.ProseMirror');
      const inField = !!target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      const cmd = findByShortcut(e, inEditor);
      if (!cmd) return;
      // nei campi di testo solo le scorciatoie con modificatori
      if (inField && !(e.ctrlKey || e.metaKey) && !/^F\d+$/.test(e.key)) return;
      if (inField && ['edit.undo', 'edit.redo', 'edit.selectAll', 'edit.cut', 'edit.copy', 'edit.paste'].includes(cmd.id)) return;
      e.preventDefault();
      void runCommand(cmd.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) {
    return (
      <div className="splash">
        <div className="splash__name">Alexandria</div>
        <div className="hint">{t('app.loading')}</div>
      </div>
    );
  }

  const Resources = viewComponents.resources;
  const Versions = viewComponents.versions;

  return (
    <div className="app">
      <MenuBar />
      <NavBar />
      <Ribbon />
      <div className="app__view">
        {view === 'editor' && <EditorView />}
        {view === 'resources' && (Resources ? <Resources /> : null)}
        {view === 'versions' && (Versions ? <Versions /> : null)}
      </div>
      <StatusBar />
      {globalComponents.map((C, i) => (
        <C key={i} />
      ))}
      <DialogHost />
      <ContextMenuHost />
      <AskHost />
      <Toasts />
    </div>
  );
}
