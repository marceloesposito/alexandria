// Avvio di Folium: splash, onboarding al primo lancio, pagina d'ingresso. La pagina d'ingresso offre
// solo "Inizia a scrivere" oppure, se ci sono fogli, "Riprendi da dove eri rimasto" e "Nuovo foglio".
import { useEffect, useState } from 'react';
import { ArrowRight, Plus, RotateCcw, PenLine, Shapes, GitFork } from 'lucide-react';
import { useFolium } from './store';
import { displayName } from './format';
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

/** Onboarding: una sola schermata, i tre ambienti di Folium in una riga ciascuno. */
const POINTS = [
  { key: 'scriptorium', icon: PenLine },
  { key: 'armarium', icon: Shapes },
  { key: 'palimpsestus', icon: GitFork },
] as const;

export function Onboarding() {
  useLang();
  const done = () => {
    useFolium.getState().setApp({ onboarded: true });
    useFolium.getState().setScreen('landing');
  };
  return (
    <div className="fx-welcome">
      <div className="fx-onboarding" role="dialog" aria-labelledby="fx-ob-title">
        <FoliumMark size={48} />
        <h1 id="fx-ob-title">{t('onboarding.title')}</h1>
        <ul className="fx-onboarding__points">
          {POINTS.map((p) => (
            <li key={p.key}>
              <span className="fx-onboarding__icon">
                <p.icon size={18} />
              </span>
              <span>
                <strong>{t(`onboarding.${p.key}.title`)}</strong>
                {t(`onboarding.${p.key}.text`)}
              </span>
            </li>
          ))}
        </ul>
        <button className="fx-cta" autoFocus onClick={done}>
          {t('onboarding.start')}
          <ArrowRight size={16} />
        </button>
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
