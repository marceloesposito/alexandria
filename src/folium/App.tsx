// Folium: il foglio e niente altro. Barra in alto, pannello a sinistra quando serve, e la vista scelta:
// Scriptorium, Entrambi (testo e Tabula affiancati), Armarium (la Tabula), Palimpsestus.
import { useEffect, useRef } from 'react';
import { useFolium, openPath, maybeSnapshot } from './store';
import { useUi } from './ui';
import { Header } from './Header';
import { SidePanel } from './Panels';
import { Scriptorium } from './editor/Scriptorium';
import { TabulaView } from './tabula/TabulaView';
import { VersionsView } from './versions/VersionsView';
import { Palette } from './Palette';
import { Dialogs, Toasts } from './Dialogs';
import { ContextMenuHost } from '../components/ContextMenu';
import { AskHost } from '../components/confirm';
import { handleGlobalKey } from './commands';
import { platform } from '../platform';
import { t, useLang } from '../i18n';

function Split() {
  const split = useFolium((s) => s.sheet?.meta.split ?? 0.55);
  const box = useRef<HTMLDivElement>(null);
  const drag = (e: React.PointerEvent) => {
    const el = box.current;
    if (!el) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const move = (ev: PointerEvent) => useFolium.getState().setMeta({ split: Math.min(0.8, Math.max(0.2, (ev.clientX - r.left) / r.width)) });
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="fx-split" ref={box} style={{ '--split': split } as React.CSSProperties}>
      <div className="fx-split__a">
        <Scriptorium />
      </div>
      <div className="fx-split__bar" role="separator" aria-orientation="vertical" aria-label={t('views.splitter')} onPointerDown={drag} />
      <div className="fx-split__b">
        <TabulaView narrow />
      </div>
    </div>
  );
}

export default function App() {
  useLang();
  const ready = useFolium((s) => s.ready);
  const view = useFolium((s) => s.sheet?.meta.view ?? 'write');
  const silentium = useFolium((s) => s.silentium);
  const sheetId = useFolium((s) => s.sheet?.meta.id);

  useEffect(() => {
    void useFolium
      .getState()
      .init()
      .then(async () => {
        const f = await platform.startupFile();
        if (f) await openPath(f);
      });
  }, []);

  // scorciatoie globali; Esc esce da Silentium
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUi.getState().palette && e.key !== 'Escape') return;
      if (e.key === 'Escape' && useFolium.getState().silentium && !useUi.getState().popover) {
        useFolium.getState().setSilentium(false);
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
      void useFolium.getState().flush();
    };
    window.addEventListener('beforeunload', bye);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', bye);
    };
  }, []);

  // file trascinati sulla finestra fuori dal testo e dalla Tabula: si aprono come fogli
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', over);
    return () => window.removeEventListener('dragover', over);
  }, []);

  if (!ready) return <div className="fx-app fx-app--loading" />;
  return (
    <div className={`fx-app ${silentium ? 'is-silentium' : ''}`} data-view={view}>
      <Header />
      <div className="fx-body">
        <SidePanel />
        <main className="fx-main" key={sheetId}>
          {view === 'write' && <Scriptorium />}
          {view === 'both' && <Split />}
          {view === 'tabula' && <TabulaView />}
          {view === 'versions' && <VersionsView />}
        </main>
      </div>
      <Palette />
      <Dialogs />
      <Toasts />
      <ContextMenuHost />
      <AskHost />
    </div>
  );
}
