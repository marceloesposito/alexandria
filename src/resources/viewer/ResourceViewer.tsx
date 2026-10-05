// Visualizzatore di una risorsa dentro l'app: lettura, evidenziazione e pin; a destra i pin.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Crop, ExternalLink, Pin as PinIcon, Trash2, Quote } from 'lucide-react';
import { useResources, fileOf } from '../store';
import { readArchive, readText } from '../storage';
import { PdfViewer } from './PdfViewer';
import { TextViewer, textToBlocks } from './TextViewer';
import { ImageViewer, MediaViewer, YoutubeViewer } from './MediaViewers';
import { SnippetViewer } from './SnippetViewer';
import { removeWithConfirm } from '../ui/remove';
import { thumbUrl, KindIcon, subtitle } from '../ui/common';
import { platform } from '../../platform';
import type { Block } from '../html';
import type { Pin } from '../model';
import { t } from '../../i18n';
import { useWorkspace } from '../../state/workspace';
import { CITE_MIME } from '../../editor/extensions/drop';

export function ResourceViewer() {
  const viewer = useResources((s) => s.viewer);
  const r = useResources((s) => (s.viewer ? s.get(s.viewer.id) : undefined));
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [crop, setCrop] = useState(false);
  const [focus, setFocus] = useState<string | undefined>(viewer?.pin);
  const st = useResources.getState();

  useEffect(() => setFocus(viewer?.pin), [viewer]);

  useEffect(() => {
    setBlocks(null);
    if (!r) return;
    if (['pdf', 'image', 'video', 'audio', 'youtube', 'reference', 'snippet'].includes(r.kind)) return;
    void (async () => {
      const s = r.library ? st.library : st.resources.some((x) => x.id === r.id) ? st.vault : st.library;
      const archived = s ? await readArchive(s, r.library ?? r.id) : null;
      if (archived?.length) setBlocks(archived);
      else setBlocks(textToBlocks((s ? await readText(s, r.library ?? r.id) : null) ?? (await st.textOf(r.id))));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && st.openViewer(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [st]);

  if (!viewer || !r) return null;
  const path = fileOf(r);
  const url = path ? platform.fileUrl(path) : null;
  const focusPin = r.pins.find((p) => p.id === focus);
  const pin = async (p: Omit<Pin, 'id' | 'created'>) => {
    const made = await st.addPin(r.id, p);
    if (made) {
      setFocus(made.id);
      useWorkspace.getState().toast(t('viewer.pinned'), 'ok');
    }
  };
  const canCrop = r.kind === 'pdf' || r.kind === 'image';

  let body: React.ReactNode;
  if (r.kind === 'pdf' && path) body = <PdfViewer r={r} path={path} focusPin={focusPin} cropMode={crop} onPin={pin} />;
  else if (r.kind === 'image' && url) body = <ImageViewer r={r} url={url} focusPin={focusPin} cropMode={crop} onPin={pin} />;
  else if ((r.kind === 'video' || r.kind === 'audio') && url) body = <MediaViewer r={r} url={url} focusPin={focusPin} onPin={pin} />;
  else if (r.kind === 'snippet') body = <SnippetViewer r={r} />;
  else if (r.kind === 'youtube') body = <YoutubeViewer r={r} thumb={thumbUrl(r)} focusPin={focusPin} onPin={pin} />;
  else if (r.kind === 'reference')
    body = (
      <div className="text-viewer">
        <h3>{r.title}</h3>
        <p className="hint">{subtitle(r)}</p>
        {r.csl?.abstract && <p>{r.csl.abstract}</p>}
        <p className="hint">{t('viewer.referenceHint')}</p>
      </div>
    );
  else body = blocks ? <TextViewer r={r} blocks={blocks} focusPin={focusPin} onPin={pin} /> : <div className="viewer__loading">{t('viewer.loading')}</div>;

  return createPortal(
    <div className="viewer-backdrop">
      <div className="viewer" role="dialog" aria-modal aria-label={r.title}>
        <header className="viewer__head">
          <KindIcon kind={r.kind} size={16} />
          <div className="viewer__title">
            <strong>{r.title}</strong>
            <span className="hint">{subtitle(r)}</span>
          </div>
          <span className="grow" />
          {canCrop && (
            <button className={`btn small ${crop ? 'btn--primary' : ''}`} onClick={() => setCrop(!crop)} title={t('viewer.cropHint')}>
              <Crop size={14} /> {t('viewer.crop')}
            </button>
          )}
          {r.url && (
            <button className="btn small" onClick={() => void platform.openExternal(r.url!)}>
              <ExternalLink size={14} /> {t('res.openBrowser')}
            </button>
          )}
          <button className="icon-btn" onClick={() => void removeWithConfirm([r.id])} title={t('cmd.res.remove')}>
            <Trash2 size={16} />
          </button>
          <button className="icon-btn" onClick={() => st.openViewer(null)} title={t('common.close')}>
            <X size={18} />
          </button>
        </header>
        <div className="viewer__main">
          <div className="viewer__body">{body}</div>
          <aside className="viewer__pins">
            <h4>
              <PinIcon size={13} /> {t('res.pinsTitle')} · {r.pins.length}
            </h4>
            {!r.pins.length && <p className="hint">{t('viewer.pinsEmpty')}</p>}
            {r.pins.map((p) => (
              <div
                key={p.id}
                className={`pin-card ${p.id === focus ? 'is-focus' : ''}`}
                draggable={!!r.citeKey}
                onDragStart={(e) => r.citeKey && e.dataTransfer.setData(CITE_MIME, JSON.stringify({ key: r.citeKey, locator: p.locator, pinId: p.id }))}
                onClick={() => setFocus(p.id)}
              >
                <div className="pin-card__head">
                  <span className="pin-card__loc">{p.locator ?? '—'}</span>
                  <span className="grow" />
                  <button
                    className="icon-btn tiny"
                    onClick={(e) => {
                      e.stopPropagation();
                      void st.removePin(r.id, p.id);
                    }}
                    title={t('common.delete')}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                {p.quote ? <blockquote>«{p.quote.length > 220 ? p.quote.slice(0, 220) + '…' : p.quote}»</blockquote> : <div>{p.label}</div>}
                <input
                  className="pin-card__loc-input"
                  placeholder={t('viewer.locator')}
                  defaultValue={p.locator ?? ''}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => e.target.value !== (p.locator ?? '') && void st.updatePin(r.id, p.id, { locator: e.target.value || undefined })}
                />
              </div>
            ))}
            {r.citeKey && (
              <p className="hint">
                <Quote size={11} /> {t('viewer.dragHint', { key: r.citeKey })}
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
