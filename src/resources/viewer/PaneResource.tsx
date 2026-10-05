// Una risorsa nei riquadri accanto all'editor: contenuto con evidenziazione e Bookmark.
import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { useResources } from '../store';
import { ResourceBody } from './ResourceBody';
import { KindIcon, subtitle } from '../ui/common';
import { t } from '../../i18n';

export function PaneResource({ id }: { id: string }) {
  const r = useResources((s) => s.get(id));
  const [focus, setFocus] = useState<string | undefined>();
  if (!r) return <p className="hint">{t('pane.missing')}</p>;
  return (
    <>
      <div className="side-pane__head">
        <KindIcon kind={r.kind} size={13} />
        <span className="side-pane__title">{r.title}</span>
        <span className="hint">{subtitle(r)}</span>
        <span className="grow" />
        <button className="icon-btn" title={t('pane.fullView')} onClick={() => useResources.getState().openViewer(r.id, focus)}>
          <Maximize2 size={13} />
        </button>
      </div>
      <div className="side-pane__resource">
        <ResourceBody r={r} focus={focus} onFocus={setFocus} />
      </div>
    </>
  );
}
