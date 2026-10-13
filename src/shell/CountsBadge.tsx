// Conteggi del documento (o della selezione), pagine e zoom: etichetta flottante in basso a destra
// della colonna centrale. Chiusa mostra i conteggi scelti dall'utente (puntina nella lista aperta),
// aperta tutti; accanto alla percentuale dello zoom i pulsanti per ridurre e ingrandire.
import { useState, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, Pin, ZoomIn, ZoomOut } from 'lucide-react';
import { useDoc } from '../editor/session';
import { useWorkspace } from '../state/workspace';
import { useDocSettings, pageMetrics } from '../layout/docSettings';
import { t, useLang } from '../i18n';
import { runCommand } from '../commands/registry';
import { COUNT_KINDS, normalizeShown, toggleShown, type CountKind } from './countsModel';

const fmt = (n: number) => n.toLocaleString(undefined);

export function CountsBadge() {
  useLang();
  const counts = useDoc((s) => s.counts);
  const sel = useDoc((s) => s.selection);
  const realPages = useDoc((s) => s.realPages);
  const sourceMode = useDoc((s) => s.sourceMode);
  const zoom = useWorkspace((s) => s.app.prefs.zoom);
  const shown = normalizeShown(useWorkspace((s) => s.app.prefs.countsShown));
  const layout = useDocSettings((s) => s.settings.layout);
  const [open, setOpen] = useState(false);
  const wpp = pageMetrics(layout).wordsPerPage;
  const pages = realPages ?? (counts && counts.words ? Math.max(1, Math.ceil(counts.words / wpp)) : 0);

  const items: Record<CountKind, { text: string; hint: string }> | null = counts && {
    words: {
      text: sel ? t('status.selWords', { n: fmt(sel.words), total: fmt(counts.words) }) : t('status.words', { n: fmt(counts.words) }),
      hint: t('status.wordsHint'),
    },
    chars: { text: sel ? t('status.selChars', { n: fmt(sel.chars) }) : t('status.chars', { n: fmt(counts.chars) }), hint: t('status.charsHint') },
    charsNoSpaces: { text: t('status.charsNoSpaces', { n: fmt(counts.charsNoSpaces) }), hint: t('status.charsNoSpacesHint') },
    cartelle: { text: t('status.cartelle', { n: counts.cartelle.toLocaleString() }), hint: t('status.cartelleHint') },
    pages: {
      text: realPages ? t('status.pages', { n: pages }) : t('status.pagesApprox', { n: pages }),
      hint: realPages ? t('status.pagesReal') : t('status.pagesEstimate', { n: wpp }),
    },
    reading: { text: t('status.reading', { n: counts.readingMinutes }), hint: t('status.readingHint') },
  };

  const pin = (k: CountKind) => useWorkspace.getState().setPrefs({ countsShown: toggleShown(shown, k) });

  const bar: ReactNode[] = [];
  if (!open && items) {
    shown.forEach((k, i) => {
      if (i) bar.push(<span key={`d${k}`} className="counts-badge__dot">·</span>);
      bar.push(<span key={k} title={items[k].hint}>{items[k].text}</span>);
    });
  }

  return (
    <div className={`counts-badge ${open ? 'is-open' : ''}`} aria-live="polite">
      {open && items && (
        <div className="counts-badge__list" title={t('counts.pinHint')}>
          {COUNT_KINDS.map((k) => {
            const on = shown.includes(k);
            return (
              <div key={k} className="counts-badge__row">
                <span title={items[k].hint}>{items[k].text}</span>
                <button
                  className={`counts-badge__pin ${on ? 'is-on' : ''}`}
                  onClick={() => pin(k)}
                  title={on ? t('counts.unpin') : t('counts.pin')}
                  aria-label={on ? t('counts.unpin') : t('counts.pin')}
                  aria-pressed={on}
                >
                  <Pin size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="counts-badge__bar">
        {sourceMode && <span className="counts-badge__mode">{t('status.source')}</span>}
        {bar}
        <span className="counts-badge__zoomgroup">
          <button className="counts-badge__icon" onClick={() => runCommand('view.zoomOut')} disabled={zoom <= 0.6} title={t('cmd.view.zoomOut')} aria-label={t('cmd.view.zoomOut')}>
            <ZoomOut size={13} />
          </button>
          <button className="counts-badge__zoom" onClick={() => runCommand('view.zoomReset')} title={t('cmd.view.zoomReset')}>
            {Math.round(zoom * 100)}%
          </button>
          <button className="counts-badge__icon" onClick={() => runCommand('view.zoomIn')} disabled={zoom >= 2} title={t('cmd.view.zoomIn')} aria-label={t('cmd.view.zoomIn')}>
            <ZoomIn size={13} />
          </button>
        </span>
        {counts && (
          <button className="counts-badge__toggle" onClick={() => setOpen(!open)} title={open ? t('counts.less') : t('counts.more')} aria-expanded={open}>
            {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
