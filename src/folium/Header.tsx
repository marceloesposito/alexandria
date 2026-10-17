// In cima: niente barra di navigazione, solo il timer, il contatore di parole e l'export, sullo stesso
// fondo del testo. La fascia fa anche da barra del titolo (trascinamento e, su Windows e Linux, riduci e
// chiudi). Tabula e Palimpsestus stanno sui bordi; tutto il resto per nome con ⌘K o col clic destro.
import { useRef } from 'react';
import { useFolium } from './store';
import { useUi } from './ui';
import { CmdButton } from './FloatingBar';
import { TimerChip } from './timer/TimerChip';
import { CountsPopover } from './editor/TextBar';
import { useCounts } from './editor/counts';
import { Popover } from '../components/Popover';
import { WindowControls, customTitleBar } from './WindowControls';
import { isMac, shortcutLabel } from './keys';
import { specOf } from './commandSpecs';
import { runCommand } from './commands';
import { Share } from 'lucide-react';
import { t, useLang } from '../i18n';
import { platform } from '../platform';

function Words() {
  const popover = useUi((s) => s.popover);
  const words = useCounts((s) => s.selection?.words ?? s.doc?.words ?? 0);
  const hasSel = useCounts((s) => !!s.selection);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <CmdButton id="counts.open" ref={ref} className="fx-btn--text" pressed={popover === 'counts'}>
        <span className="fx-btn__label">{t(hasSel ? 'bar.wordsSelected' : 'bar.words', { n: words })}</span>
      </CmdButton>
      <Popover anchor={ref.current} open={popover === 'counts'} onClose={() => useUi.getState().close()}>
        <CountsPopover />
      </Popover>
    </>
  );
}

/** Esporta: un pulsante, e nel suo menu Word, PDF, il file .folium e Alexandria. */
function Export() {
  const popover = useUi((s) => s.popover);
  const ref = useRef<HTMLButtonElement>(null);
  const items = ['sheet.exportDocx', 'sheet.exportPdf', 'sheet.saveAs', 'sheet.toCompendium'];
  return (
    <>
      <CmdButton id="export.menu" ref={ref} className="fx-btn--text" pressed={popover === 'export'}>
        <Share size={14} />
        <span className="fx-btn__label">{t('cmd.export.menu')}</span>
      </CmdButton>
      <Popover anchor={ref.current} open={popover === 'export'} onClose={() => useUi.getState().close()}>
        <div className="fx-menu" role="menu">
          {items.map((id) => {
            const c = specOf(id)!;
            return (
              <button
                key={id}
                role="menuitem"
                className="fx-menu__item"
                data-cmd={id}
                onClick={() => {
                  useUi.getState().close();
                  runCommand(id);
                }}
              >
                <span>{t(c.label)}</span>
                {c.shortcut && <span className="fx-menu__key">{shortcutLabel(c.shortcut)}</span>}
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}

/** `bare`: solo trascinamento e controlli della finestra (schermate d'avvio). */
export function Header({ bare = false }: { bare?: boolean }) {
  useLang();
  useFolium((s) => s.screen);
  const macOverlay = isMac && platform.kind === 'tauri';
  return (
    <header className={`fx-header ${macOverlay ? 'is-mac' : ''}`} data-tauri-drag-region>
      <div className="fx-header__center" data-tauri-drag-region>
        {!bare && (
          <div className="fx-top" role="toolbar" aria-label={t('bar.top')}>
            <TimerChip />
            <span className="fx-top__sep" aria-hidden />
            <Words />
            <span className="fx-top__sep" aria-hidden />
            <Export />
          </div>
        )}
      </div>
      {customTitleBar && <WindowControls />}
    </header>
  );
}
