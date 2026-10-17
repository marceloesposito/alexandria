// Barra in alto: il nome del foglio a sinistra (un clic per cambiarlo), al centro il posto per la
// barretta quando la si aggancia, a destra (Windows e Linux) riduci e chiudi. Sullo stesso fondo del
// testo, fa anche da barra del titolo. Tabula e Palimpsestus stanno sui bordi; il resto per nome (⌘K).
import { useEffect, useRef, useState } from 'react';
import { useFolium, sheetTitle } from './store';
import { WindowControls, customTitleBar } from './WindowControls';
import { isMac } from './keys';
import { commandTitle } from './FloatingBar';
import { t, useLang } from '../i18n';
import { platform } from '../platform';

/** Il nome del foglio: un clic lo rende modificabile; Invio o clic fuori salvano, Esc annulla. */
function SheetName() {
  const sheet = useFolium((s) => s.sheet);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);
  if (!sheet) return null;
  const title = sheetTitle(sheet);
  const commit = () => {
    setEditing(false);
    const v = value.trim();
    if (v !== title) useFolium.getState().setMeta({ name: v });
  };
  return editing ? (
    <input
      ref={input}
      className="fx-name fx-name--edit"
      value={value}
      aria-label={t('cmd.sheet.rename')}
      placeholder={t('sheet.untitled')}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape') setEditing(false);
      }}
    />
  ) : (
    <button
      className="fx-name"
      data-cmd="sheet.rename"
      title={commandTitle('sheet.rename')}
      onClick={() => {
        setValue(sheet.meta.name || title);
        setEditing(true);
      }}
    >
      {title}
    </button>
  );
}

/** `bare`: solo trascinamento e controlli della finestra (schermate d'avvio). */
export function Header({ bare = false }: { bare?: boolean }) {
  useLang();
  const macOverlay = isMac && platform.kind === 'tauri';
  return (
    <header className={`fx-header ${macOverlay ? 'is-mac' : ''}`} data-tauri-drag-region>
      <div className="fx-header__left" data-tauri-drag-region>
        {!bare && <SheetName />}
      </div>
      {/* centrato sulla finestra intera, non sullo spazio rimasto */}
      <div id="fx-dock" className="fx-header__center" data-tauri-drag-region />
      {customTitleBar && <WindowControls />}
    </header>
  );
}
