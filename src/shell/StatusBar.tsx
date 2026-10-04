// Barra di stato: conteggi del documento (o della selezione), pagine, zoom.
import { useDoc } from '../editor/session';
import { useWorkspace } from '../state/workspace';
import { useDocSettings, pageMetrics } from '../layout/docSettings';
import { t, useLang } from '../i18n';
import { runCommand } from '../commands/registry';

const fmt = (n: number) => n.toLocaleString(undefined);

export function StatusBar() {
  useLang();
  const counts = useDoc((s) => s.counts);
  const sel = useDoc((s) => s.selection);
  const realPages = useDoc((s) => s.realPages);
  const sourceMode = useDoc((s) => s.sourceMode);
  const view = useWorkspace((s) => s.app.view);
  const zoom = useWorkspace((s) => s.app.prefs.zoom);
  const layout = useDocSettings((s) => s.settings.layout);
  if (view !== 'editor') return <footer className="statusbar" />;
  const wpp = pageMetrics(layout).wordsPerPage;
  const pages = realPages ?? (counts && counts.words ? Math.max(1, Math.ceil(counts.words / wpp)) : 0);
  return (
    <footer className="statusbar">
      {counts && (
        <>
          <span title={t('status.wordsHint')}>
            {sel ? t('status.selWords', { n: fmt(sel.words), total: fmt(counts.words) }) : t('status.words', { n: fmt(counts.words) })}
          </span>
          <span title={t('status.charsHint')}>
            {sel ? t('status.selChars', { n: fmt(sel.chars) }) : t('status.chars', { n: fmt(counts.chars) })}
          </span>
          <span title={t('status.charsNoSpacesHint')}>{t('status.charsNoSpaces', { n: fmt(counts.charsNoSpaces) })}</span>
          <span title={t('status.cartelleHint')}>{t('status.cartelle', { n: counts.cartelle.toLocaleString() })}</span>
          <span title={realPages ? t('status.pagesReal') : t('status.pagesEstimate', { n: wpp })}>
            {realPages ? t('status.pages', { n: pages }) : t('status.pagesApprox', { n: pages })}
          </span>
          <span title={t('status.readingHint')}>{t('status.reading', { n: counts.readingMinutes })}</span>
        </>
      )}
      <span className="grow" />
      {sourceMode && <span className="statusbar__mode">{t('status.source')}</span>}
      <button className="statusbar__zoom" onClick={() => runCommand('view.zoomReset')} title={t('cmd.view.zoomReset')}>
        {Math.round(zoom * 100)}%
      </button>
    </footer>
  );
}
