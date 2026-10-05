// Footer della vista senza bordi: una riga con le pergamene collegate a quella aperta (dalla Tabula),
// cliccabili per aprirle. Non fa parte del testo: non compare nella vista Pagina ne' nell'export.
import { useState } from 'react';
import { ScrollText, Link2, Plus } from 'lucide-react';
import { useResources } from '../store';
import { useWorkspace } from '../../state/workspace';
import { linkedDocs, docNodeId } from '../docLinks';
import { DocPicker } from './DocPicker';
import { t, useLang } from '../../i18n';

const MAX = 5;

export function DocLinksFooter() {
  useLang();
  const links = useResources((s) => s.links);
  const docs = useWorkspace((s) => s.docs);
  const active = useWorkspace((s) => s.activeDoc);
  const [picking, setPicking] = useState(false);
  if (!active) return null;
  const linked = linkedDocs(links, active)
    .map((rel) => docs.find((d) => d.rel === rel))
    .filter((d) => !!d);
  const shown = linked.slice(0, MAX);
  const ws = useWorkspace.getState();

  return (
    <footer className="doc-links" contentEditable={false}>
      <Link2 size={13} className="doc-links__icon" />
      <span className="doc-links__count">{linked.length ? t('doclinks.count', { n: linked.length }) : t('doclinks.none')}</span>
      {shown.map((d) => (
        <button key={d!.rel} className="doc-links__tag" title={d!.rel} onClick={() => ws.openDoc(d!.rel)}>
          <ScrollText size={12} /> {d!.title}
        </button>
      ))}
      {linked.length > MAX && (
        <button className="doc-links__more" title={linked.slice(MAX).map((d) => d!.title).join(', ')} onClick={() => setPicking(true)}>
          {t('doclinks.more', { n: linked.length - MAX })}
        </button>
      )}
      <button className="doc-links__add" title={t('wb.doc.linkTo')} onClick={() => setPicking(true)}>
        <Plus size={12} /> {linked.length ? '' : t('doclinks.link')}
      </button>
      {picking && (
        <DocPicker
          title={t('wb.doc.linkTitle', { name: docs.find((d) => d.rel === active)?.title ?? '' })}
          action={t('wb.doc.linkAction')}
          exclude={[active, ...linked.map((d) => d!.rel)]}
          onPick={(rels) => {
            const st = useResources.getState();
            // anche sulla Tabula, cosi' i legami si vedono e si modificano li'
            const w = st.whiteboard;
            const have = new Set(w.docs ?? []);
            st.setWhiteboard({ ...w, docs: [...(w.docs ?? []), ...[active, ...rels].filter((r) => !have.has(r))] });
            for (const r of rels) st.addLink(docNodeId(active), docNodeId(r));
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </footer>
  );
}
