// Stato centrale dell'app: preferenze, vault aperto, documento attivo, finestre di dialogo.
import { create } from 'zustand';
import { platform, joinPath } from '../platform';
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
} from '../vault/vault';

export type DialogId =
  | 'ribbonCustomize'
  | 'preferences'
  | 'docSettings'
  | 'about'
  | 'shortcuts'
  | 'help'
  | 'commit'
  | 'newBranch'
  | 'merge'
  | 'remote'
  | 'addResource'
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
  refreshDocs(): Promise<void>;
  openDoc(rel: string): void;
  newDoc(title?: string, folder?: string): Promise<string | null>;
  renameDoc(rel: string, title: string): Promise<void>;
  deleteDoc(rel: string): Promise<void>;
  duplicateDoc(rel: string): Promise<void>;
  reorderDocs(order: string[]): Promise<void>;
  setCursor(rel: string, pos: number, scroll: number): void;
  openDialog(d: DialogId, arg?: unknown): void;
  closeDialog(): void;
  toast(text: string, kind?: Toast['kind']): void;
  dismissToast(id: number): void;
  setSaveState(s: WorkspaceState['saveState']): void;
  bumpReload(): void;
}

let statePath: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let toastId = 0;

function persist(app: AppState) {
  if (!statePath) return;
  if (saveTimer) clearTimeout(saveTimer);
  const path = statePath;
  saveTimer = setTimeout(() => {
    platform.writeText(path, JSON.stringify(app, null, 2)).catch(() => {
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
      if (await platform.exists(statePath)) app = normalizeAppState(JSON.parse(await platform.readText(statePath)));
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

    // Avvio: ultimo vault e ultimo documento; al primo avvio un vault nuovo con un documento vuoto
    let root = app.lastVault;
    if (root && !(await platform.exists(root))) root = null;
    if (!root) {
      const docs = await platform.documentsDir();
      root = joinPath(docs, 'Alexandria', t('vault.defaultName'));
    }
    await get().openVault(root);
    const st = get();
    const last = st.app.lastDoc && st.docs.find((d) => d.rel === st.app.lastDoc);
    if (last) st.openDoc(last.rel);
    else if (st.docs.length) st.openDoc(st.docs[0].rel);
    else await st.newDoc();
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

  async newDoc(title, folder = '') {
    const { vaultRoot, docs } = get();
    if (!vaultRoot) return null;
    const rel = await createDocument(vaultRoot, docs, title ?? t('doc.untitled'), folder);
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
  toast(text, kind = 'info') {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 8000 : 3500);
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
