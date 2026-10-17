// Barra in alto: serve solo a passare fra Scriptorium e Palimpsestus. Senza bordi, sullo stesso
// fondo del testo; fa anche da barra del titolo (trascinamento e, su Windows e Linux, riduci e
// chiudi). Tutto il resto si trova per nome con ⌘K, con le scorciatoie o col clic destro.
import { PenLine, GitFork } from 'lucide-react';
import { specOf } from './commandSpecs';
import { runCommand, isActive } from './commands';
import { commandTitle } from './FloatingBar';
import { useFolium } from './store';
import { WindowControls, customTitleBar } from './WindowControls';
import { isMac } from './keys';
import { t, useLang } from '../i18n';
import { platform } from '../platform';

const VIEWS = [
  { id: 'view.write', icon: PenLine },
  { id: 'view.versions', icon: GitFork },
];

/** `bare`: solo trascinamento e controlli della finestra (schermate d'avvio). */
export function Header({ bare = false }: { bare?: boolean }) {
  useLang();
  useFolium((s) => s.sheet?.meta.view);
  const macOverlay = isMac && platform.kind === 'tauri';
  return (
    <header className={`fx-header ${macOverlay ? 'is-mac' : ''}`} data-tauri-drag-region>
      <div className="fx-header__center" data-tauri-drag-region>
        {!bare && (
          <div className="fx-seg fx-views" role="radiogroup" aria-label={t('views.label')}>
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="radio"
                aria-checked={isActive(v.id)}
                title={commandTitle(v.id)}
                data-cmd={v.id}
                className={`fx-seg__btn ${isActive(v.id) ? 'is-active' : ''}`}
                onClick={() => runCommand(v.id)}
              >
                <v.icon size={14} />
                <span>{t(specOf(v.id)!.label)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {customTitleBar && <WindowControls />}
    </header>
  );
}
