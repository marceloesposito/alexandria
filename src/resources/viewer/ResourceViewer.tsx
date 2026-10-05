// Visualizzatore di una risorsa dentro l'app: lettura, evidenziazione e pin; a destra i pin.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Crop, ExternalLink, Pin as PinIcon, Trash2, Quote } from 'lucide-react';
import { useResources } from '../store';
import { ResourceBody } from './ResourceBody';
import { removeWithConfirm } from '../ui/remove';
import { KindIcon, subtitle } from '../ui/common';
import { platform } from '../../platform';
import { t } from '../../i18n';
import { CITE_MIME } from '../../editor/extensions/drop';

export function ResourceViewer() {
  const viewer = useResources((s) => s.viewer);
  const r = useResources((s) => (s.viewer ? s.get(s.viewer.id) : undefined));
  const [crop, setCrop] = useState(false);
  const [focus, setFocus] = useState<string | undefined>(viewer?.pin);
  const st = useResources.getState();

  useEffect(() => setFocus(viewer?.pin), [viewer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && st.openViewer(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [st]);

  if (!viewer || !r) return null;
  const canCrop = r.kind === 'pdf' || r.kind === 'image';
  const body = <ResourceBody r={r} focus={focus} onFocus={setFocus} crop={crop} />;

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
