// Vista Strata: tabella delle risorse come un piccolo database. Colonne a scelta (anche le proprietà
// dei tipi), ordinamento su ogni colonna, raggruppamento per tipo, tag, Strato o proprietà.
import { Fragment, useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, Columns3 } from 'lucide-react';
import { useResources } from '../store';
import { isVisible, layersOf, yearOf, authorsOf, type Resource, type Layer } from '../model';
import { KindIcon, kindLabel } from './common';
import { t } from '../../i18n';
import { RESOURCES_MIME } from './LayersPanel';
import { openContextMenu } from '../../components/ContextMenu';
import { removeWithConfirm } from './remove';
import { useWorkspace } from '../../state/workspace';
import { useSidePane } from '../../editor/paneStore';
import { useTypes } from '../../types/store';
import { typesFor, typeById, sortValue, type ObjectType, type PropDef } from '../../types/model';
import { TypeIcon, propText } from '../../types/ui';
import { Popover } from '../../components/Popover';

const BASE = ['kind', 'author', 'year', 'otype', 'layers', 'tags', 'source'] as const;

/** Proprietà delle risorse, una per chiave. */
function resourceProps(types: ObjectType[]): PropDef[] {
  const out = new Map<string, PropDef>();
  for (const ty of typesFor(types, 'resource')) for (const d of ty.properties) if (!out.has(d.key)) out.set(d.key, d);
  return [...out.values()];
}

export function LayerTable({ results }: { results: Set<string> | null }) {
  const resources = useResources((s) => (s.scope === 'vault' ? s.resources : s.libraryItems));
  const layers = useResources((s) => s.layers);
  const active = useResources((s) => s.activeLayer);
  const texts = useResources((s) => s.texts);
  const selected = useResources((s) => s.selected);
  const types = useTypes((s) => s.types);
  const columns = useWorkspace((s) => s.app.prefs.tableColumns);
  const group = useWorkspace((s) => s.app.prefs.tableGroup);
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: 'title', dir: 1 });
  const [chooser, setChooser] = useState(false);
  const chooserBtn = useRef<HTMLButtonElement>(null);
  const props = useMemo(() => resourceProps(types), [types]);
  const propDef = (col: string) => props.find((d) => `prop:${d.key}` === col);
  const st = useResources.getState();

  const label = (col: string): string => {
    if (col.startsWith('prop:')) return propDef(col)?.label ?? col.slice(5);
    return col === 'otype' ? t('types.type') : col === 'source' ? t('res.source') : t(`table.${col}`);
  };

  const value = (r: Resource, col: string): string | number => {
    switch (col) {
      case 'title':
        return r.title.toLowerCase();
      case 'kind':
        return r.kind;
      case 'author':
        return (authorsOf(r)[0] ?? '').toLowerCase();
      case 'year':
        return yearOf(r) ?? '';
      case 'otype':
        return typeById(types, r.object?.type)?.name.toLowerCase() ?? '';
      case 'layers':
        return layersOf(r, layers, texts.get(r.id))[0]?.name.toLowerCase() ?? '';
      case 'tags':
        return (r.tags[0] ?? '').toLowerCase();
      case 'source':
        return r.isSource ? 1 : 0;
      default: {
        const d = propDef(col);
        return d ? sortValue(d, r.object?.props[d.key]) : '';
      }
    }
  };

  const rows = useMemo(() => {
    const vis = resources.filter((r) => isVisible(r, layers, active, resources, texts) && (!results || results.has(r.id)));
    return vis.sort((a, b) => {
      const x = value(a, sort.k);
      const y = value(b, sort.k);
      // i vuoti vanno sempre in fondo
      if (x === '' && y !== '') return 1;
      if (y === '' && x !== '') return -1;
      return x < y ? -sort.dir : x > y ? sort.dir : a.title.localeCompare(b.title);
    });
  }, [resources, layers, active, texts, sort, results, types]); // eslint-disable-line react-hooks/exhaustive-deps

  // gruppi: una risorsa con più tag, Strati o valori compare in ciascuno
  const groups = useMemo(() => {
    if (!group) return [{ key: '', title: '', items: rows }];
    const map = new Map<string, Resource[]>();
    const add = (k: string, r: Resource) => map.set(k, [...(map.get(k) ?? []), r]);
    for (const r of rows) {
      if (group === 'tags') (r.tags.length ? r.tags : ['']).forEach((x) => add(x, r));
      else if (group === 'layers') {
        const ls = layersOf(r, layers, texts.get(r.id));
        (ls.length ? ls.map((l: Layer) => l.name) : ['']).forEach((x) => add(x, r));
      } else if (group === 'kind') add(kindLabel(r.kind), r);
      else if (group === 'otype') add(typeById(types, r.object?.type)?.name ?? '', r);
      else {
        const d = propDef(group);
        const v = d ? r.object?.props[d.key] : undefined;
        (Array.isArray(v) && v.length ? v : [d ? propText(d, v) : '']).forEach((x) => add(String(x), r));
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, undefined, { numeric: true })))
      .map(([k, items]) => ({ key: k, title: k || t('table.noValue'), items }));
  }, [rows, group, layers, texts, types]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPrefs = useWorkspace.getState().setPrefs;
  const toggleCol = (c: string, on: boolean) => setPrefs({ tableColumns: on ? [...columns, c] : columns.filter((x) => x !== c) });
  const head = (col: string) => (
    <th key={col} onClick={() => setSort({ k: col, dir: sort.k === col ? (-sort.dir as 1 | -1) : 1 })}>
      {col === 'title' ? t('table.title') : label(col)} {sort.k === col && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
    </th>
  );

  const cell = (r: Resource, col: string) => {
    switch (col) {
      case 'kind':
        return kindLabel(r.kind);
      case 'author':
        return authorsOf(r).slice(0, 2).join('; ');
      case 'year':
        return yearOf(r) ?? '';
      case 'otype': {
        const ty = typeById(types, r.object?.type);
        return ty ? (
          <span className="chip">
            <TypeIcon icon={ty.icon} color={ty.color} size={11} /> {ty.name}
          </span>
        ) : null;
      }
      case 'layers':
        return layersOf(r, layers, texts.get(r.id)).map((l) => (
          <span key={l.id} className="chip" style={{ borderColor: l.color }}>
            <span className="layer-dot" style={{ background: l.color }} /> {l.name}
          </span>
        ));
      case 'tags':
        return r.tags.map((x) => (
          <span key={x} className="chip">
            #{x}
          </span>
        ));
      case 'source':
        return <input type="checkbox" checked={r.isSource} onClick={(e) => e.stopPropagation()} onChange={(e) => void st.setSource(r.id, e.target.checked)} />;
      default: {
        const d = propDef(col);
        return d ? propText(d, r.object?.props[d.key]) : '';
      }
    }
  };

  const cols = columns.filter((c) => (BASE as readonly string[]).includes(c) || propDef(c));
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
      <div className="layer-table__bar">
        <label className="layer-table__group">
          {t('table.groupBy')}
          <select className="select small" value={group} onChange={(e) => setPrefs({ tableGroup: e.target.value })}>
            <option value="">{t('table.noGroup')}</option>
            <option value="otype">{t('types.type')}</option>
            <option value="kind">{t('table.kind')}</option>
            <option value="tags">{t('table.tags')}</option>
            <option value="layers">{t('table.layers')}</option>
            {props
              .filter((d) => d.kind === 'select' || d.kind === 'multi' || d.kind === 'checkbox' || d.kind === 'person')
              .map((d) => (
                <option key={d.key} value={`prop:${d.key}`}>
                  {d.label}
                </option>
              ))}
          </select>
        </label>
        <span className="grow" />
        <button ref={chooserBtn} className="btn small" onClick={() => setChooser(!chooser)}>
          <Columns3 size={13} /> {t('table.columns')}
        </button>
        <Popover anchor={chooserBtn.current} open={chooser} onClose={() => setChooser(false)}>
          <div className="popover__form header-settings">
            {[...BASE, ...props.map((d) => `prop:${d.key}`)].map((c) => (
              <label key={c} className="check">
                <input type="checkbox" checked={columns.includes(c)} onChange={(e) => toggleCol(c, e.target.checked)} /> {label(c)}
              </label>
            ))}
          </div>
        </Popover>
      </div>
      <table>
        <thead>
          <tr>
            {head('title')}
            {cols.map(head)}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.key}>
              {group && (
                <tr className="layer-table__grouprow">
                  <td colSpan={cols.length + 1}>
                    {g.title} <span className="hint">{g.items.length}</span>
                  </td>
                </tr>
              )}
              {g.items.map((r) => (
                <tr
                  key={`${g.key}-${r.id}`}
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
                      {
                        label: t('pane.openAside'),
                        onClick: () => {
                          useWorkspace.getState().setView('editor');
                          useSidePane.getState().open({ kind: 'resource', id: r.id });
                        },
                      },
                      { label: t('cmd.res.remove'), danger: true, onClick: () => void removeWithConfirm(ids) },
                    ]);
                  }}
                >
                  <td className="layer-table__title">
                    <KindIcon kind={r.kind} /> {r.title}
                  </td>
                  {cols.map((c) => (
                    <td key={c}>{cell(r, c)}</td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="empty-hint">{t('table.empty')}</div>}
    </div>
  );
}
