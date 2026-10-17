// Controlli della finestra (riduci, ingrandisci, chiudi) disegnati dall'app su Windows e Linux, dove
// la barra di sistema e' tolta e la barra in alto fa da barra del titolo.
import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { platform } from '../platform';
import { isMac } from './keys';
import { t, useLang } from '../i18n';

export const customTitleBar = platform.kind === 'tauri' && !isMac;

type Win = Awaited<ReturnType<typeof loadWindow>>;
const loadWindow = async () => (await import('@tauri-apps/api/window')).getCurrentWindow();

export function WindowControls() {
  useLang();
  const [win, setWin] = useState<Win | null>(null);
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    void loadWindow().then(async (w) => {
      if (!alive) return;
      setWin(w);
      const sync = async () => setMaximized(await w.isMaximized());
      await sync();
      off = await w.onResized(() => void sync());
    });
    return () => {
      alive = false;
      off?.();
    };
  }, []);
  return (
    <div className="fx-winctl">
      <button className="fx-winctl__btn" title={t('win.minimize')} aria-label={t('win.minimize')} onClick={() => void win?.minimize()}>
        <Minus size={15} strokeWidth={1.3} />
      </button>
      <button className="fx-winctl__btn" title={maximized ? t('win.restore') : t('win.maximize')} aria-label={maximized ? t('win.restore') : t('win.maximize')} onClick={() => void win?.toggleMaximize()}>
        {maximized ? <Copy size={12} strokeWidth={1.3} style={{ transform: 'scaleX(-1)' }} /> : <Square size={12} strokeWidth={1.3} />}
      </button>
      <button className="fx-winctl__btn fx-winctl__btn--close" title={t('win.close')} aria-label={t('win.close')} onClick={() => void win?.close()}>
        <X size={16} strokeWidth={1.3} />
      </button>
    </div>
  );
}
