// Pannelli flottanti: gruppi della barra degli strumenti staccati in finestre libere (come AutoCAD e
// Illustrator). Ogni gruppo ricorda la scheda da cui viene, per poterlo rimettere nella barra.
import type { View } from '../state/prefs';
import type { RibbonConfig, RibbonGroup } from './ribbonModel';

export interface FloatingGroup extends RibbonGroup {
  /** scheda del ribbon da cui e' stato staccato */
  fromTab: string;
}

export interface FloatingPanel {
  id: string;
  view: View;
  x: number;
  y: number;
  groups: FloatingGroup[];
}

let counter = 0;
const newId = () => `fp-${Date.now().toString(36)}-${++counter}`;

function takeGroup(cfg: RibbonConfig, groupId: string): { cfg: RibbonConfig; group: FloatingGroup | null; view: View | null } {
  for (const tab of cfg.tabs) {
    const g = tab.groups.find((x) => x.id === groupId);
    if (g) {
      return {
        cfg: { ...cfg, tabs: cfg.tabs.map((t) => (t.id === tab.id ? { ...t, groups: t.groups.filter((x) => x.id !== groupId) } : t)) },
        group: { ...g, fromTab: tab.id },
        view: tab.view,
      };
    }
  }
  return { cfg, group: null, view: null };
}

/** Stacca un gruppo dalla barra e ne fa un nuovo pannello flottante nel punto indicato. */
export function detachGroup(cfg: RibbonConfig, panels: FloatingPanel[], groupId: string, x: number, y: number): { cfg: RibbonConfig; panels: FloatingPanel[] } {
  const t = takeGroup(cfg, groupId);
  if (!t.group || !t.view) return { cfg, panels };
  return { cfg: t.cfg, panels: [...panels, { id: newId(), view: t.view, x, y, groups: [t.group] }] };
}

/** Aggiunge un gruppo della barra a un pannello esistente (solo dello stesso ambiente). */
export function addToPanel(cfg: RibbonConfig, panels: FloatingPanel[], groupId: string, panelId: string): { cfg: RibbonConfig; panels: FloatingPanel[] } {
  const panel = panels.find((p) => p.id === panelId);
  const t = takeGroup(cfg, groupId);
  if (!panel || !t.group || t.view !== panel.view) return { cfg, panels };
  return { cfg: t.cfg, panels: panels.map((p) => (p.id === panelId ? { ...p, groups: [...p.groups, t.group!] } : p)) };
}

/** Rimette un gruppo nella sua scheda (in fondo); il pannello rimasto vuoto sparisce. */
export function dockGroup(cfg: RibbonConfig, panels: FloatingPanel[], panelId: string, groupId: string): { cfg: RibbonConfig; panels: FloatingPanel[] } {
  const panel = panels.find((p) => p.id === panelId);
  const g = panel?.groups.find((x) => x.id === groupId);
  if (!panel || !g) return { cfg, panels };
  const { fromTab, ...group } = g;
  const target = cfg.tabs.find((t) => t.id === fromTab) ?? cfg.tabs.find((t) => t.view === panel.view && !t.hidden);
  const nextCfg = target ? { ...cfg, tabs: cfg.tabs.map((t) => (t.id === target.id ? { ...t, groups: [...t.groups, group] } : t)) } : cfg;
  const nextPanels = panels.map((p) => (p.id === panelId ? { ...p, groups: p.groups.filter((x) => x.id !== groupId) } : p)).filter((p) => p.groups.length > 0);
  return { cfg: nextCfg, panels: nextPanels };
}

/** Chiude un pannello rimettendo tutti i suoi gruppi nella barra. */
export function closePanel(cfg: RibbonConfig, panels: FloatingPanel[], panelId: string): { cfg: RibbonConfig; panels: FloatingPanel[] } {
  const panel = panels.find((p) => p.id === panelId);
  let state = { cfg, panels };
  for (const g of panel?.groups ?? []) state = dockGroup(state.cfg, state.panels, panelId, g.id);
  return state;
}

export function movePanel(panels: FloatingPanel[], panelId: string, x: number, y: number): FloatingPanel[] {
  return panels.map((p) => (p.id === panelId ? { ...p, x: Math.max(0, x), y: Math.max(0, y) } : p));
}

/** Id dei gruppi che stanno in un pannello (non vanno proposti come "gruppi tolti"). */
export function floatingGroupIds(panels: FloatingPanel[]): Set<string> {
  return new Set(panels.flatMap((p) => p.groups.map((g) => g.id)));
}
