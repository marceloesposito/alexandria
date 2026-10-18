// Preferenze > Picus: lingue (inclusa, installate con l'app, aggiunte dall'utente), categorie spente.
import { useEffect, useState } from 'react';
import { useWorkspace } from '../state/workspace';
import { platform } from '../platform';
import { t, useLang } from '../i18n';
import type { PackInfo } from './packs';

const tOr = (key: string, fallback: string) => {
  const s = t(key);
  return s === key ? fallback : s;
};

/** Etichetta breve di una categoria: "style:wordy" -> "Giri di parole", "repetition" -> "Ripetizioni". */
export function categoryLabel(c: string): string {
  const name = c.startsWith('style:') ? c.slice(6) : c;
  return tOr(`picus.cat.${name}`, name);
}

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
      {prefs.picusOff.length > 0 && (
        <div className="form__row">
          <span>{t('picus.off')}</span>
          <ul className="picus-langs">
            {prefs.picusOff.map((c) => (
              <li key={c}>
                <span>{categoryLabel(c)}</span>
                <button className="btn btn--ghost small" onClick={() => set({ picusOff: prefs.picusOff.filter((x) => x !== c) })}>
                  {t('picus.enable')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
