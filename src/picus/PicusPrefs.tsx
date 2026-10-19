// Preferenze > Picus: se mostrarlo e le lingue (inclusa, installate con l'app, aggiunte dall'utente).
// Nessuna impostazione sul tono: Picus propone tutti i toni ogni volta che lo si interroga.
import { useEffect, useState } from 'react';
import { useWorkspace } from '../state/workspace';
import { platform } from '../platform';
import { t, useLang } from '../i18n';
import type { PackInfo } from './packs';

export function PicusPrefs() {
  useLang();
  const prefs = useWorkspace((s) => s.app.prefs);
  const set = useWorkspace.getState().setPrefs;
  const toast = useWorkspace.getState().toast;
  const [packs, setPacks] = useState<PackInfo[] | null>(null);
  const reload = () => void import('./packs').then((m) => m.installedPacks().then(setPacks, () => setPacks([])));
  useEffect(reload, []);

  const add = async () => {
    const [path] = await platform.pickFiles(t('picus.pick'), ['picus']);
    if (!path) return;
    try {
      const p = await (await import('./packs')).installPack(path);
      toast(t('picus.added', { name: p.name }), 'ok');
      reload();
    } catch (e) {
      toast(t('picus.addError', { error: String(e instanceof Error ? e.message : e) }), 'error');
    }
  };

  const remove = async (p: PackInfo) => {
    await (await import('./packs')).removePack(p.lang);
    reload();
  };

  return (
    <>
      <label className="form__check">
        <input type="checkbox" checked={prefs.picusShown} onChange={(e) => set({ picusShown: e.target.checked })} />
        {t('picus.show')}
      </label>
      <p className="hint">{t('picus.prefsHint')}</p>
      <div className="form__row">
        <span>{t('picus.langs')}</span>
        <ul className="picus-langs">
          {(packs ?? []).map((p) => (
            <li key={p.lang}>
              <span>
                {p.name} <span className="hint">({p.lang})</span>
              </span>
              <span className="hint">{t(`picus.source.${p.source}`)}</span>
              {p.source === 'user' && (
                <button className="btn btn--ghost small" onClick={() => void remove(p)}>
                  {t('picus.remove')}
                </button>
              )}
            </li>
          ))}
        </ul>
        <button className="btn small" onClick={() => void add()}>
          {t('picus.addLanguage')}
        </button>
      </div>
      <p className="hint">{t('picus.languagesHint')}</p>
    </>
  );
}
