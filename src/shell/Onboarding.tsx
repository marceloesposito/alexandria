// Introduzione al primo avvio (si riapre da Aiuto): una pagina per ambiente dell'app, con l'icona e
// il colore della sua tab nella navbar e le funzioni principali spiegate in una riga ciascuna.
import { useEffect, useState } from 'react';
import {
  Feather,
  Library,
  PenLine,
  History,
  Landmark,
  Landmark as Compendium,
  LayoutTemplate,
  ScrollText,
  FileStack,
  ClipboardPaste,
  Network,
  Bookmark,
  SlashSquare,
  MessageSquare,
  Maximize,
  Save,
  GitBranch,
  Columns2,
  Cloud,
  Share2,
  SlidersHorizontal,
  Palette,
  Keyboard,
  type LucideIcon,
} from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { useZen } from '../state/zen';
import { t, useLang } from '../i18n';

interface Step {
  key: string;
  icon: LucideIcon;
  color: string;
  features: LucideIcon[];
}

const STEPS: Step[] = [
  { key: 'welcome', icon: Feather, color: 'var(--accent)', features: [] },
  { key: 'compendium', icon: Compendium, color: 'var(--accent)', features: [ScrollText, LayoutTemplate, FileStack] },
  { key: 'bookshelf', icon: Library, color: 'var(--series-1)', features: [ClipboardPaste, Network, Bookmark] },
  { key: 'scriptorium', icon: PenLine, color: 'var(--series-2)', features: [SlashSquare, MessageSquare, Maximize] },
  { key: 'history', icon: History, color: 'var(--series-3)', features: [Save, Columns2, GitBranch, Cloud] },
  { key: 'library', icon: Landmark, color: 'var(--series-4)', features: [Share2, FileStack] },
  { key: 'customize', icon: SlidersHorizontal, color: 'var(--accent)', features: [SlidersHorizontal, Palette, Keyboard] },
];

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
        <div className="onboarding__kicker">{t('onboarding.progress', { n: i + 1, total: STEPS.length })}</div>
        <h2 id="onboarding-title">{t(`onboarding.${step.key}.title`)}</h2>
        <p>{t(`onboarding.${step.key}.text`)}</p>
        {step.features.length > 0 && (
          <ul className="onboarding__features">
            {step.features.map((Icon, k) => (
              <li key={k}>
                <span className="onboarding__feature-icon">
                  <Icon size={16} />
                </span>
                <span>
                  <strong>{t(`onboarding.${step.key}.f${k + 1}.title`)}</strong>
                  <span>{t(`onboarding.${step.key}.f${k + 1}.text`)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="onboarding__tip">{t(`onboarding.${step.key}.tip`)}</p>
        <div className="onboarding__dots" aria-hidden>
          {STEPS.map((s, k) => (
            <button key={s.key} className={k === i ? 'is-active' : ''} onClick={() => setI(k)} tabIndex={-1} title={t(`onboarding.${s.key}.title`)} />
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
