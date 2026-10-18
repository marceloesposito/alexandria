// Stato di Column: il foglio aperto (testo, Marginalia, Tabula, versioni, media), l'elenco dei fogli
// in lavorazione e le preferenze. Il salvataggio e' automatico, con un breve ritardo.
import { create } from 'zustand';
import type { CommentsFile } from 'logos/comments/model';
import { platform } from '../platform';
import { setLang, t } from '../i18n';
import { displayName, mediaName, FILES, type Sheet, type SheetFont, type SheetView } from './format';
import { adoptSheet, createSheet, defaultAppState, deleteSheet, listSheets, loadAppState, loadSheet, saveAppState, saveSheet, type AppState, type SheetEntry } from './sheets';
import type { Tabula } from './tabula/model';
import { prune, record, resumeFrom, rename as renameVersion, type VersionTree } from './versions/tree';
import { shouldSnapshot } from './versions/snapshots';
import { newId } from './tabula/model';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
export type Screen = 'splash' | 'onboarding' | 'landing' | 'sheet';

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'info' | 'error';
}

interface ColumnState {
  ready: boolean;
  /** cosa si vede: splash all'avvio, onboarding al primo lancio, pagina d'ingresso, il foglio */
  screen: Screen;
  app: AppState;
  sheets: SheetEntry[];
  sheet: Sheet | null;
  /** cambia a ogni foglio caricato: l'editor ricarica il contenuto */
  loadTick: number;
  saveState: SaveState;
  silentium: boolean;
  toasts: Toast[];
  /** ultimo istante in cui il testo e' cambiato */
  lastEdit: number;

  init(): Promise<void>;
  setScreen(s: Screen): void;
  /** riprende l'ultimo foglio (o il piu' recente) */
  resume(): Promise<void>;
  setApp(p: Partial<AppState>): void;
  refreshSheets(): Promise<void>;
  open(id: string): Promise<void>;
  createNew(): Promise<void>;
  remove(id: string): Promise<void>;
  /** un foglio arrivato da fuori diventa un foglio in lavorazione e si apre */
  adopt(s: Sheet): Promise<void>;
  patchSheet(p: Partial<Sheet>): void;
  setMarkdown(md: string): void;
  setComments(c: CommentsFile): void;
  setTabula(t: Tabula): void;
  setMeta(p: Partial<{ name: string; font: SheetFont; view: SheetView; split: number }>): void;
  setSilentium(on: boolean): void;
  addMedia(name: string, data: Uint8Array): string;
  saveVersion(label?: string, auto?: boolean): string | null;
  resumeVersion(id: string): void;
  renameVersion(id: string, label: string): void;
  flush(): Promise<void>;
  toast(text: string, kind?: Toast['kind']): void;
  dismiss(id: number): void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let appTimer: ReturnType<typeof setTimeout> | null = null;
let toastId = 0;
/** indirizzi blob delle immagini del foglio aperto (percorso media/... -> url) */
const mediaUrls = new Map<string, string>();

export function mediaUrl(src: string): string {
  const s = useColumn.getState().sheet;
  if (!s) return src;
  const cached = mediaUrls.get(src);
  if (cached) return cached;
  const name = src.replace(/^\.\//, '').startsWith(FILES.mediaDir) ? src.replace(/^\.\//, '').slice(FILES.mediaDir.length) : null;
  const data = name ? s.media[name] : undefined;
  if (!data) return src;
  const ext = name!.split('.').pop()?.toLowerCase() ?? '';
  const type = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  const url = URL.createObjectURL(new Blob([data.slice().buffer as ArrayBuffer], { type }));
  mediaUrls.set(src, url);
  return url;
}

function clearMediaUrls() {
  for (const u of mediaUrls.values()) URL.revokeObjectURL(u);
  mediaUrls.clear();
}

export function applyTheme(theme: AppState['theme']) {
  document.documentElement.dataset.theme = theme;
}

export const useColumn = create<ColumnState>((set, get) => {
  const scheduleSave = () => {
    set({ saveState: 'dirty' });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().flush(), 700);
  };
  const scheduleApp = () => {
    if (appTimer) clearTimeout(appTimer);
    appTimer = setTimeout(() => void saveAppState(get().app).catch(() => undefined), 400);
  };
  const touch = (s: Sheet): Sheet => ({ ...s, meta: { ...s.meta, updated: new Date().toISOString() } });

  return {
    ready: false,
    screen: 'splash',
    app: defaultAppState(),
    sheets: [],
    sheet: null,
    loadTick: 0,
    saveState: 'saved',
    silentium: false,
    toasts: [],
    lastEdit: 0,

    async init() {
      const app = await loadAppState();
      setLang(app.lang);
      applyTheme(app.theme);
      set({ app });
      await get().refreshSheets();
      // il foglio si apre dalla pagina d'ingresso: riprendere l'ultimo o cominciarne uno nuovo
      set({ ready: true });
    },

    setScreen(screen) {
      set({ screen });
    },

    async resume() {
      const { app, sheets } = get();
      const last = (app.lastSheet && sheets.find((s) => s.id === app.lastSheet)) || sheets[0];
      if (last) await get().open(last.id);
      else await get().createNew();
      set({ screen: 'sheet' });
    },

    setApp(p) {
      const app = { ...get().app, ...p };
      if (p.lang) setLang(p.lang);
      if (p.theme) applyTheme(p.theme);
      set({ app });
      scheduleApp();
    },

    async refreshSheets() {
      set({ sheets: await listSheets() });
    },

    async open(id) {
      await get().flush();
      snapshotOnLeave();
      await get().flush();
      try {
        const sheet = await loadSheet(id);
        clearMediaUrls();
        set({ sheet: sheet, loadTick: get().loadTick + 1, saveState: 'saved', lastEdit: 0, screen: 'sheet' });
        get().setApp({ lastSheet: id });
      } catch (e) {
        get().toast(t('sheet.loadError', { error: String(e) }), 'error');
      }
    },

    async createNew() {
      await get().flush();
      snapshotOnLeave();
      await get().flush();
      const s = await createSheet();
      clearMediaUrls();
      set({ sheet: s, loadTick: get().loadTick + 1, saveState: 'saved', lastEdit: 0, screen: 'sheet' });
      get().setApp({ lastSheet: s.meta.id });
      await get().refreshSheets();
    },

    async remove(id) {
      if (get().sheet?.meta.id === id) {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = null;
        set({ sheet: null });
      }
      await deleteSheet(id);
      await get().refreshSheets();
      if (!get().sheet) {
        const next = get().sheets[0];
        if (next) await get().open(next.id);
        else await get().createNew();
      }
    },

    async adopt(s) {
      await get().flush();
      snapshotOnLeave();
      await get().flush();
      const sheet = await adoptSheet(s);
      clearMediaUrls();
      set({ sheet, loadTick: get().loadTick + 1, saveState: 'saved', lastEdit: 0, screen: 'sheet' });
      get().setApp({ lastSheet: sheet.meta.id });
      await get().refreshSheets();
    },

    patchSheet(p) {
      const s = get().sheet;
      if (!s) return;
      set({ sheet: touch({ ...s, ...p }) });
      scheduleSave();
    },

    setMarkdown(md) {
      const s = get().sheet;
      if (!s || s.markdown === md) return;
      set({ sheet: touch({ ...s, markdown: md }), lastEdit: Date.now() });
      scheduleSave();
    },

    setComments(c) {
      get().patchSheet({ comments: c });
    },

    setTabula(tab) {
      get().patchSheet({ tabula: tab });
    },

    setMeta(p) {
      const s = get().sheet;
      if (!s) return;
      set({ sheet: touch({ ...s, meta: { ...s.meta, ...p } }) });
      scheduleSave();
      if ('name' in p) void get().refreshSheets();
    },

    setSilentium(on) {
      set({ silentium: on });
    },

    addMedia(name, data) {
      const s = get().sheet;
      if (!s) return '';
      const file = mediaName(name, Object.keys(s.media));
      get().patchSheet({ media: { ...s.media, [file]: data } });
      return `${FILES.mediaDir}${file}`;
    },

    saveVersion(label, auto = false) {
      const s = get().sheet;
      if (!s) return null;
      const id = newId('v');
      let tree: VersionTree = record(s.tree, { id, at: Date.now(), label: label || undefined, auto });
      const versions = { ...s.versions, [id]: s.markdown };
      const pruned = prune(tree, Date.now());
      tree = pruned.tree;
      for (const r of pruned.removed) delete versions[r];
      get().patchSheet({ tree, versions });
      return id;
    },

    resumeVersion(id) {
      const s = get().sheet;
      const md = s?.versions[id];
      if (!s || md === undefined) return;
      // il testo attuale non va perso: se e' cambiato dall'ultima versione se ne fa una prima di tornare indietro
      const head = s.tree.head ? s.versions[s.tree.head] : null;
      if (head !== s.markdown && s.markdown.trim()) get().saveVersion(undefined, true);
      const cur = get().sheet!;
      set({ sheet: touch({ ...cur, markdown: md, tree: resumeFrom(cur.tree, id) }), loadTick: get().loadTick + 1 });
      scheduleSave();
    },

    renameVersion(id, label) {
      const s = get().sheet;
      if (s) get().patchSheet({ tree: renameVersion(s.tree, id, label) });
    },

    async flush() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      const s = get().sheet;
      if (!s || get().saveState === 'saved') return;
      set({ saveState: 'saving' });
      try {
        await saveSheet(s);
        // nel frattempo puo' essere cambiato di nuovo
        if (get().sheet === s) set({ saveState: 'saved' });
        else scheduleSave();
        const entry = get().sheets.find((e) => e.id === s.meta.id);
        if (!entry || entry.updated !== s.meta.updated) {
          set({ sheets: [{ id: s.meta.id, name: s.meta.name, updated: s.meta.updated, preview: s.markdown.slice(0, 400) }, ...get().sheets.filter((e) => e.id !== s.meta.id)] });
        }
      } catch (e) {
        set({ saveState: 'error' });
        get().toast(t('sheet.saveError', { error: String(e) }), 'error');
      }
    },

    toast(text, kind = 'info') {
      const id = ++toastId;
      set({ toasts: [...get().toasts, { id, text, kind }] });
      setTimeout(() => get().dismiss(id), kind === 'error' ? 8000 : 4000);
    },

    dismiss(id) {
      set({ toasts: get().toasts.filter((x) => x.id !== id) });
    },
  };
});

/** Nome mostrato del foglio aperto. */
export function sheetTitle(s: Sheet | null): string {
  return s ? displayName(s, t('sheet.untitled')) : '';
}

/** Versione automatica se il testo e' cambiato abbastanza dopo una pausa (o sempre, lasciando il foglio). */
export function maybeSnapshot(closing = false) {
  const st = useColumn.getState();
  const s = st.sheet;
  if (!s) return;
  const last = s.tree.head ? (s.versions[s.tree.head] ?? null) : null;
  if (shouldSnapshot({ last, text: s.markdown, lastEdit: st.lastEdit, now: Date.now(), closing })) st.saveVersion(undefined, true);
}

function snapshotOnLeave() {
  maybeSnapshot(true);
}

/** Il foglio appena scelto o aperto dal sistema: lo si legge e si mette fra quelli in lavorazione. */
export async function openPath(path: string): Promise<void> {
  const { importFile } = await import('./importDoc');
  try {
    const s = await importFile(path, await platform.readBytes(path));
    await useColumn.getState().adopt(s);
  } catch (e) {
    useColumn.getState().toast(e instanceof Error ? e.message : String(e), 'error');
  }
}
