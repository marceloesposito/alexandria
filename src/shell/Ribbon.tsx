// Ribbon contestuale stile Word/AutoCAD: schede della vista corrente, gruppi di comandi con icone.
// Tasto destro: personalizza, icone piccole, comprimi, ripristina.
import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { getCommand, runCommand, displayShortcut, commandIds } from '../commands/registry';
import { DEFAULT_RIBBON } from '../commands/defaults';
import { reconcile, tabsForView, type RibbonConfig } from '../commands/ribbonModel';
import { useWorkspace } from '../state/workspace';
import { useCommandTick } from './useCommands';
import { t, useLang } from '../i18n';
import { openContextMenu } from '../components/ContextMenu';
import { RibbonWidget } from './RibbonWidgets';

export function useRibbonConfig(): RibbonConfig {
  const saved = useWorkspace((s) => s.app.ribbon);
  const tick = useCommandTick();
  return useMemo(() => reconcile(saved, DEFAULT_RIBBON, commandIds()), [saved, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function labelOf(label: string, custom?: boolean): string {
  return custom ? label : t(label);
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

  const onContext = (e: React.MouseEvent) => {
    const ws = useWorkspace.getState();
    openContextMenu(e, [
      { label: t('ribbon.ctx.customize'), onClick: () => ws.openDialog('ribbonCustomize', { tab: active?.id }) },
      { label: t('ribbon.ctx.small'), checked: size === 'small', onClick: () => ws.setPrefs({ ribbonSize: size === 'small' ? 'large' : 'small' }) },
      { label: t('ribbon.ctx.collapse'), checked: collapsed, onClick: () => ws.setPrefs({ ribbonCollapsed: !collapsed }) },
      { sep: true, label: '' },
      { label: t('ribbon.ctx.reset'), onClick: () => ws.setRibbon(null) },
    ]);
  };

  return (
    <div className={`ribbon ribbon--${size} ${collapsed ? 'is-collapsed' : ''}`} onContextMenu={onContext}>
      <div className="ribbon__tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === active?.id}
            className={`ribbon__tab ${tab.id === active?.id ? 'is-active' : ''}`}
            onClick={() => {
              setActiveByView({ ...activeByView, [view]: tab.id });
              if (collapsed) useWorkspace.getState().setPrefs({ ribbonCollapsed: false });
            }}
          >
            {labelOf(tab.label, tab.custom)}
          </button>
        ))}
        <button
          className="ribbon__collapse"
          title={collapsed ? t('ribbon.expand') : t('ribbon.collapse')}
          onClick={() => useWorkspace.getState().setPrefs({ ribbonCollapsed: !collapsed })}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {!collapsed && active && (
        <div className="ribbon__body" role="toolbar" aria-label={labelOf(active.label, active.custom)}>
          {active.groups.map((g) => {
            const items = g.items.map((id) => getCommand(id)).filter(Boolean);
            if (!items.length) return null;
            return (
              <div key={g.id} className="ribbon__group">
                <div className="ribbon__items">
                  {items.map((cmd) => {
                    if (!cmd) return null;
                    if (cmd.widget) return <RibbonWidget key={cmd.id} id={cmd.widget} size={size} />;
                    const enabled = cmd.isEnabled ? cmd.isEnabled() : true;
                    const on = cmd.isActive?.() ?? false;
                    const Icon = cmd.icon;
                    const tip = t(cmd.label) + (cmd.shortcut ? ` (${displayShortcut(cmd.shortcut)})` : '');
                    return (
                      <button
                        key={cmd.id}
                        className={`ribbon__btn ${on ? 'is-on' : ''}`}
                        disabled={!enabled}
                        title={tip}
                        aria-pressed={cmd.isActive ? on : undefined}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void runCommand(cmd.id)}
                      >
                        {Icon && <Icon size={size === 'large' ? 22 : 16} strokeWidth={1.6} />}
                        <span className="ribbon__btn-label">{t(cmd.label)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="ribbon__group-label">{labelOf(g.label, g.custom)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
