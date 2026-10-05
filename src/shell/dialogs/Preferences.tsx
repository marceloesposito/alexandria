// Preferenze dell'app (non del documento).
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useWorkspace } from '../../state/workspace';
import { t, useLang } from '../../i18n';
import { platform } from '../../platform';
import type { Prefs, ThemePref } from '../../state/prefs';
import { Sun, Moon, Monitor } from 'lucide-react';

const THEMES: { id: ThemePref; icon: typeof Sun; label: string }[] = [
  { id: 'light', icon: Sun, label: 'prefs.theme.light' },
  { id: 'dark', icon: Moon, label: 'prefs.theme.dark' },
  { id: 'system', icon: Monitor, label: 'prefs.theme.system' },
];

type Tab = 'general' | 'editor' | 'versions' | 'resources';

export function PreferencesDialog() {
  useLang();
  const prefs = useWorkspace((s) => s.app.prefs);
  const set = (p: Partial<Prefs>) => useWorkspace.getState().setPrefs(p);
  const close = () => useWorkspace.getState().closeDialog();
  const [tab, setTab] = useState<Tab>('general');

  return (
    <Modal title={t('cmd.app.preferences')} onClose={close} size="medium">
      <div className="tabs-row" role="tablist">
        {(['general', 'editor', 'versions', 'resources'] as Tab[]).map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} className={`seg ${tab === x ? 'is-active' : ''}`} onClick={() => setTab(x)}>
            {t(`prefs.tab.${x}`)}
          </button>
        ))}
      </div>
      <div className="form">
        {tab === 'general' && (
          <>
            <label className="form__row">
              <span>{t('prefs.language')}</span>
              <select className="select" value={prefs.lang} onChange={(e) => set({ lang: e.target.value as Prefs['lang'] })}>
                <option value="it">Italiano</option>
                <option value="en">English</option>
              </select>
            </label>
            <div className="form__row">
              <span>{t('prefs.theme')}</span>
              <div className="theme-toggle" role="radiogroup" aria-label={t('prefs.theme')}>
                {THEMES.map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={prefs.theme === id}
                    className={`seg ${prefs.theme === id ? 'is-active' : ''}`}
                    onClick={() => set({ theme: id })}
                  >
                    <Icon size={13} /> {t(label)}
                  </button>
                ))}
              </div>
            </div>
            <label className="form__row">
              <span>{t('prefs.author')}</span>
              <input className="input" value={prefs.authorName} placeholder={t('prefs.authorHint')} onChange={(e) => set({ authorName: e.target.value })} />
            </label>
            <label className="form__row">
              <span>{t('prefs.ribbonSize')}</span>
              <select className="select" value={prefs.ribbonSize} onChange={(e) => set({ ribbonSize: e.target.value as Prefs['ribbonSize'] })}>
                <option value="large">{t('prefs.ribbonLarge')}</option>
                <option value="small">{t('prefs.ribbonSmall')}</option>
              </select>
            </label>
          </>
        )}
        {tab === 'editor' && (
          <>
            <label className="form__check">
              <input type="checkbox" checked={prefs.lineNumbers} onChange={(e) => set({ lineNumbers: e.target.checked })} />
              {t('cmd.view.lineNumbers')}
            </label>
            <label className="form__row">
              <span>{t('prefs.lineStep')}</span>
              <select className="select" value={prefs.lineNumberStep} onChange={(e) => set({ lineNumberStep: Number(e.target.value) as 1 | 5 | 10 })}>
                <option value={1}>{t('prefs.lineStep.1')}</option>
                <option value={5}>{t('prefs.lineStep.5')}</option>
                <option value={10}>{t('prefs.lineStep.10')}</option>
              </select>
            </label>
            <label className="form__check">
              <input type="checkbox" checked={prefs.spellcheck} onChange={(e) => set({ spellcheck: e.target.checked })} />
              {t('prefs.spellcheck')}
            </label>
            <label className="form__row">
              <span>{t('prefs.zoom')}</span>
              <input
                type="range"
                min={0.6}
                max={2}
                step={0.1}
                value={prefs.zoom}
                onChange={(e) => set({ zoom: Number(e.target.value) })}
              />
              <span className="hint">{Math.round(prefs.zoom * 100)}%</span>
            </label>
          </>
        )}
        {tab === 'versions' && (
          <>
            <label className="form__row">
              <span>{t('prefs.checkpoint')}</span>
              <select
                className="select"
                value={prefs.autoCheckpointMinutes}
                onChange={(e) => set({ autoCheckpointMinutes: Number(e.target.value) })}
              >
                <option value={0}>{t('prefs.checkpoint.off')}</option>
                {[5, 10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {t('prefs.checkpoint.every', { n: m })}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">{t('prefs.checkpointHint')}</p>
            <label className="form__check">
              <input type="checkbox" checked={prefs.suggestCommitMessage} onChange={(e) => set({ suggestCommitMessage: e.target.checked })} />
              {t('prefs.suggestMessage')}
            </label>
          </>
        )}
        {tab === 'resources' && (
          <>
            <div className="form__row">
              <span>{t('prefs.library')}</span>
              <code className="path">{prefs.libraryPath ?? t('prefs.libraryDefault')}</code>
              <button
                className="btn small"
                onClick={async () => {
                  const dir = await platform.pickDirectory(t('prefs.libraryPick'));
                  if (dir) set({ libraryPath: dir });
                }}
              >
                {t('common.change')}
              </button>
            </div>
            <p className="hint">{t('prefs.libraryHint')}</p>
            <label className="form__row">
              <span>{t('prefs.layerSuggestions')}</span>
              <select className="select" value={prefs.layerSuggestions} onChange={(e) => set({ layerSuggestions: e.target.value as Prefs['layerSuggestions'] })}>
                <option value="suggest">{t('prefs.layerSuggestions.on')}</option>
                <option value="off">{t('prefs.layerSuggestions.off')}</option>
              </select>
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
