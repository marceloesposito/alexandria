// Barra in alto (40 px), fusa con la barra del titolo: menu dell'app, pannelli Fogli e Index,
// le quattro viste in un solo controllo, il titolo del foglio col suo popover, ⌘K.
import { useRef } from 'react';
import { Sparkle, PanelLeft, ListTree, PenLine, Columns2, Shapes, GitFork, ChevronDown, Search } from 'lucide-react';
import { useFolium, sheetTitle } from './store';
import { useUi } from './ui';
import { CmdButton, commandTitle } from './FloatingBar';
import { inHome, specOf } from './commandSpecs';
import { runCommand, isActive } from './commands';
import { Popover } from '../components/Popover';
import { WindowControls, customTitleBar } from './WindowControls';
import { shortcutLabel, isMac } from './keys';
import { t, useLang } from '../i18n';
import { platform } from '../platform';

const VIEWS = [
  { id: 'view.write', icon: PenLine },
  { id: 'view.both', icon: Columns2 },
  { id: 'view.tabula', icon: Shapes },
  { id: 'view.versions', icon: GitFork },
];

function MenuList({ home }: { home: 'crumb' | 'appMenu' }) {
  return (
    <div className="fx-menu" role="menu">
      {inHome(home).map((c) => (
        <button
          key={c.id}
          role="menuitem"
          className="fx-menu__item"
          data-cmd={c.id}
          onClick={() => {
            useUi.getState().close();
            runCommand(c.id);
          }}
        >
          <span>{t(c.label)}</span>
          {c.shortcut && <span className="fx-menu__key">{shortcutLabel(c.shortcut)}</span>}
        </button>
      ))}
    </div>
  );
}

function SaveDot() {
  const state = useFolium((s) => s.saveState);
  return <span className={`fx-save fx-save--${state}`} title={t(`save.${state}`)} aria-label={t(`save.${state}`)} role="status" />;
}

export function Header() {
  useLang();
  const sheet = useFolium((s) => s.sheet);
  const panel = useFolium((s) => s.app.panel);
  const popover = useUi((s) => s.popover);
  const appRef = useRef<HTMLButtonElement>(null);
  const crumbRef = useRef<HTMLButtonElement>(null);
  const close = () => useUi.getState().close();
  const macOverlay = isMac && platform.kind === 'tauri';
  return (
    <header className={`fx-header ${macOverlay ? 'is-mac' : ''}`} data-tauri-drag-region>
      {/* su macOS il menu dell'app e' quello del sistema */}
      {!macOverlay && (
        <CmdButton id="app.menu" ref={appRef} pressed={popover === 'appMenu'}>
          <Sparkle size={16} />
        </CmdButton>
      )}
      <CmdButton id="panel.sheets" pressed={panel === 'sheets'}>
        <PanelLeft size={16} />
      </CmdButton>
      <CmdButton id="panel.index" pressed={panel === 'index'}>
        <ListTree size={16} />
      </CmdButton>
      <div className="fx-seg fx-views" role="radiogroup" aria-label={t('views.label')}>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="radio"
            aria-checked={isActive(v.id)}
            aria-label={t(specOf(v.id)!.label)}
            title={commandTitle(v.id)}
            data-cmd={v.id}
            className={`fx-seg__btn ${isActive(v.id) ? 'is-active' : ''}`}
            onClick={() => runCommand(v.id)}
          >
            <v.icon size={15} />
          </button>
        ))}
      </div>
      <div className="fx-header__center" data-tauri-drag-region>
        <button ref={crumbRef} className={`fx-crumb ${popover === 'crumb' ? 'is-active' : ''}`} title={t('cmd.sheet.menu')} data-cmd="sheet.menu" onClick={() => runCommand('sheet.menu')}>
          <span className="fx-crumb__title">{sheetTitle(sheet)}</span>
          <ChevronDown size={13} />
        </button>
        <SaveDot />
      </div>
      <button className="fx-search" data-cmd="palette.open" title={commandTitle('palette.open')} onClick={() => runCommand('palette.open')}>
        <Search size={14} />
        <span>{t('palette.button')}</span>
        <kbd>{shortcutLabel('Mod+K')}</kbd>
      </button>
      {customTitleBar && <WindowControls />}
      <Popover anchor={appRef.current} open={popover === 'appMenu'} onClose={close}>
        <MenuList home="appMenu" />
      </Popover>
      <Popover anchor={crumbRef.current} open={popover === 'crumb'} onClose={close}>
        <MenuList home="crumb" />
      </Popover>
    </header>
  );
}
