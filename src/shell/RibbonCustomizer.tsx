// Personalizzazione del ribbon: comandi trascinati dalla lista ai gruppi, schede e gruppi
// aggiunti, rinominati, nascosti e spostati. Import/export in JSON.
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Plus, Trash2, Pencil, X, Download, Upload, RotateCcw } from 'lucide-react';
import { Modal } from '../components/Modal';
import { allCommands, getCommand } from '../commands/registry';
import {
  addGroup,
  addTab,
  insertCommand,
  moveCommand,
  moveGroup,
  moveTab,
  removeCommand,
  removeGroup,
  removeTab,
  renameGroup,
  renameTab,
  toggleTabHidden,
  validateImported,
  type RibbonConfig,
} from '../commands/ribbonModel';
import { useRibbonConfig, labelOf } from './Ribbon';
import { useWorkspace } from '../state/workspace';
import { t } from '../i18n';
import type { View } from '../state/prefs';
import { promptDialog, confirmDialog } from '../components/confirm';
import { platform } from '../platform';

const DRAG_MIME = 'application/x-alexandria-ribbon';

interface DragData {
  cmd: string;
  from: string | null; // gruppo di partenza, null = dalla lista
}

export function RibbonCustomizer() {
  const cfg = useRibbonConfig();
  const ws = useWorkspace.getState();
  const close = () => ws.closeDialog();
  const arg = useWorkspace((s) => s.dialogArg) as { tab?: string } | null;
  const currentView = useWorkspace((s) => s.app.view);
  const size = useWorkspace((s) => s.app.prefs.ribbonSize);
  const [view, setView] = useState<View>(() => cfg.tabs.find((x) => x.id === arg?.tab)?.view ?? currentView);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [dropAt, setDropAt] = useState<{ group: string; index: number } | null>(null);

  const save = (next: RibbonConfig) => ws.setRibbon(next);
  const tabs = cfg.tabs.filter((x) => x.view === view);

  const commands = useMemo(
    () =>
      allCommands()
        .filter((c) => !c.views || c.views.includes(view))
        .filter((c) => category === 'all' || c.category === category)
        .filter((c) => !query || t(c.label).toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => t(a.label).localeCompare(t(b.label))),
    [view, category, query],
  );
  const categories = useMemo(() => [...new Set(allCommands().map((c) => c.category))].sort(), []);

  const onDrop = (group: string, index: number, e: React.DragEvent) => {
    e.preventDefault();
    setDropAt(null);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    const d = JSON.parse(raw) as DragData;
    save(d.from ? moveCommand(cfg, d.from, d.cmd, group, index) : insertCommand(cfg, group, d.cmd, index));
  };

  const exportJson = async () => {
    const path = await platform.saveDialog('alexandria-ribbon.json', ['json']);
    if (!path) return;
    await platform.writeText(path, JSON.stringify(cfg, null, 2));
    ws.toast(t('ribbon.custom.exported'), 'ok');
  };

  const importJson = async () => {
    const [path] = await platform.pickFiles(t('ribbon.custom.import'));
    if (!path) return;
    try {
      const parsed = validateImported(JSON.parse(await platform.readText(path)));
      if (!parsed) throw new Error(t('ribbon.custom.invalid'));
      save(parsed);
      ws.toast(t('ribbon.custom.imported'), 'ok');
    } catch (e) {
      ws.toast(String(e), 'error');
    }
  };

  return (
    <Modal
      title={t('ribbon.custom.title')}
      onClose={close}
      size="large"
      className="ribbon-custom"
      footer={
        <>
          <label className="check">
            <input type="checkbox" checked={size === 'small'} onChange={() => ws.setPrefs({ ribbonSize: size === 'small' ? 'large' : 'small' })} />
            {t('ribbon.ctx.small')}
          </label>
          <span className="grow" />
          <button className="btn" onClick={importJson}>
            <Upload size={14} /> {t('ribbon.custom.import')}
          </button>
          <button className="btn" onClick={exportJson}>
            <Download size={14} /> {t('ribbon.custom.export')}
          </button>
          <button
            className="btn"
            onClick={async () => {
              if (await confirmDialog(t('ribbon.custom.resetConfirm'))) ws.setRibbon(null);
            }}
          >
            <RotateCcw size={14} /> {t('ribbon.ctx.reset')}
          </button>
          <button className="btn btn--primary" onClick={close}>
            {t('common.done')}
          </button>
        </>
      }
    >
      <div className="ribbon-custom__views" role="tablist">
        {(['resources', 'editor', 'versions'] as View[]).map((v) => (
          <button key={v} role="tab" aria-selected={v === view} className={`seg ${v === view ? 'is-active' : ''}`} onClick={() => setView(v)}>
            {t(`nav.${v}`)}
          </button>
        ))}
      </div>
      <div className="ribbon-custom__cols">
        <div className="ribbon-custom__palette">
          <div className="ribbon-custom__filters">
            <input className="input" placeholder={t('ribbon.custom.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">{t('ribbon.custom.allCategories')}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {t(`category.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <p className="hint">{t('ribbon.custom.dragHint')}</p>
          <div className="ribbon-custom__list">
            {commands.map((c) => (
              <div
                key={c.id}
                className="ribbon-custom__cmd"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ cmd: c.id, from: null } satisfies DragData));
                  e.dataTransfer.effectAllowed = 'copyMove';
                }}
              >
                {c.icon ? <c.icon size={16} /> : <span className="ribbon-custom__noicon" />}
                <span>{t(c.label)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ribbon-custom__tabs">
          {tabs.map((tab, ti) => (
            <section key={tab.id} className={`ribbon-custom__tab ${tab.hidden ? 'is-hidden' : ''}`}>
              <header className="ribbon-custom__tab-head">
                <strong>{labelOf(tab.label, tab.custom)}</strong>
                <span className="grow" />
                <button className="icon-btn" title={t('ribbon.custom.moveLeft')} disabled={ti === 0} onClick={() => save(moveTab(cfg, tab.id, -1))}>
                  <ArrowLeft size={14} />
                </button>
                <button className="icon-btn" title={t('ribbon.custom.moveRight')} disabled={ti === tabs.length - 1} onClick={() => save(moveTab(cfg, tab.id, 1))}>
                  <ArrowRight size={14} />
                </button>
                <button
                  className="icon-btn"
                  title={t('ribbon.custom.rename')}
                  onClick={async () => {
                    const name = await promptDialog(t('ribbon.custom.renameTab'), labelOf(tab.label, tab.custom));
                    if (name?.trim()) save(renameTab(cfg, tab.id, name.trim()));
                  }}
                >
                  <Pencil size={14} />
                </button>
                <button className="icon-btn" title={tab.hidden ? t('ribbon.custom.show') : t('ribbon.custom.hide')} onClick={() => save(toggleTabHidden(cfg, tab.id))}>
                  {tab.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                {tab.custom && (
                  <button className="icon-btn" title={t('common.delete')} onClick={() => save(removeTab(cfg, tab.id))}>
                    <Trash2 size={14} />
                  </button>
                )}
              </header>
              <div className="ribbon-custom__groups">
                {tab.groups.map((g, gi) => (
                  <div key={g.id} className="ribbon-custom__group">
                    <div className="ribbon-custom__group-head">
                      <span>{labelOf(g.label, g.custom)}</span>
                      <span className="grow" />
                      <button className="icon-btn" disabled={gi === 0} onClick={() => save(moveGroup(cfg, g.id, -1))} title={t('ribbon.custom.moveLeft')}>
                        <ArrowLeft size={12} />
                      </button>
                      <button className="icon-btn" disabled={gi === tab.groups.length - 1} onClick={() => save(moveGroup(cfg, g.id, 1))} title={t('ribbon.custom.moveRight')}>
                        <ArrowRight size={12} />
                      </button>
                      <button
                        className="icon-btn"
                        title={t('ribbon.custom.rename')}
                        onClick={async () => {
                          const name = await promptDialog(t('ribbon.custom.renameGroup'), labelOf(g.label, g.custom));
                          if (name?.trim()) save(renameGroup(cfg, g.id, name.trim()));
                        }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button className="icon-btn" title={t('common.delete')} onClick={() => save(removeGroup(cfg, g.id))}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div
                      className="ribbon-custom__items"
                      onDragOver={(e) => {
                        if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
                        e.preventDefault();
                        if (dropAt?.group !== g.id) setDropAt({ group: g.id, index: g.items.length });
                      }}
                      onDragLeave={() => setDropAt(null)}
                      onDrop={(e) => onDrop(g.id, dropAt?.group === g.id ? dropAt.index : g.items.length, e)}
                    >
                      {g.items.map((id, i) => {
                        const c = getCommand(id);
                        if (!c) return null;
                        return (
                          <div
                            key={id}
                            className={`ribbon-custom__item ${dropAt?.group === g.id && dropAt.index === i ? 'drop-before' : ''}`}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ cmd: id, from: g.id } satisfies DragData))}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              const idx = e.clientX < r.left + r.width / 2 ? i : i + 1;
                              if (dropAt?.group !== g.id || dropAt.index !== idx) setDropAt({ group: g.id, index: idx });
                            }}
                            title={t(c.label)}
                          >
                            {c.icon ? <c.icon size={16} /> : <span className="ribbon-custom__noicon" />}
                            <span className="ribbon-custom__item-label">{t(c.label)}</span>
                            <button className="icon-btn tiny" onClick={() => save(removeCommand(cfg, g.id, id))} title={t('ribbon.custom.removeItem')}>
                              <X size={11} />
                            </button>
                          </div>
                        );
                      })}
                      {!g.items.length && <span className="hint">{t('ribbon.custom.emptyGroup')}</span>}
                    </div>
                  </div>
                ))}
                <button
                  className="btn small ribbon-custom__add"
                  onClick={async () => {
                    const name = await promptDialog(t('ribbon.custom.newGroup'), t('ribbon.custom.newGroupDefault'));
                    if (name?.trim()) save(addGroup(cfg, tab.id, name.trim()));
                  }}
                >
                  <Plus size={13} /> {t('ribbon.custom.addGroup')}
                </button>
              </div>
            </section>
          ))}
          <button
            className="btn"
            onClick={async () => {
              const name = await promptDialog(t('ribbon.custom.newTab'), t('ribbon.custom.newTabDefault'));
              if (name?.trim()) save(addTab(cfg, view, name.trim()));
            }}
          >
            <Plus size={14} /> {t('ribbon.custom.addTab')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
