// Avvio di Folium: splash, onboarding al primo lancio, pagina d'ingresso. La pagina d'ingresso offre
// solo "Inizia a scrivere" oppure, se ci sono fogli, "Riprendi da dove eri rimasto" e "Nuovo foglio".
import { useEffect, useState } from 'react';
import { ArrowRight, Plus, RotateCcw } from 'lucide-react';
import { useFolium } from './store';
import { displayName } from './format';
import { shortcutLabel } from './keys';
import { t, useLang } from '../i18n';

/** Il segno di Folium: un foglio con l'angolo piegato (lo stesso dell'icona), nei colori del tema. */
export function FoliumMark({ size = 72 }: { size?: number }) {
  return (
    <svg className="fx-mark" width={size} height={size} viewBox="0 0 1024 1024" aria-hidden>
      <path d="M300 200 H620 L740 320 V824 H300 Z" className="fx-mark__sheet" />
      <path d="M620 200 V320 H740" className="fx-mark__fold" />
      <rect x="370" y="420" width="300" height="30" rx="15" className="fx-mark__line" />
      <rect x="370" y="510" width="300" height="30" rx="15" className="fx-mark__line" />
      <rect x="370" y="600" width="220" height="30" rx="15" className="fx-mark__line" />
    </svg>
  );
}

export function Splash() {
  const ready = useFolium((s) => s.ready);
  const onboarded = useFolium((s) => s.app.onboarded);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShown(true), 900);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (ready && shown && useFolium.getState().screen === 'splash') useFolium.getState().setScreen(onboarded ? 'landing' : 'onboarding');
  }, [ready, shown, onboarded]);
  return (
    <div className="fx-splash" role="status" aria-label="Folium">
      <FoliumMark size={88} />
      <div className="fx-splash__name">Folium</div>
    </div>
  );
}

const STEPS = ['sheet', 'tabula', 'context', 'versions'] as const;

export function Onboarding() {
  useLang();
  const [i, setI] = useState(0);
  const done = () => {
    useFolium.getState().setApp({ onboarded: true });
    useFolium.getState().setScreen('landing');
  };
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div className="fx-welcome">
      <div className="fx-onboarding" role="dialog" aria-labelledby="fx-ob-title">
        <div className="fx-onboarding__dots" aria-hidden>
          {STEPS.map((s, k) => (
            <span key={s} className={k === i ? 'is-active' : ''} />
          ))}
        </div>
        <h1 id="fx-ob-title">{t(`onboarding.${step}.title`)}</h1>
        <p>{t(`onboarding.${step}.text`, { palette: shortcutLabel('Mod+K') })}</p>
        <div className="fx-onboarding__actions">
          {!last && (
            <button className="fx-link" onClick={done}>
              {t('onboarding.skip')}
            </button>
          )}
          <span className="fx-spacer" />
          <button className="fx-cta" autoFocus onClick={() => (last ? done() : setI(i + 1))}>
            {last ? t('onboarding.start') : t('onboarding.next')}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  useLang();
  const sheets = useFolium((s) => s.sheets);
  const lastId = useFolium((s) => s.app.lastSheet);
  const last = sheets.find((s) => s.id === lastId) ?? sheets[0];
  const st = useFolium.getState();
  return (
    <div className="fx-welcome">
      <div className="fx-landing">
        <FoliumMark size={64} />
        {last ? (
          <>
            <button className="fx-cta fx-cta--big" autoFocus onClick={() => void st.resume()}>
              <RotateCcw size={18} />
              <span>
                {t('landing.resume')}
                <small>
                  {displayName(
                    {
                      meta: { name: last.name } as never,
                      markdown: last.preview,
                    },
                    t('sheet.untitled'),
                  )}
                </small>
              </span>
            </button>
            <button className="fx-cta fx-cta--quiet" onClick={() => void st.createNew()}>
              <Plus size={16} />
              {t('landing.new')}
            </button>
          </>
        ) : (
          <button className="fx-cta fx-cta--big" autoFocus onClick={() => void st.createNew()}>
            <span>{t('landing.start')}</span>
            <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
