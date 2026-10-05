// Anteprima di una citazione: la scheda di ogni fonte citata (miniatura, autori, anno, sito).
import { useResources } from '../store';
import { ResourceCard } from './common';
import { t } from '../../i18n';

export function CitationPreview({ keys }: { keys: string[] }) {
  const all = useResources((s) => s.resources);
  const lib = useResources((s) => s.libraryItems);
  return (
    <div className="preview-res">
      {keys.map((k) => {
        const r = all.find((x) => x.citeKey === k) ?? lib.find((x) => x.citeKey === k);
        return r ? (
          <div key={k} className="preview-res__item" onClick={() => useResources.getState().openViewer(r.id)}>
            <ResourceCard r={r} />
            {r.meta.description && <p className="preview-res__desc">{r.meta.description}</p>}
          </div>
        ) : (
          <p key={k} className="hint">
            {t('editor.citation.unknown', { key: k })}
          </p>
        );
      })}
    </div>
  );
}
