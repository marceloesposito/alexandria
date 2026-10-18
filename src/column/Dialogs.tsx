// Finestre del menu dell'app: Preferenze, Aiuto (scorciatoie), Informazioni. E gli avvisi.
import { X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useUi } from './ui';
import { useColumn } from './store';
import { COMMANDS } from './commandSpecs';
import { shortcutLabel } from './keys';
import { t, useLang } from '../i18n';
import pkg from '../../package.json';

function Prefs() {
  const app = useColumn((s) => s.app);
  const set = useColumn.getState().setApp;
  return (
    <div className="fx-form">
      <label className="fx-field">
        <span>{t('prefs.lang')}</span>
        <select className="fx-input" value={app.lang} onChange={(e) => set({ lang: e.target.value as 'it' | 'en' })}>
          <option value="it">Italiano</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="fx-field">
        <span>{t('prefs.theme')}</span>
        <select className="fx-input" value={app.theme} onChange={(e) => set({ theme: e.target.value as 'system' | 'light' | 'dark' })}>
          <option value="system">{t('prefs.theme.system')}</option>
          <option value="light">{t('prefs.theme.light')}</option>
          <option value="dark">{t('prefs.theme.dark')}</option>
        </select>
      </label>
      <label className="fx-field">
        <span>{t('prefs.author')}</span>
        <input className="fx-input" value={app.author} placeholder={t('prefs.authorHint')} onChange={(e) => set({ author: e.target.value })} />
      </label>
    </div>
  );
}

function Help() {
  const keys = COMMANDS.filter((c) => c.shortcut);
  return (
    <div className="fx-help">
      <p>{t('help.intro')}</p>
      <table className="fx-keys">
        <tbody>
          {keys.map((c) => (
            <tr key={c.id}>
              <td>{t(c.label)}</td>
              <td>
                <kbd>{shortcutLabel(c.shortcut!)}</kbd>
              </td>
            </tr>
          ))}
          <tr>
            <td>{t('help.slash')}</td>
            <td>
              <kbd>/</kbd>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function About() {
  return (
    <div className="fx-about">
      <p className="fx-about__name">Column</p>
      <p className="fx-muted">{t('about.version', { v: pkg.version })}</p>
      <p>{t('about.text')}</p>
      <p className="fx-muted">{t('about.licenses')}</p>
    </div>
  );
}

export function Dialogs() {
  useLang();
  const d = useUi((s) => s.dialog);
  if (!d) return null;
  const close = () => useUi.getState().setDialog(null);
  const title = { prefs: t('cmd.app.prefs'), help: t('cmd.app.help'), about: t('cmd.app.about') }[d];
  return (
    <Modal title={title} onClose={close} size="small">
      {d === 'prefs' ? <Prefs /> : d === 'help' ? <Help /> : <About />}
    </Modal>
  );
}

export function Toasts() {
  const toasts = useColumn((s) => s.toasts);
  return (
    <div className="fx-toasts" role="status" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={`fx-toast fx-toast--${x.kind}`}>
          <span>{x.text}</span>
          <button className="fx-icon" onClick={() => useColumn.getState().dismiss(x.id)} aria-label={t('common.close')}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
