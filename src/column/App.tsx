// Column: il foglio e niente altro. All'avvio splash, onboarding al primo lancio e pagina d'ingresso;
// poi il testo senza bordi (come lo Scriptorium in Silentium) con timer e parole in cima, la Tabula
// riposta sul bordo sinistro e il Palimpsestus sul destro, da tirare dentro afferrandone la striscia.
import { useEffect } from 'react';
import { useColumn, openPath, maybeSnapshot } from './store';
import { useUi } from './ui';
import { Header } from './Header';
import { SidePanel } from './Panels';
import { Scriptorium } from './editor/Scriptorium';
import { FloatingPanel } from './FloatingPanel';
import { Toolbar } from './Toolbar';
import { TabulaView } from './tabula/TabulaView';
import { Paperclip, Newspaper } from 'lucide-react';
import { VersionsView } from './versions/VersionsView';
import { Palette } from './Palette';
import { Dialogs, Toasts } from './Dialogs';
import { Splash, Onboarding, Landing } from './Welcome';
import { ContextMenuHost } from '../components/ContextMenu';
import { AskHost } from '../components/confirm';
import { handleGlobalKey } from './commands';
import { getEditor } from './editor/editorRef';
import { liveMarkdown } from './editor/Scriptorium';
import { platform } from '../platform';
import { t, useLang } from '../i18n';

export default function App() {
  useLang();
  const screen = useColumn((s) => s.screen);
  const silentium = useColumn((s) => s.silentium);
  const sheetId = useColumn((s) => s.sheet?.meta.id);

  useEffect(() => {
    void useColumn
      .getState()
      .init()
      .then(async () => {
        // un file aperto dal sistema salta l'ingresso
        const f = await platform.startupFile();
        if (f) await openPath(f);
      });
  }, []);

  // scorciatoie globali (solo col foglio aperto); Esc esce da Silentium
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useColumn.getState().screen !== 'sheet') return;
      if (useUi.getState().palette && e.key !== 'Escape') return;
      if (e.key === 'Escape' && useColumn.getState().silentium && !useUi.getState().popover) {
        useColumn.getState().setSilentium(false);
        return;
      }
      handleGlobalKey(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // versioni automatiche dopo una pausa nella scrittura, e alla chiusura
  useEffect(() => {
    const id = setInterval(() => maybeSnapshot(false), 15_000);
    const bye = () => {
      maybeSnapshot(true);
      void useColumn.getState().flush();
    };
    window.addEventListener('beforeunload', bye);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', bye);
    };
  }, []);

  // app vera: la finestra si chiude solo dopo aver scritto su disco l'ultimo testo
  useEffect(() => {
    if (platform.kind !== 'tauri') return;
    let off: (() => void) | undefined;
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const w = getCurrentWindow();
      off = await w.onCloseRequested(async (e) => {
        e.preventDefault();
        const ed = getEditor();
        if (ed && useColumn.getState().screen === 'sheet') useColumn.getState().setMarkdown(liveMarkdown(ed));
        maybeSnapshot(true);
        await useColumn.getState().flush();
        await w.destroy();
      });
    });
    return () => off?.();
  }, []);

  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', over);
    return () => window.removeEventListener('dragover', over);
  }, []);

  const hosts = (
    <>
      <Dialogs />
      <Toasts />
      <ContextMenuHost />
      <AskHost />
    </>
  );

  if (screen !== 'sheet')
    return (
      <div className="fx-app fx-app--welcome">
        <Header bare />
        {screen === 'splash' ? <Splash /> : screen === 'onboarding' ? <Onboarding /> : <Landing />}
        {hosts}
      </div>
    );

  return (
    <div className={`fx-app ${silentium ? 'is-silentium' : ''}`}>
      <Header />
      <div className="fx-body">
        <SidePanel />
        <main className="fx-main" key={sheetId}>
          <Scriptorium />
          <FloatingPanel id="tabula" side="left" title={t('bar.tabula')} icon={Paperclip} cmd="tabula.toggle">
            <TabulaView />
          </FloatingPanel>
          <FloatingPanel id="versions" side="right" title={t('bar.versions')} icon={Newspaper} cmd="versions.toggle">
            <VersionsView />
          </FloatingPanel>
        </main>
      </div>
      <Toolbar />
      <Palette />
      {hosts}
    </div>
  );
}
