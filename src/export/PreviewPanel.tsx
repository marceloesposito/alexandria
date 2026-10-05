// Anteprima di stampa: le pagine reali impaginate da Typst, aggiornate mentre si scrive.
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, ZoomIn, ZoomOut, FileDown } from 'lucide-react';
import { renderPreview } from './run';
import { getEditor, onEditor } from '../state/editorRef';
import { useDocSettings } from '../layout/docSettings';
import { useDoc } from '../editor/session';
import { useResources } from '../resources/store';
import { platform } from '../platform';
import { runCommand } from '../commands/registry';
import { t, useLang } from '../i18n';

export function PreviewPanel() {
  useLang();
  const [pages, setPages] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [scale, setScale] = useState(0.6);
  const settings = useDocSettings((s) => s.settings);
  const resources = useResources((s) => s.resources);
  const urls = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);

  const render = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const out = await renderPreview();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      // le pagine sono immagini SVG: niente script, mostrate come <img>
      urls.current = out.pages.map((svg) => URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
      setPages(urls.current);
      setErrors(out.errors);
      if (out.pages.length) useDoc.setState({ realPages: out.pages.length });
    } catch (e) {
      setErrors([String(e)]);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const schedule = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void render(), 1200);
  };

  useEffect(() => {
    void render();
    let editor = getEditor();
    editor?.on('update', schedule);
    const off = onEditor((e) => {
      editor?.off('update', schedule);
      editor = e;
      e?.on('update', schedule);
      schedule();
    });
    return () => {
      off();
      editor?.off('update', schedule);
      if (timer.current) clearTimeout(timer.current);
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, resources]);

  const mm = 96 / 25.4;
  const w = settings.layout.widthMm * mm * scale;

  return (
    <div className="preview">
      <header className="preview__bar">
        <strong>{t('preview.title')}</strong>
        <span className="hint">{pages.length ? t('preview.pages', { n: pages.length }) : ''}</span>
        <span className="grow" />
        <button className="icon-btn" title={t('cmd.view.zoomOut')} onClick={() => setScale(Math.max(0.3, scale - 0.1))}>
          <ZoomOut size={14} />
        </button>
        <button className="icon-btn" title={t('cmd.view.zoomIn')} onClick={() => setScale(Math.min(1.5, scale + 0.1))}>
          <ZoomIn size={14} />
        </button>
        <button className="icon-btn" title={t('preview.refresh')} onClick={() => void render()}>
          <RefreshCw size={14} className={busy ? 'spin' : ''} />
        </button>
        <button className="icon-btn" title={t('cmd.file.exportPdf')} onClick={() => void runCommand('file.exportPdf')}>
          <FileDown size={14} />
        </button>
      </header>
      <div className="preview__pages">
        {platform.kind !== 'tauri' && <p className="hint preview__note">{t('preview.desktopOnly')}</p>}
        {errors.length > 0 && (
          <div className="preview__errors">
            {errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}
        {pages.map((u, i) => (
          <figure key={u} className="preview__page" style={{ width: w }}>
            <img src={u} alt={t('preview.page', { n: i + 1 })} />
            <figcaption>{i + 1}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
