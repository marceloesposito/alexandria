// Vista Layer: tabella delle risorse con layer, tag e fonte (come la gestione dei layer di AutoCAD).
import { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useResources } from '../store';
import { isVisible, layersOf, yearOf, authorsOf, type Resource } from '../model';
import { KindIcon, kindLabel } from './common';
import { t } from '../../i18n';
import { RESOURCES_MIME } from './LayersPanel';
import { openContextMenu } from '../../components/ContextMenu';
import { removeWithConfirm } from './remove';

type SortKey = 'title' | 'kind' | 'author' | 'year';

export function LayerTable({ results }: { results: Set<string> | null }) {
  const resources = useResources((s) => (s.scope === 'vault' ? s.resources : s.libraryItems));
  const layers = useResources((s) => s.layers);
  const active = useResources((s) => s.activeLayer);
  const texts = useResources((s) => s.texts);
  const selected = useResources((s) => s.selected);
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'title', dir: 1 });

  const rows = useMemo(() => {
    const vis = resources.filter((r) => isVisible(r, layers, active, resources, texts) && (!results || results.has(r.id)));
    const key = (r: Resource): string | number =>
      sort.k === 'title' ? r.title.toLowerCase() : sort.k === 'kind' ? r.kind : sort.k === 'author' ? (authorsOf(r)[0] ?? '').toLowerCase() : yearOf(r) ?? 0;
    return vis.sort((a, b) => (key(a) < key(b) ? -sort.dir : key(a) > key(b) ? sort.dir : 0));
  }, [resources, layers, active, texts, sort, results]);

  const head = (k: SortKey, label: string) => (
    <th onClick={() => setSort({ k, dir: sort.k === k ? (-sort.dir as 1 | -1) : 1 })}>
      {label} {sort.k === k && <ArrowUpDown size={11} />}
    </th>
  );

  const st = useResources.getState();
  return (
    <div
      className="layer-table"
      tabIndex={-1}
      onKeyDown={(e) => {
        // Canc / Backspace sulla selezione della tabella
        if ((e.key === 'Delete' || e.key === 'Backspace') && selected.length && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) {
          e.preventDefault();
          void removeWithConfirm(selected);
        }
      }}
    >
      <table>
        <thead>
          <tr>
            {head('title', t('table.title'))}
            {head('kind', t('table.kind'))}
            {head('author', t('table.author'))}
            {head('year', t('table.year'))}
            <th>{t('table.layers')}</th>
            <th>{t('table.tags')}</th>
            <th>{t('res.source')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={selected.includes(r.id) ? 'is-selected' : ''}
              draggable
              onDragStart={(e) => {
                const ids = selected.includes(r.id) ? selected : [r.id];
                e.dataTransfer.setData(RESOURCES_MIME, JSON.stringify(ids));
              }}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) st.select(selected.includes(r.id) ? selected.filter((x) => x !== r.id) : [...selected, r.id]);
                else st.select([r.id]);
                st.openInspector(r.id);
              }}
              onDoubleClick={() => st.openViewer(r.id)}
              onContextMenu={(e) => {
                const ids = selected.includes(r.id) ? selected : [r.id];
                if (!selected.includes(r.id)) st.select([r.id]);
                openContextMenu(e, [
                  { label: t('embed.open'), onClick: () => st.openViewer(r.id) },
                  { label: t('cmd.res.remove'), danger: true, onClick: () => void removeWithConfirm(ids) },
                ]);
              }}
            >
              <td className="layer-table__title">
                <KindIcon kind={r.kind} /> {r.title}
              </td>
              <td>{kindLabel(r.kind)}</td>
              <td>{authorsOf(r).slice(0, 2).join('; ')}</td>
              <td>{yearOf(r) ?? ''}</td>
              <td>
                {layersOf(r, layers, texts.get(r.id)).map((l) => (
                  <span key={l.id} className="chip" style={{ borderColor: l.color }}>
                    <span className="layer-dot" style={{ background: l.color }} /> {l.name}
                  </span>
                ))}
              </td>
              <td>
                {r.tags.map((x) => (
                  <span key={x} className="chip">
                    #{x}
                  </span>
                ))}
              </td>
              <td>
                <input type="checkbox" checked={r.isSource} onClick={(e) => e.stopPropagation()} onChange={(e) => void st.setSource(r.id, e.target.checked)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="empty-hint">{t('table.empty')}</div>}
    </div>
  );
}
