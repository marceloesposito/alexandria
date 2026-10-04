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
} from 'lucide-react';
import { useResources } from '../store';
import { membersOf, LAYER_COLORS, type Layer, type FilterRule } from '../model';
import { suggestGroups, type Suggestion } from '../suggest';
import { t, useLang } from '../../i18n';
import { useWorkspace } from '../../state/workspace';
import { openContextMenu } from '../../components/ContextMenu';
import { promptDialog, confirmDialog } from '../../components/confirm';
import { FilterEditor } from './FilterEditor';

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
  const st = useResources.getState();

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
    const kids = children(l.id);
    const isOpen = open.has(l.id);
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
            style={{ visibility: kids.length ? 'visible' : 'hidden' }}
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
      {children(null).map((l) => row(l, 0))}
      {!layers.length && <p className="hint layers__empty">{t('layers.empty')}</p>}

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
