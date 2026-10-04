// Modello del ribbon personalizzabile: schede per vista, gruppi, comandi.
// Funzioni pure: la personalizzazione e' una sequenza di trasformazioni testabili.
import type { View } from '../state/prefs';

export interface RibbonGroup {
  id: string;
  label: string; // chiave i18n, oppure testo libero se custom
  custom?: boolean;
  items: string[]; // id dei comandi
}

export interface RibbonTab {
  id: string;
  view: View;
  label: string;
  custom?: boolean;
  hidden?: boolean;
  groups: RibbonGroup[];
}

export interface RibbonConfig {
  version: 1;
  tabs: RibbonTab[];
}

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function mapTab(cfg: RibbonConfig, tabId: string, f: (t: RibbonTab) => RibbonTab): RibbonConfig {
  return { ...cfg, tabs: cfg.tabs.map((t) => (t.id === tabId ? f(t) : t)) };
}

function mapGroup(cfg: RibbonConfig, groupId: string, f: (g: RibbonGroup) => RibbonGroup): RibbonConfig {
  return {
    ...cfg,
    tabs: cfg.tabs.map((t) => ({ ...t, groups: t.groups.map((g) => (g.id === groupId ? f(g) : g)) })),
  };
}

export function addTab(cfg: RibbonConfig, view: View, label: string): RibbonConfig {
  const tab: RibbonTab = { id: newId('tab'), view, label, custom: true, groups: [] };
  return { ...cfg, tabs: [...cfg.tabs, tab] };
}

export function removeTab(cfg: RibbonConfig, tabId: string): RibbonConfig {
  return { ...cfg, tabs: cfg.tabs.filter((t) => t.id !== tabId) };
}

export function renameTab(cfg: RibbonConfig, tabId: string, label: string): RibbonConfig {
  return mapTab(cfg, tabId, (t) => ({ ...t, label, custom: true }));
}

export function toggleTabHidden(cfg: RibbonConfig, tabId: string): RibbonConfig {
  return mapTab(cfg, tabId, (t) => ({ ...t, hidden: !t.hidden }));
}

export function moveTab(cfg: RibbonConfig, tabId: string, delta: number): RibbonConfig {
  const tabs = [...cfg.tabs];
  const i = tabs.findIndex((t) => t.id === tabId);
  if (i < 0) return cfg;
  // si sposta fra le schede della stessa vista
  const view = tabs[i].view;
  let j = i;
  for (let step = 0; step < Math.abs(delta); step++) {
    let k = j + Math.sign(delta);
    while (k >= 0 && k < tabs.length && tabs[k].view !== view) k += Math.sign(delta);
    if (k < 0 || k >= tabs.length) break;
    j = k;
  }
  if (j === i) return cfg;
  const [t] = tabs.splice(i, 1);
  tabs.splice(j, 0, t);
  return { ...cfg, tabs };
}

export function addGroup(cfg: RibbonConfig, tabId: string, label: string): RibbonConfig {
  return mapTab(cfg, tabId, (t) => ({ ...t, groups: [...t.groups, { id: newId('grp'), label, custom: true, items: [] }] }));
}

export function removeGroup(cfg: RibbonConfig, groupId: string): RibbonConfig {
  return { ...cfg, tabs: cfg.tabs.map((t) => ({ ...t, groups: t.groups.filter((g) => g.id !== groupId) })) };
}

export function renameGroup(cfg: RibbonConfig, groupId: string, label: string): RibbonConfig {
  return mapGroup(cfg, groupId, (g) => ({ ...g, label, custom: true }));
}

export function moveGroup(cfg: RibbonConfig, groupId: string, delta: number): RibbonConfig {
  return {
    ...cfg,
    tabs: cfg.tabs.map((t) => {
      const i = t.groups.findIndex((g) => g.id === groupId);
      if (i < 0) return t;
      const j = Math.max(0, Math.min(t.groups.length - 1, i + delta));
      const groups = [...t.groups];
      const [g] = groups.splice(i, 1);
      groups.splice(j, 0, g);
      return { ...t, groups };
    }),
  };
}

/** Inserisce un comando in un gruppo alla posizione data (lo toglie da dove era nello stesso gruppo). */
export function insertCommand(cfg: RibbonConfig, groupId: string, commandId: string, index?: number): RibbonConfig {
  return mapGroup(cfg, groupId, (g) => {
    const items = g.items.filter((x) => x !== commandId);
    const at = index === undefined ? items.length : Math.max(0, Math.min(items.length, index));
    items.splice(at, 0, commandId);
    return { ...g, items };
  });
}

export function removeCommand(cfg: RibbonConfig, groupId: string, commandId: string): RibbonConfig {
  return mapGroup(cfg, groupId, (g) => ({ ...g, items: g.items.filter((x) => x !== commandId) }));
}

/** Sposta un comando da un gruppo a un altro (o nello stesso, a un altro indice). */
export function moveCommand(
  cfg: RibbonConfig,
  fromGroup: string,
  commandId: string,
  toGroup: string,
  index: number,
): RibbonConfig {
  if (fromGroup === toGroup) return insertCommand(cfg, toGroup, commandId, index);
  return insertCommand(removeCommand(cfg, fromGroup, commandId), toGroup, commandId, index);
}

/**
 * Riconcilia una configurazione salvata con quella predefinita della versione corrente:
 * scarta i comandi che non esistono piu' e aggiunge le schede predefinite mancanti.
 */
export function reconcile(saved: RibbonConfig | null, defaults: RibbonConfig, known: Set<string>): RibbonConfig {
  if (!saved || saved.version !== 1 || !Array.isArray(saved.tabs)) return defaults;
  const tabs = saved.tabs.map((t) => ({
    ...t,
    groups: t.groups.map((g) => ({ ...g, items: g.items.filter((id) => known.has(id)) })),
  }));
  for (const d of defaults.tabs) if (!tabs.some((t) => t.id === d.id)) tabs.push(d);
  return { version: 1, tabs };
}

export function tabsForView(cfg: RibbonConfig, view: View): RibbonTab[] {
  return cfg.tabs.filter((t) => t.view === view && !t.hidden);
}

export function validateImported(raw: unknown): RibbonConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as RibbonConfig;
  if (r.version !== 1 || !Array.isArray(r.tabs)) return null;
  const okTabs = r.tabs.every(
    (t) =>
      typeof t.id === 'string' &&
      ['resources', 'editor', 'versions'].includes(t.view) &&
      typeof t.label === 'string' &&
      Array.isArray(t.groups) &&
      t.groups.every((g) => typeof g.id === 'string' && Array.isArray(g.items) && g.items.every((i) => typeof i === 'string')),
  );
  return okTabs ? r : null;
}
