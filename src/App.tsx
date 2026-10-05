// Guscio dell'app: menu, navbar, ribbon, vista corrente, dialoghi.
import { useEffect } from 'react';
import { MenuBar } from './shell/MenuBar';
import { NavBar } from './shell/NavBar';
import { Ribbon } from './shell/Ribbon';
import { Toasts } from './shell/Toasts';
import { DialogHost } from './shell/DialogHost';
import { Onboarding } from './shell/Onboarding';
import { ContextMenuHost } from './components/ContextMenu';
import { AskHost } from './components/confirm';
import { EditorView } from './editor/EditorView';
import { useWorkspace } from './state/workspace';
import { useZen } from './state/zen';
import { findByShortcut, runCommand } from './commands/registry';
import { viewComponents, globalComponents } from './shell/views';
import { useLang, t } from './i18n';

export default function App() {
  useLang();
  const ready = useWorkspace((s) => s.ready);
  const view = useWorkspace((s) => s.app.view);
  const zen = useZen((s) => s.on);

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

  // Esc esce dalla scrittura minimale (se non lo usa gia' un menu, un dialogo o l'editor)
  useEffect(() => {
    if (!zen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || useWorkspace.getState().dialog || document.querySelector('.slash-host, .modal-backdrop, .viewer-backdrop, .context-menu')) return;
      void useZen.getState().exit();
    };
    // in cattura: l'editor consuma Esc prima che arrivi alla finestra
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [zen]);

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
    <div className={`app ${zen ? 'app--zen' : ''}`}>
      {!zen && (
        <>
          <MenuBar />
          <NavBar />
          <Ribbon />
        </>
      )}
      {zen && <div className="zen-hint">{t('zen.exitHint')}</div>}
      <div className="app__view">
        {view === 'editor' && <EditorView />}
        {view === 'resources' && (Resources ? <Resources /> : null)}
        {view === 'versions' && (Versions ? <Versions /> : null)}
      </div>
      {globalComponents.map((C, i) => (
        <C key={i} />
      ))}
      <DialogHost />
      <Onboarding />
      <ContextMenuHost />
      <AskHost />
      <Toasts />
    </div>
  );
}
