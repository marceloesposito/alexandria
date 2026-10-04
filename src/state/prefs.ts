// Preferenze e stato dell'app (non del vault): salvate in <appData>/state.json.
import type { Lang } from '../i18n';
import type { RibbonConfig } from '../commands/ribbonModel';

export type ThemePref = 'light' | 'dark' | 'system';
export type View = 'resources' | 'editor' | 'versions';
export type RibbonSize = 'large' | 'small';

export interface Prefs {
  lang: Lang;
  theme: ThemePref;
  lineNumbers: boolean;
  lineNumberStep: 1 | 5 | 10;
  showLeft: boolean;
  showRight: boolean;
  showPreview: boolean;
  focusMode: boolean;
  zoom: number; // 0.6 .. 2
  ribbonSize: RibbonSize;
  ribbonCollapsed: boolean;
  autoCheckpointMinutes: number; // 0 = disattivato
  suggestCommitMessage: boolean;
  spellcheck: boolean;
  libraryPath: string | null;
  layerSuggestions: 'off' | 'suggest';
  authorName: string;
  leftWidth: number;
  rightWidth: number;
  previewWidth: number;
}

export const DEFAULT_PREFS: Prefs = {
  lang: 'it',
  theme: 'system',
  lineNumbers: true,
  lineNumberStep: 1,
  showLeft: true,
  showRight: true,
  showPreview: false,
  focusMode: false,
  zoom: 1,
  ribbonSize: 'large',
  ribbonCollapsed: false,
  autoCheckpointMinutes: 10,
  suggestCommitMessage: true,
  spellcheck: true,
  libraryPath: null,
  layerSuggestions: 'suggest',
  authorName: '',
  leftWidth: 280,
  rightWidth: 300,
  previewWidth: 520,
};

export interface DocCursor {
  pos: number;
  scroll: number;
}

export interface AppState {
  version: 1;
  lastVault: string | null;
  lastDoc: string | null; // percorso relativo al vault
  recentVaults: string[];
  recentDocs: { vault: string; doc: string }[];
  cursors: Record<string, DocCursor>; // chiave: vault|doc
  prefs: Prefs;
  ribbon: RibbonConfig | null; // null = predefinito
  view: View;
}

export function defaultAppState(): AppState {
  return {
    version: 1,
    lastVault: null,
    lastDoc: null,
    recentVaults: [],
    recentDocs: [],
    cursors: {},
    prefs: { ...DEFAULT_PREFS },
    ribbon: null,
    view: 'editor',
  };
}

/** Unisce uno stato letto da disco con i valori predefiniti (campi nuovi o mancanti). */
export function normalizeAppState(raw: unknown): AppState {
  const d = defaultAppState();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<AppState>;
  return {
    ...d,
    ...r,
    version: 1,
    prefs: { ...d.prefs, ...(r.prefs ?? {}) },
    recentVaults: Array.isArray(r.recentVaults) ? r.recentVaults.slice(0, 12) : [],
    recentDocs: Array.isArray(r.recentDocs) ? r.recentDocs.slice(0, 20) : [],
    cursors: r.cursors && typeof r.cursors === 'object' ? r.cursors : {},
    view: r.view === 'resources' || r.view === 'versions' ? r.view : 'editor',
  };
}

export function pushRecent<T>(list: T[], item: T, eq: (a: T, b: T) => boolean, max: number): T[] {
  return [item, ...list.filter((x) => !eq(x, item))].slice(0, max);
}
