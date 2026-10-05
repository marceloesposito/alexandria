// Gestore dei layer stile AutoCAD: albero di gruppi (cartelle) e filtri a regole, con
// acceso/spento, blocco, colore; filtri e gruppi suggeriti dall'app da accettare o scartare.
import { useEffect, useMemo, useState } from 'react';
import {
  Lightbulb,
  LightbulbOff,
  Lock,
  Unlock,
  FolderPlus,
  Filter,
  ChevronRight,
  ChevronDown,
  Folder,
  Sparkles,
  Check,
  X,
  Layers as LayersIcon,
  Search,
  ArrowDownUp,
  Inbox,
} from 'lucide-react';
import { useResources } from '../store';
import { membersOf, LAYER_COLORS, type Layer, type FilterRule } from '../model';
import { suggestGroups, type Suggestion } from '../suggest';
import { t, useLang } from '../../i18n';
import { useWorkspace } from '../../state/workspace';
import { openContextMenu } from '../../components/ContextMenu';
import { promptDialog, confirmDialog } from '../../components/confirm';
import { FilterEditor } from './FilterEditor';
import { KindIcon, subtitle } from './common';
import { removeWithConfirm } from './remove';
import { matchesQuery, sortResources, directMembers, ungrouped, layerHasMatch, RESOURCE_SORTS, type ResourceSort } from '../tree';
import type { Resource } from '../model';

const MIME = 'application/x-alexandria-resources';

export function LayersPanel() {
  useLang();
  const layers = useResources((s) => s.layers);
  const resources = useResources((s) => (s.scope === 'vault' ? s.resources : s.libraryItems));
  const active = useResources((s) => s.activeLayer);
  const texts = useResources((s) => s.texts);
  const dismissed = useResources((s) => s.dismissed);
  const suggestPref = useWorkspace((s) => s.app.prefs.layerSuggestions);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Layer | null>(null);
  const [creatingFilter, setCreatingFilter] = useState(false);
  const [query, setQuery] = useState('');
  const [looseOpen, setLooseOpen] = useState(true);
  const selected = useResources((s) => s.selected);
  const sortBy = useWorkspace((s) => s.app.prefs.resourceSort);
  const st = useResources.getState();
  const searching = query.trim().length > 0;
  const shown = (list: Resource[]) => sortResources(list.filter((r) => matchesQuery(r, query)), sortBy);

  // una risorsa dell'albero: clic seleziona, doppio clic apre, trascinabile nei gruppi e sulla lavagna
  const item = (r: Resource, depth: number, inGroup?: Layer) => (
    <div
      key={`${inGroup?.id ?? 'root'}-${r.id}`}
      className={`res-row ${selected.includes(r.id) ? 'is-selected' : ''}`}
      style={{ paddingLeft: 22 + depth * 16 }}
      draggable
      onDragStart={(e) => e.dataTransfer.setData(MIME, JSON.stringify(selected.includes(r.id) ? selected : [r.id]))}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) st.select(selected.includes(r.id) ? selected.filter((x) => x !== r.id) : [...selected, r.id]);
        else st.select([r.id]);
        st.openInspector(r.id);
      }}
      onDoubleClick={() => st.openViewer(r.id)}
      onContextMenu={(e) => {
        const ids = selected.includes(r.id) ? selected : [r.id];
        if (!selected.includes(r.id)) st.select([r.id]);
        openContextMenu(e, [
          { label: t('embed.open'), onClick: () => st.openViewer(r.id) },
          ...(inGroup && inGroup.kind === 'group' ? [{ label: t('layers.removeFromGroup', { name: inGroup.name }), onClick: () => void st.assignLayer(ids, inGroup.id, false) }] : []),
          { sep: true, label: '' },
          { label: t('cmd.res.remove'), danger: true, onClick: () => void removeWithConfirm(ids) },
        ]);
      }}
      title={`${r.title}\n${subtitle(r)}`}
    >
      <KindIcon kind={r.kind} size={13} />
      <span className="res-row__title">{r.title}</span>
    </div>
  );

  // testo delle risorse per i filtri sul contenuto e per i suggerimenti
  useEffect(() => {
    resources.forEach((r) => void st.textOf(r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources.length]);

  const suggestions = useMemo(
    () => (suggestPref === 'suggest' ? suggestGroups(resources, texts, new Set(dismissed)).filter((s) => !layers.some((l) => l.name === s.name)) : []),
    [resources, texts, dismissed, layers, suggestPref],
  );

  const children = (parent: string | null) => layers.filter((l) => l.parent === parent);

  const accept = (s: Suggestion, asGroup: boolean) => {
    if (asGroup) {
      const l = st.addLayer({ name: s.name, kind: 'group', suggested: true, reason: t(s.reason.code, s.reason.vars) });
      void st.assignLayer(s.members, l.id, true);
    } else {
      st.addLayer({ name: s.name, kind: 'filter', rule: s.rule, suggested: true, reason: t(s.reason.code, s.reason.vars) });
    }
  };

  const row = (l: Layer, depth: number): React.ReactNode => {
    if (searching && !layerHasMatch(l, layers, resources, query, texts)) return null;
    const kids = children(l.id);
    const members = shown(directMembers(l, resources, texts));
    const isOpen = searching || open.has(l.id);
    const count = membersOf(l, layers, resources, texts).length;
    return (
      <div key={l.id}>
        <div
          className={`layer-row ${active === l.id ? 'is-active' : ''} ${l.visible ? '' : 'is-off'}`}
          style={{ paddingLeft: 6 + depth * 16 }}
          onClick={() => st.setActiveLayer(l.id)}
          onContextMenu={(e) =>
            openContextMenu(e, [
              {
                label: t('layers.rename'),
                onClick: async () => {
                  const name = await promptDialog(t('layers.rename'), l.name);
                  if (name?.trim()) st.updateLayer(l.id, { name: name.trim() });
                },
              },
              ...(l.kind === 'filter' ? [{ label: t('layers.editRule'), onClick: () => setEditing(l) }] : []),
              {
                label: t('layers.newSub'),
                onClick: async () => {
                  const name = await promptDialog(t('layers.newGroup'), t('layers.newGroupDefault'));
                  if (name?.trim()) {
                    st.addLayer({ name: name.trim(), parent: l.id });
                    setOpen(new Set([...open, l.id]));
                  }
                },
              },
              { label: t('layers.toRoot'), disabled: !l.parent, onClick: () => st.updateLayer(l.id, { parent: null }) },
              { sep: true, label: '' },
              {
                label: t('common.delete'),
                danger: true,
                onClick: async () => {
                  if (await confirmDialog(t('layers.confirmDelete', { name: l.name }), t('layers.confirmDeleteHint'), { danger: true, okLabel: t('common.delete') }))
                    st.removeLayer(l.id);
                },
              },
            ])
          }
          onDragOver={(e) => {
            if (l.kind === 'group' && (e.dataTransfer.types.includes(MIME) || e.dataTransfer.types.includes('application/x-alexandria-layer'))) e.preventDefault();
          }}
          onDrop={(e) => {
            const ids = e.dataTransfer.getData(MIME);
            const layerId = e.dataTransfer.getData('application/x-alexandria-layer');
            if (ids) void st.assignLayer(JSON.parse(ids), l.id, true);
            if (layerId && layerId !== l.id) st.updateLayer(layerId, { parent: l.id });
          }}
          draggable
          onDragStart={(e) => e.dataTransfer.setData('application/x-alexandria-layer', l.id)}
          title={l.reason ?? ''}
        >
          <button
            className="icon-btn tiny"
            onClick={(e) => {
              e.stopPropagation();
              const n = new Set(open);
              if (isOpen) n.delete(l.id);
              else n.add(l.id);
              setOpen(n);
            }}
            style={{ visibility: kids.length || members.length ? 'visible' : 'hidden' }}
          >
            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {l.kind === 'filter' ? <Filter size={13} className="layer-row__kind" /> : <Folder size={13} className="layer-row__kind" />}
          <span className="layer-row__name">{l.name}</span>
          {l.suggested && <Sparkles size={11} className="layer-row__sugg" />}
          <span className="layer-row__count">{count}</span>
          <button
            className="layer-row__swatch"
            style={{ background: l.color }}
            title={t('layers.color')}
            onClick={(e) => {
              e.stopPropagation();
              const i = LAYER_COLORS.indexOf(l.color);
              st.updateLayer(l.id, { color: LAYER_COLORS[(i + 1) % LAYER_COLORS.length] });
            }}
          />
          <button
            className="icon-btn tiny"
            title={l.visible ? t('layers.turnOff') : t('layers.turnOn')}
            onClick={(e) => {
              e.stopPropagation();
              st.updateLayer(l.id, { visible: !l.visible });
            }}
          >
            {l.visible ? <Lightbulb size={13} className="is-on-bulb" /> : <LightbulbOff size={13} />}
          </button>
          <button
            className="icon-btn tiny"
            title={l.locked ? t('layers.unlock') : t('layers.lock')}
            onClick={(e) => {
              e.stopPropagation();
              st.updateLayer(l.id, { locked: !l.locked });
            }}
          >
            {l.locked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>
        </div>
        {isOpen && kids.map((k) => row(k, depth + 1))}
        {isOpen && members.map((r) => item(r, depth + 1, l))}
      </div>
    );
  };

  return (
    <div className="layers">
      <header className="side-section__head">
        <LayersIcon size={12} />
        <span>{t('layers.title')}</span>
        <button
          className="icon-btn"
          title={t('layers.newGroup')}
          onClick={async () => {
            const name = await promptDialog(t('layers.newGroup'), t('layers.newGroupDefault'));
            if (name?.trim()) st.addLayer({ name: name.trim() });
          }}
        >
          <FolderPlus size={14} />
        </button>
        <button className="icon-btn" title={t('layers.newFilter')} onClick={() => setCreatingFilter(true)}>
          <Filter size={14} />
        </button>
      </header>
      <div
        className={`layer-row layer-row--all ${active === null ? 'is-active' : ''}`}
        onClick={() => st.setActiveLayer(null)}
      >
        <LayersIcon size={13} /> <span className="layer-row__name">{t('layers.all')}</span>
        <span className="layer-row__count">{resources.length}</span>
      </div>
      <div className="tree-tools">
        <label className="tree-tools__search">
          <Search size={12} />
          <input className="input" value={query} placeholder={t('tree.filter')} onChange={(e) => setQuery(e.target.value)} aria-label={t('tree.filter')} />
        </label>
        <label className="tree-tools__sort" title={t('tree.sort')}>
          <ArrowDownUp size={12} />
          <select className="select small" value={sortBy} aria-label={t('tree.sort')} onChange={(e) => useWorkspace.getState().setPrefs({ resourceSort: e.target.value as ResourceSort })}>
            {RESOURCE_SORTS.map((k) => (
              <option key={k} value={k}>
                {t(`tree.sort.${k}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {children(null).map((l) => row(l, 0))}
      {(() => {
        const loose = shown(ungrouped(resources, layers));
        if (!loose.length) return null;
        const isOpen = searching || looseOpen;
        return (
          <>
            <div className="layer-row layer-row--loose" onClick={() => setLooseOpen(!looseOpen)}>
              <span className="icon-btn tiny">{isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
              <Inbox size={13} className="layer-row__kind" />
              <span className="layer-row__name">{layers.some((l) => l.kind === 'group') ? t('tree.ungrouped') : t('tree.all')}</span>
              <span className="layer-row__count">{loose.length}</span>
            </div>
            {isOpen && loose.map((r) => item(r, 0))}
          </>
        );
      })()}
      {searching && !resources.some((r) => matchesQuery(r, query)) && <p className="hint layers__empty">{t('tree.noMatch')}</p>}
      {!layers.length && !resources.length && <p className="hint layers__empty">{t('layers.empty')}</p>}

      {suggestions.length > 0 && (
        <section className="layers__suggest">
          <header className="side-section__head">
            <Sparkles size={12} />
            <span>{t('layers.suggested')}</span>
          </header>
          {suggestions.map((s) => (
            <div key={s.key} className="suggest-row" title={t(s.reason.code, s.reason.vars)}>
              <div className="suggest-row__text">
                <span className="suggest-row__name">{s.name}</span>
                <span className="hint">{t(s.reason.code, s.reason.vars)}</span>
              </div>
              <button className="icon-btn tiny" title={t('layers.acceptFilter')} onClick={() => accept(s, false)}>
                <Filter size={12} />
              </button>
              <button className="icon-btn tiny" title={t('layers.acceptGroup')} onClick={() => accept(s, true)}>
                <Check size={12} />
              </button>
              <button className="icon-btn tiny" title={t('layers.dismiss')} onClick={() => st.dismissSuggestion(s.key)}>
                <X size={12} />
              </button>
            </div>
          ))}
        </section>
      )}
      {(editing || creatingFilter) && (
        <FilterEditor
          initial={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            setCreatingFilter(false);
          }}
          onSave={(name: string, rule: FilterRule) => {
            if (editing) st.updateLayer(editing.id, { name, rule });
            else st.addLayer({ name, kind: 'filter', rule });
            setEditing(null);
            setCreatingFilter(false);
          }}
        />
      )}
    </div>
  );
}

export { MIME as RESOURCES_MIME };
