// Ribbon contestuale stile Word/AutoCAD: schede della vista corrente, gruppi di comandi con icone.
// Ogni gruppo si trascina dalla maniglia in basso a destra (anche nel cestino, per toglierlo) e puo'
// essere esteso o compatto: un solo pulsante che apre gli strumenti in un pannello.
// Tasto destro: personalizza, icone piccole, comprimi, ripristina.
import { useMemo, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, GripHorizontal, Trash2 } from 'lucide-react';
import { getCommand, runCommand, displayShortcut, commandIds, type Command } from '../commands/registry';
import { DEFAULT_RIBBON } from '../commands/defaults';
import { reconcile, tabsForView, placeGroup, removeGroup, setGroupCompact, type RibbonConfig, type RibbonGroup } from '../commands/ribbonModel';
import { detachGroup } from '../commands/floatModel';
import { useWorkspace } from '../state/workspace';
import type { RibbonSize } from '../state/prefs';
import { useCommandTick } from './useCommands';
import { t, useLang } from '../i18n';
import { openContextMenu } from '../components/ContextMenu';
import { Popover } from '../components/Popover';
import { RibbonWidget } from './RibbonWidgets';

export const GROUP_MIME = 'application/x-alexandria-ribbon-group';

export function useRibbonConfig(): RibbonConfig {
  const saved = useWorkspace((s) => s.app.ribbon);
  const tick = useCommandTick();
  return useMemo(() => reconcile(saved, DEFAULT_RIBBON, commandIds()), [saved, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function labelOf(label: string, custom?: boolean): string {
  return custom ? label : t(label);
}

export function CommandButton({ cmd, size, onRun }: { cmd: Command; size: RibbonSize; onRun?: () => void }) {
  if (cmd.widget) return <RibbonWidget id={cmd.widget} size={size} />;
  const enabled = cmd.isEnabled ? cmd.isEnabled() : true;
  const on = cmd.isActive?.() ?? false;
  const Icon = cmd.icon;
  const tip = t(cmd.label) + (cmd.shortcut ? ` (${displayShortcut(cmd.shortcut)})` : '');
  return (
    <button
      className={`ribbon__btn ${on ? 'is-on' : ''}`}
      disabled={!enabled}
      title={tip}
      aria-pressed={cmd.isActive ? on : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        void runCommand(cmd.id);
        onRun?.();
      }}
    >
      {Icon && <Icon size={size === 'large' ? 22 : 16} strokeWidth={1.6} />}
      <span className="ribbon__btn-label">{t(cmd.label)}</span>
    </button>
  );
}

/** Gruppo sintetizzato: un pulsante con l'icona del primo strumento che apre tutti gli strumenti. */
function CompactGroup({ g, items, size }: { g: RibbonGroup; items: Command[]; size: RibbonSize }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const Icon = items.find((c) => c.icon)?.icon;
  const label = labelOf(g.label, g.custom);
  return (
    <>
      <button
        ref={ref}
        className={`ribbon__btn ribbon__btn--compact ${open ? 'is-on' : ''}`}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
      >
        {Icon && <Icon size={size === 'large' ? 22 : 16} strokeWidth={1.6} />}
        <span className="ribbon__btn-label">
          {label} <ChevronDown size={10} />
        </span>
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} className="ribbon-pop">
        <div className="ribbon-pop__title">{label}</div>
        <div className="ribbon-pop__items" role="toolbar" aria-label={label}>
          {items.map((cmd) => (
            <CommandButton key={cmd.id} cmd={cmd} size="large" onRun={() => setOpen(false)} />
          ))}
        </div>
      </Popover>
    </>
  );
}

export function Ribbon() {
  useLang();
  useCommandTick();
  const view = useWorkspace((s) => s.app.view);
  const size = useWorkspace((s) => s.app.prefs.ribbonSize);
  const collapsed = useWorkspace((s) => s.app.prefs.ribbonCollapsed);
  const cfg = useRibbonConfig();
  const tabs = tabsForView(cfg, view);
  const [activeByView, setActiveByView] = useState<Record<string, string>>({});
  const active = tabs.find((x) => x.id === activeByView[view]) ?? tabs[0];
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  const [overFloat, setOverFloat] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const ws = useWorkspace.getState();

  const onContext = (e: React.MouseEvent) => {
    openContextMenu(e, [
      { label: t('ribbon.ctx.customize'), onClick: () => ws.openDialog('ribbonCustomize', { tab: active?.id }) },
      { label: t('ribbon.ctx.small'), checked: size === 'small', onClick: () => ws.setPrefs({ ribbonSize: size === 'small' ? 'large' : 'small' }) },
      { label: t('ribbon.ctx.collapse'), checked: collapsed, onClick: () => ws.setPrefs({ ribbonCollapsed: !collapsed }) },
      { sep: true, label: '' },
      { label: t('ribbon.ctx.reset'), onClick: () => ws.setRibbon(null) },
    ]);
  };

  const groupMenu = (e: React.MouseEvent, g: RibbonGroup) => {
    e.stopPropagation();
    openContextMenu(e, [
      { label: g.compact ? t('ribbon.group.expand') : t('ribbon.group.compact'), onClick: () => ws.setRibbon(setGroupCompact(cfg, g.id, !g.compact)) },
      { label: t('ribbon.group.remove'), danger: true, onClick: () => trash(g) },
      { sep: true, label: '' },
      { label: t('ribbon.ctx.customize'), onClick: () => ws.openDialog('ribbonCustomize', { tab: active?.id }) },
    ]);
  };

  /** Toglie un gruppo; il toast permette di rimetterlo com'era. */
  const trash = (g: RibbonGroup) => {
    const before = cfg;
    ws.setRibbon(removeGroup(cfg, g.id));
    ws.toast(t('ribbon.group.removed', { name: labelOf(g.label, g.custom) }), 'info', { label: t('common.undo'), run: () => ws.setRibbon(before) });
  };

  /** Posizione di inserimento fra i gruppi a schermo, dalla x del puntatore. */
  const indexAt = (x: number): number => {
    const els = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>('[data-group]') ?? []);
    const i = els.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return x < r.left + r.width / 2;
    });
    return i < 0 ? els.length : i;
  };

  const endDrag = () => {
    setDragging(null);
    setDropIndex(null);
    setOverTrash(false);
    setOverFloat(false);
  };

  const visibleGroups = active ? active.groups.filter((g) => g.items.some((id) => getCommand(id))) : [];

  return (
    <div ref={rootRef} className={`ribbon ribbon--${size} ${collapsed ? 'is-collapsed' : ''} ${dragging ? 'is-dragging' : ''}`} onContextMenu={onContext}>
      <div className="ribbon__tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === active?.id}
            className={`ribbon__tab ${tab.id === active?.id ? 'is-active' : ''}`}
            onClick={() => {
              setActiveByView({ ...activeByView, [view]: tab.id });
              if (collapsed) ws.setPrefs({ ribbonCollapsed: false });
            }}
          >
            {labelOf(tab.label, tab.custom)}
          </button>
        ))}
        <button className="ribbon__collapse" title={collapsed ? t('ribbon.expand') : t('ribbon.collapse')} onClick={() => ws.setPrefs({ ribbonCollapsed: !collapsed })}>
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {!collapsed && active && (
        <div
          ref={bodyRef}
          className="ribbon__body"
          role="toolbar"
          aria-label={labelOf(active.label, active.custom)}
          onDragOver={(e) => {
            if (!dragging || !e.dataTransfer.types.includes(GROUP_MIME)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const i = indexAt(e.clientX);
            if (i !== dropIndex) setDropIndex(i);
          }}
          onDrop={(e) => {
            if (!dragging || dropIndex === null) return;
            e.preventDefault();
            // l'indice conta i gruppi visibili: lo si traduce nella posizione fra tutti i gruppi
            const target = visibleGroups[dropIndex];
            const all = active.groups;
            const to = target ? all.findIndex((g) => g.id === target.id) : all.length;
            ws.setRibbon(placeGroup(cfg, dragging, to));
            endDrag();
          }}
        >
          {visibleGroups.map((g, i) => {
            const items = g.items.map((id) => getCommand(id)).filter((c): c is Command => !!c);
            return (
              <div
                key={g.id}
                data-group={g.id}
                className={`ribbon__group ${g.compact ? 'is-compact' : ''} ${dragging === g.id ? 'is-dragged' : ''} ${dragging && dropIndex === i ? 'drop-before' : ''} ${
                  dragging && dropIndex === visibleGroups.length && i === visibleGroups.length - 1 ? 'drop-after' : ''
                }`}
                onContextMenu={(e) => groupMenu(e, g)}
              >
                <div className="ribbon__items">
                  {g.compact ? <CompactGroup g={g} items={items} size={size} /> : items.map((cmd) => <CommandButton key={cmd.id} cmd={cmd} size={size} />)}
                </div>
                <div className="ribbon__group-label">{labelOf(g.label, g.custom)}</div>
                <span
                  className="ribbon__handle"
                  draggable
                  title={t('ribbon.group.drag')}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(GROUP_MIME, g.id);
                    e.dataTransfer.effectAllowed = 'move';
                    const el = (e.currentTarget as HTMLElement).closest('.ribbon__group') as HTMLElement | null;
                    if (el) e.dataTransfer.setDragImage(el, el.offsetWidth - 8, el.offsetHeight - 8);
                    // il cestino compare dopo che il browser ha fotografato il gruppo
                    requestAnimationFrame(() => setDragging(g.id));
                  }}
                  onDragEnd={endDrag}
                >
                  <GripHorizontal size={11} />
                </span>
              </div>
            );
          })}
        </div>
      )}
      {dragging && (
        <div
          className={`float-drop ${overFloat ? 'is-over' : ''}`}
          style={{ top: rootRef.current?.getBoundingClientRect().bottom ?? 0 }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(GROUP_MIME)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!overFloat) setOverFloat(true);
          }}
          onDragLeave={() => setOverFloat(false)}
          onDrop={(e) => {
            e.preventDefault();
            const app = ws.app;
            const s = detachGroup(cfg, app.floating, dragging, Math.max(8, e.clientX - 60), Math.max(8, e.clientY - 20));
            ws.setRibbonAndFloating(s.cfg, s.panels);
            endDrag();
          }}
        >
          <span>{t('float.dropHere')}</span>
        </div>
      )}
      {dragging && (
        <div
          className={`ribbon__trash ${overTrash ? 'is-over' : ''}`}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(GROUP_MIME)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!overTrash) setOverTrash(true);
            if (dropIndex !== null) setDropIndex(null);
          }}
          onDragLeave={() => setOverTrash(false)}
          onDrop={(e) => {
            e.preventDefault();
            const g = active?.groups.find((x) => x.id === dragging);
            if (g) trash(g);
            endDrag();
          }}
        >
          <Trash2 size={18} />
          <span>{t('ribbon.trash')}</span>
        </div>
      )}
    </div>
  );
}
