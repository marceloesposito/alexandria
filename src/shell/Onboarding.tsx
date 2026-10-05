// Introduzione breve al primo avvio (si riapre da Aiuto): una pagina per sezione dell'app,
// con l'icona e il colore della sua tab nella navbar.
import { useEffect, useState } from 'react';
import { Feather, Library, PenLine, History, Landmark } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { useZen } from '../state/zen';
import { t, useLang } from '../i18n';

const STEPS = [
  { key: 'welcome', icon: Feather, color: 'var(--accent)' },
  { key: 'bookshelf', icon: Library, color: 'var(--series-1)' },
  { key: 'scriptorium', icon: PenLine, color: 'var(--series-2)' },
  { key: 'history', icon: History, color: 'var(--series-3)' },
  { key: 'library', icon: Landmark, color: 'var(--series-4)' },
] as const;

export function Onboarding() {
  useLang();
  const done = useWorkspace((s) => s.app.prefs.onboardingDone);
  const zen = useZen((s) => s.on);
  const [i, setI] = useState(0);
  const finish = () => {
    useWorkspace.getState().setPrefs({ onboardingDone: true });
    setI(0);
  };

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setI((x) => Math.min(STEPS.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done]);

  if (done || zen) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div className="onboarding-backdrop">
      <div className="onboarding" role="dialog" aria-modal aria-labelledby="onboarding-title" style={{ '--section': step.color } as React.CSSProperties}>
        <div className="onboarding__icon">
          <step.icon size={34} strokeWidth={1.5} />
        </div>
        <h2 id="onboarding-title">{t(`onboarding.${step.key}.title`)}</h2>
        <p>{t(`onboarding.${step.key}.text`)}</p>
        <p className="onboarding__tip">{t(`onboarding.${step.key}.tip`)}</p>
        <div className="onboarding__dots" aria-hidden>
          {STEPS.map((s, k) => (
            <button key={s.key} className={k === i ? 'is-active' : ''} onClick={() => setI(k)} tabIndex={-1} />
          ))}
        </div>
        <div className="onboarding__actions">
          <button className="btn btn--ghost" onClick={finish}>
            {t('onboarding.skip')}
          </button>
          <span className="grow" />
          {i > 0 && (
            <button className="btn" onClick={() => setI(i - 1)}>
              {t('onboarding.back')}
            </button>
          )}
          <button className="btn btn--primary" autoFocus onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? t('onboarding.start') : t('onboarding.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
