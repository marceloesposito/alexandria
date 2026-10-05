// Stato centrale dell'app: preferenze, vault aperto, documento attivo, finestre di dialogo.
import { create } from 'zustand';
import { platform, joinPath } from '../platform';

async function ensureDir(p: string): Promise<string> {
  if (!(await platform.exists(p))) await platform.mkdir(p);
  return p;
}
import { setLang, t } from '../i18n';
import {
  type AppState,
  type Prefs,
  type View,
  defaultAppState,
  normalizeAppState,
  pushRecent,
} from './prefs';
import type { RibbonConfig } from '../commands/ribbonModel';
import {
  type VaultConfig,
  type DocInfo,
  ensureVault,
  listDocuments,
  createDocument,
  renameDocument,
  deleteDocument,
  duplicateDocument,
  saveVaultConfig,
  writeJson,
} from '../vault/vault';
import { abs, docSettingsFile } from '../vault/paths';
import { mapPaths, toStored, fromStored } from './portablePaths';

export type DialogId =
  | 'templates'
  | 'insertResource'
  | 'ribbonCustomize'
  | 'preferences'
  | 'docSettings'
  | 'about'
  | 'shortcuts'
  | 'help'
  | 'commit'
  | 'newBranch'
  | 'switchBranch'
  | 'merge'
  | 'remote'
  | 'addResource'
  | 'cite'
  | 'goToLine'
  | 'findReplace'
  | 'export'
  | 'openVault'
  | 'renameDoc'
  | 'markdownGuide'
  | null;

export interface Toast {
  id: number;
  kind: 'info' | 'ok' | 'error';
  text: string;
  /** pulsante facoltativo (es. Annulla) */
  action?: { label: string; run: () => void };
}

interface WorkspaceState {
  ready: boolean;
  app: AppState;
  vaultRoot: string | null;
  vault: VaultConfig | null;
  docs: DocInfo[];
  activeDoc: string | null;
  dialog: DialogId;
  dialogArg: unknown;
  toasts: Toast[];
  saveState: 'saved' | 'saving' | 'dirty' | 'error';
  /** Aumenta quando i file del vault cambiano fuori dall'editor (checkout, merge, ripristino) */
  reloadToken: number;

  init(): Promise<void>;
  setView(v: View): void;
  setPrefs(p: Partial<Prefs>): void;
  setRibbon(r: RibbonConfig | null): void;
  openVault(root: string): Promise<void>;
  /** Apre un Compendium e il suo ultimo Scroll (o il primo, o uno nuovo). */
  enterVault(root: string): Promise<boolean>;
  /** Chiude il Compendium e torna alla schermata iniziale. */
  closeVault(): void;
  /** Crea (o riapre) il Compendium predefinito in Documenti/Alexandria. */
  createDefaultVault(): Promise<boolean>;
  forgetRecent(root: string): void;
  refreshDocs(): Promise<void>;
  openDoc(rel: string): void;
  /** nuova pergamena, vuota o con testo e impostazioni iniziali (template) */
  newDoc(title?: string, folder?: string, init?: { markdown: string; settings: unknown }): Promise<string | null>;
  renameDoc(rel: string, title: string): Promise<void>;
  deleteDoc(rel: string): Promise<void>;
  duplicateDoc(rel: string): Promise<void>;
  reorderDocs(order: string[]): Promise<void>;
  setCursor(rel: string, pos: number, scroll: number): void;
  openDialog(d: DialogId, arg?: unknown): void;
  closeDialog(): void;
  toast(text: string, kind?: Toast['kind'], action?: Toast['action']): void;
  dismissToast(id: number): void;
  setSaveState(s: WorkspaceState['saveState']): void;
  bumpReload(): void;
}

let statePath: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let toastId = 0;

let portableRoot: string | null = null;

/** Cartella dati della chiavetta, se l'app e' portable. */
export function getPortableRoot(): string | null {
  return portableRoot;
}

function persist(app: AppState) {
  if (!statePath) return;
  if (saveTimer) clearTimeout(saveTimer);
  const path = statePath;
  saveTimer = setTimeout(() => {
    // in modalita' portable i percorsi della chiavetta si salvano relativi
    const stored = portableRoot ? mapPaths(app, (p) => toStored(p, portableRoot)) : app;
    platform.writeText(path, JSON.stringify(stored, null, 2)).catch(() => {
      /* uno stato non salvato vale per la sessione in corso */
    });
  }, 250);
}

export function applyTheme(theme: Prefs['theme']) {
  document.documentElement.dataset.theme = theme;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  ready: false,
  app: defaultAppState(),
  vaultRoot: null,
  vault: null,
  docs: [],
  activeDoc: null,
  dialog: null,
  dialogArg: null,
  toasts: [],
  saveState: 'saved',
  reloadToken: 0,

  async init() {
    const dir = await platform.appDataDir();
    statePath = joinPath(dir, 'state.json');
    let app = defaultAppState();
    try {
      portableRoot = await platform.portableRoot();
      if (await platform.exists(statePath)) app = mapPaths(normalizeAppState(JSON.parse(await platform.readText(statePath))), (p) => fromStored(p, portableRoot));
    } catch {
      app = defaultAppState();
    }
    // lingua predefinita dal sistema al primo avvio
    if (!app.lastVault && typeof navigator !== 'undefined' && !navigator.language.startsWith('it')) {
      app.prefs.lang = 'en';
    }
    setLang(app.prefs.lang);
    applyTheme(app.prefs.theme);
    set({ app });

    // Avvio: la schermata iniziale sceglie il Compendium; chi lo preferisce riapre subito l'ultimo
    if (app.prefs.startup === 'last' && app.lastVault && (await platform.exists(app.lastVault))) await get().enterVault(app.lastVault);
    set({ ready: true });
  },

  setView(v) {
    const app = { ...get().app, view: v };
    set({ app });
    persist(app);
  },

  setPrefs(p) {
    const app = { ...get().app, prefs: { ...get().app.prefs, ...p } };
    if (p.lang) setLang(p.lang);
    if (p.theme) applyTheme(p.theme);
    set({ app });
    persist(app);
  },

  setRibbon(r) {
    const app = { ...get().app, ribbon: r };
    set({ app });
    persist(app);
  },

  async openVault(root) {
    try {
      const cfg = await ensureVault(root);
      const docs = await listDocuments(root, cfg);
      const app = {
        ...get().app,
        lastVault: root,
        recentVaults: pushRecent(get().app.recentVaults, root, (a, b) => a === b, 12),
      };
      set({ vaultRoot: root, vault: cfg, docs, activeDoc: null, app });
      persist(app);
    } catch (e) {
      get().toast(t('vault.openError', { error: String(e) }), 'error');
    }
  },

  async enterVault(root) {
    if (!(await platform.exists(root))) {
      get().toast(t('start.missing'), 'error');
      return false;
    }
    const wasLast = get().app.lastVault === root;
    await get().openVault(root);
    const st = get();
    if (st.vaultRoot !== root) return false;
    // l'ultimo Scroll vale solo se apparteneva a questo Compendium
    const last = wasLast && st.app.lastDoc ? st.docs.find((d) => d.rel === st.app.lastDoc) : undefined;
    if (last) st.openDoc(last.rel);
    else if (st.docs.length) st.openDoc(st.docs[0].rel);
    else await st.newDoc();
    if (get().app.view !== 'editor') get().setView('editor');
    return true;
  },

  closeVault() {
    set({ vaultRoot: null, vault: null, docs: [], activeDoc: null, dialog: null, dialogArg: null });
  },

  async createDefaultVault() {
    const docs = await platform.documentsDir();
    return get().enterVault(await ensureDir(joinPath(docs, 'Alexandria', t('vault.defaultName'))));
  },

  forgetRecent(root) {
    const app = { ...get().app, recentVaults: get().app.recentVaults.filter((r) => r !== root), lastVault: get().app.lastVault === root ? null : get().app.lastVault };
    set({ app });
    persist(app);
  },

  async refreshDocs() {
    const { vaultRoot, vault } = get();
    if (!vaultRoot || !vault) return;
    const docs = await listDocuments(vaultRoot, vault);
    const active = get().activeDoc;
    set({ docs, activeDoc: active && docs.some((d) => d.rel === active) ? active : docs[0]?.rel ?? null });
  },

  openDoc(rel) {
    const { vaultRoot } = get();
    if (!vaultRoot) return;
    const app = {
      ...get().app,
      lastDoc: rel,
      recentDocs: pushRecent(get().app.recentDocs, { vault: vaultRoot, doc: rel }, (a, b) => a.vault === b.vault && a.doc === b.doc, 20),
    };
    set({ activeDoc: rel, app });
    persist(app);
  },

  async newDoc(title, folder = '', init) {
    const { vaultRoot, docs } = get();
    if (!vaultRoot) return null;
    const rel = await createDocument(vaultRoot, docs, title ?? t('doc.untitled'), folder, init?.markdown ?? '');
    if (init) await writeJson(abs(vaultRoot, docSettingsFile(rel)), init.settings);
    await get().refreshDocs();
    get().openDoc(rel);
    return rel;
  },

  async renameDoc(rel, title) {
    const { vaultRoot, docs, vault } = get();
    if (!vaultRoot || !vault) return;
    const next = await renameDocument(vaultRoot, docs, rel, title);
    if (next !== rel) {
      const cfg = { ...vault, order: vault.order.map((r) => (r === rel ? next : r)) };
      await saveVaultConfig(vaultRoot, cfg);
      set({ vault: cfg });
      await get().refreshDocs();
      if (get().activeDoc === rel || get().activeDoc === null) get().openDoc(next);
    }
  },

  async deleteDoc(rel) {
    const { vaultRoot } = get();
    if (!vaultRoot) return;
    await deleteDocument(vaultRoot, rel);
    await get().refreshDocs();
    if (!get().docs.length) await get().newDoc();
    else if (get().activeDoc) get().openDoc(get().activeDoc!);
  },

  async duplicateDoc(rel) {
    const { vaultRoot, docs } = get();
    if (!vaultRoot) return;
    const next = await duplicateDocument(vaultRoot, docs, rel, t('doc.copySuffix'));
    await get().refreshDocs();
    get().openDoc(next);
  },

  async reorderDocs(order) {
    const { vaultRoot, vault } = get();
    if (!vaultRoot || !vault) return;
    const cfg = { ...vault, order };
    await saveVaultConfig(vaultRoot, cfg);
    set({ vault: cfg });
    await get().refreshDocs();
  },

  setCursor(rel, pos, scroll) {
    const { vaultRoot } = get();
    if (!vaultRoot) return;
    const app = { ...get().app, cursors: { ...get().app.cursors, [`${vaultRoot}|${rel}`]: { pos, scroll } } };
    set({ app });
    persist(app);
  },

  openDialog(d, arg) {
    set({ dialog: d, dialogArg: arg ?? null });
  },
  closeDialog() {
    set({ dialog: null, dialogArg: null });
  },
  toast(text, kind = 'info', action) {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, kind, text, action }] });
    setTimeout(() => get().dismissToast(id), kind === 'error' || action ? 8000 : 3500);
  },
  dismissToast(id) {
    set({ toasts: get().toasts.filter((x) => x.id !== id) });
  },
  setSaveState(s) {
    if (get().saveState !== s) set({ saveState: s });
  },
  bumpReload() {
    set({ reloadToken: get().reloadToken + 1 });
  },
}));

export const ws = () => useWorkspace.getState();
