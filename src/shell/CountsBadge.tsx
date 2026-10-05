// Conteggi del documento (o della selezione), pagine e zoom: etichetta flottante in basso a destra
// della colonna centrale. Chiusa mostra parole e pagine, aperta tutti i conteggi.
import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useDoc } from '../editor/session';
import { useWorkspace } from '../state/workspace';
import { useDocSettings, pageMetrics } from '../layout/docSettings';
import { t, useLang } from '../i18n';
import { runCommand } from '../commands/registry';

const fmt = (n: number) => n.toLocaleString(undefined);

export function CountsBadge() {
  useLang();
  const counts = useDoc((s) => s.counts);
  const sel = useDoc((s) => s.selection);
  const realPages = useDoc((s) => s.realPages);
  const sourceMode = useDoc((s) => s.sourceMode);
  const zoom = useWorkspace((s) => s.app.prefs.zoom);
  const layout = useDocSettings((s) => s.settings.layout);
  const [open, setOpen] = useState(false);
  const wpp = pageMetrics(layout).wordsPerPage;
  const pages = realPages ?? (counts && counts.words ? Math.max(1, Math.ceil(counts.words / wpp)) : 0);

  const words = counts && (
    <span title={t('status.wordsHint')}>
      {sel ? t('status.selWords', { n: fmt(sel.words), total: fmt(counts.words) }) : t('status.words', { n: fmt(counts.words) })}
    </span>
  );
  const pagesEl = counts && (
    <span title={realPages ? t('status.pagesReal') : t('status.pagesEstimate', { n: wpp })}>
      {realPages ? t('status.pages', { n: pages }) : t('status.pagesApprox', { n: pages })}
    </span>
  );

  return (
    <div className={`counts-badge ${open ? 'is-open' : ''}`} aria-live="polite">
      {open && counts && (
        <div className="counts-badge__list">
          {words}
          <span title={t('status.charsHint')}>
            {sel ? t('status.selChars', { n: fmt(sel.chars) }) : t('status.chars', { n: fmt(counts.chars) })}
          </span>
          <span title={t('status.charsNoSpacesHint')}>{t('status.charsNoSpaces', { n: fmt(counts.charsNoSpaces) })}</span>
          <span title={t('status.cartelleHint')}>{t('status.cartelle', { n: counts.cartelle.toLocaleString() })}</span>
          {pagesEl}
          <span title={t('status.readingHint')}>{t('status.reading', { n: counts.readingMinutes })}</span>
        </div>
      )}
      <div className="counts-badge__bar">
        {sourceMode && <span className="counts-badge__mode">{t('status.source')}</span>}
        {!open && counts && (
          <>
            {words}
            <span className="counts-badge__dot">·</span>
            {pagesEl}
          </>
        )}
        <button className="counts-badge__zoom" onClick={() => runCommand('view.zoomReset')} title={t('cmd.view.zoomReset')}>
          {Math.round(zoom * 100)}%
        </button>
        {counts && (
          <button className="counts-badge__toggle" onClick={() => setOpen(!open)} title={open ? t('counts.less') : t('counts.more')} aria-expanded={open}>
            {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
