// Workspace (come gli spazi di lavoro di Illustrator): Beginner, Studio, Pro e quelli salvati
// dall'utente. Un workspace e' la disposizione dell'interfaccia: colonne, viste, barra degli strumenti
// e pannelli flottanti. Funzioni pure: applicarne uno e' sostituire questi campi dello stato.
import type { Prefs } from './prefs';
import type { RibbonConfig, RibbonGroup, RibbonTab } from '../commands/ribbonModel';
import type { FloatingPanel } from '../commands/floatModel';

export type BuiltInWorkspace = 'beginner' | 'studio' | 'pro';

/** Preferenze che fanno parte della disposizione (le altre, come lingua e tema, restano dell'utente). */
export const LAYOUT_KEYS = ['showLeft', 'showRight', 'showPreview', 'leftTab', 'lineNumbers', 'rulers', 'editorLayout', 'ribbonSize', 'ribbonCollapsed', 'focusMode'] as const;
export type LayoutKey = (typeof LAYOUT_KEYS)[number];
export type LayoutPrefs = Pick<Prefs, LayoutKey>;

export interface WorkspaceLayout {
  id: string;
  name: string;
  /** predefinito: si ricostruisce dalla barra di default, non si salva */
  builtIn?: BuiltInWorkspace;
  prefs: LayoutPrefs;
  /** null = barra predefinita */
  ribbon: RibbonConfig | null;
  floating: FloatingPanel[];
}

export const BUILT_IN: BuiltInWorkspace[] = ['beginner', 'studio', 'pro'];

const PREFS: Record<BuiltInWorkspace, LayoutPrefs> = {
  // vicino alla modalita' focus: solo il testo e pochi strumenti
  beginner: { showLeft: false, showRight: false, showPreview: false, leftTab: 'resources', lineNumbers: false, rulers: false, editorLayout: 'borderless', ribbonSize: 'large', ribbonCollapsed: false, focusMode: false },
  studio: { showLeft: true, showRight: true, showPreview: false, leftTab: 'resources', lineNumbers: true, rulers: true, editorLayout: 'page', ribbonSize: 'large', ribbonCollapsed: false, focusMode: false },
  pro: { showLeft: true, showRight: true, showPreview: true, leftTab: 'resources', lineNumbers: true, rulers: true, editorLayout: 'page', ribbonSize: 'small', ribbonCollapsed: false, focusMode: false },
};

/** Gli strumenti essenziali di ogni ambiente per il workspace Beginner. */
const BEGINNER_TABS: RibbonTab[] = [
  {
    id: 'bg-editor',
    view: 'editor',
    label: 'ribbon.tab.essentials',
    groups: [
      { id: 'bg-ed-style', label: 'ribbon.group.style', items: ['insert.h1', 'insert.h2', 'insert.paragraph'] },
      { id: 'bg-ed-char', label: 'ribbon.group.character', items: ['fmt.bold', 'fmt.italic', 'fmt.highlight', 'insert.bulletList'] },
      { id: 'bg-ed-add', label: 'ribbon.group.add', items: ['res.insert', 'cite.insert', 'cite.bibliography', 'comment.add'] },
      { id: 'bg-ed-out', label: 'ribbon.group.output', items: ['view.zen', 'file.exportPdf'] },
    ],
  },
  {
    id: 'bg-resources',
    view: 'resources',
    label: 'ribbon.tab.essentials',
    groups: [
      { id: 'bg-res-add', label: 'ribbon.group.add', items: ['res.add', 'res.remove'] },
      { id: 'bg-res-views', label: 'ribbon.group.views', items: ['res.view.whiteboard', 'res.view.layers'] },
    ],
  },
  {
    id: 'bg-versions',
    view: 'versions',
    label: 'ribbon.tab.essentials',
    groups: [{ id: 'bg-vc', label: 'ribbon.group.commit', items: ['vc.commit', 'vc.restore'] }],
  },
];

/**
 * Barra di un workspace predefinito. Beginner tiene le schede di default nascoste (non cancellate:
 * la personalizzazione puo' rimostrarle) e mette davanti la scheda "Essenziali" di ogni ambiente.
 */
export function builtInRibbon(id: BuiltInWorkspace, defaults: RibbonConfig): RibbonConfig | null {
  if (id !== 'beginner') return null;
  const hidden = defaults.tabs.map((t) => ({ ...t, hidden: true, groups: t.groups.map((g: RibbonGroup) => ({ ...g })) }));
  return { version: 1, tabs: [...BEGINNER_TABS.map((t) => ({ ...t, groups: t.groups.map((g) => ({ ...g })) })), ...hidden] };
}

export function builtInWorkspace(id: BuiltInWorkspace, defaults: RibbonConfig): WorkspaceLayout {
  return { id, name: `workspace.${id}`, builtIn: id, prefs: { ...PREFS[id] }, ribbon: builtInRibbon(id, defaults), floating: [] };
}

/** Fotografa la disposizione attuale (per "Salva workspace"). */
export function captureWorkspace(id: string, name: string, prefs: Prefs, ribbon: RibbonConfig | null, floating: FloatingPanel[]): WorkspaceLayout {
  const p = Object.fromEntries(LAYOUT_KEYS.map((k) => [k, prefs[k]])) as LayoutPrefs;
  return { id, name, prefs: p, ribbon: ribbon ? structuredClone(ribbon) : null, floating: structuredClone(floating) };
}

/** Cio' che cambia applicando un workspace: preferenze di disposizione, barra e pannelli. */
export function applyWorkspace(w: WorkspaceLayout): { prefs: LayoutPrefs; ribbon: RibbonConfig | null; floating: FloatingPanel[] } {
  return { prefs: { ...w.prefs }, ribbon: w.ribbon ? structuredClone(w.ribbon) : null, floating: structuredClone(w.floating) };
}

/** Un workspace salvato letto da disco, completato con i valori di Studio se mancano campi. */
export function normalizeWorkspace(raw: unknown): WorkspaceLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<WorkspaceLayout>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return null;
  return { id: r.id, name: r.name, prefs: { ...PREFS.studio, ...(r.prefs ?? {}) }, ribbon: r.ribbon ?? null, floating: Array.isArray(r.floating) ? r.floating : [] };
}
