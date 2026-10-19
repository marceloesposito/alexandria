// Stato di Column: il pezzo aperto (testo, Marginalia, Tabula, versioni, media), l'elenco dei pezzi
// aperti di recente e le preferenze. Il salvataggio e' automatico, con un breve ritardo: nel .clmn
// scelto dall'utente o, finche' il pezzo non ha un file, nella bozza (sheets.ts).
import { create } from 'zustand';
import type { CommentsFile } from 'logos/comments/model';
import { platform } from '../platform';
import { setLang, t } from '../i18n';
import { displayName, mediaName, newSheet, EXT, FILES, fileStem, type Sheet, type SheetFont, type SheetView } from './format';
import { clearDraft, defaultAppState, entryOf, loadAppState, readDraft, readSheetFile, saveAppState, withRecent, writeDraft, writeSheetFile, type AppState, type SheetEntry } from './sheets';
import { choiceDialog } from '../components/confirm';
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
  /** pezzi aperti di recente (id = percorso del file) */
  sheets: SheetEntry[];
  sheet: Sheet | null;
  /** file del pezzo aperto; null finche' l'utente non sceglie dove salvarlo */
  path: string | null;
  /** il pezzo senza file rimasto aperto alla chiusura (bozza), da riprendere */
  draft: SheetEntry | null;
  /** cambia a ogni foglio caricato: l'editor ricarica il contenuto */
  loadTick: number;
  saveState: SaveState;
  silentium: boolean;
  toasts: Toast[];
  /** ultimo istante in cui il testo e' cambiato */
  lastEdit: number;

  init(): Promise<void>;
  setScreen(s: Screen): void;
  /** riprende la bozza, l'ultimo pezzo o il piu' recente */
  resume(): Promise<void>;
  setApp(p: Partial<AppState>): void;
  /** apre il .clmn al percorso `path` (anche dall'elenco dei recenti) */
  open(path: string): Promise<void>;
  createNew(): Promise<void>;
  /** toglie un pezzo dall'elenco dei recenti (il file resta dov'e') */
  remove(path: string): Promise<void>;
  /** un pezzo arrivato da fuori: con `path` resta nel suo file, senza diventa un pezzo da salvare */
  adopt(s: Sheet, path?: string | null): Promise<void>;
  /** Salva: nel suo file o, la prima volta, dove sceglie l'utente. false se ha annullato */
  save(): Promise<boolean>;
  /** Salva come: un file nuovo, che da quel momento e' il file del pezzo */
  saveAs(): Promise<boolean>;
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

  /** Mostra un pezzo appena letto o creato (`path` null: senza file). */
  const show = (sheet: Sheet, path: string | null) => {
    clearMediaUrls();
    set({ sheet, path, loadTick: get().loadTick + 1, saveState: 'saved', lastEdit: 0, screen: 'sheet' });
    get().setApp({ lastSheet: path });
    if (path) recentAdd(path, sheet);
  };

  const recentAdd = (path: string, s: Sheet) => {
    const recent = withRecent(get().app.recent, entryOf(path, s));
    set({ sheets: recent });
    get().setApp({ recent });
  };

  const recentRemove = (path: string) => {
    const recent = get().app.recent.filter((e) => e.id !== path);
    set({ sheets: recent });
    get().setApp({ recent, lastSheet: get().app.lastSheet === path ? null : get().app.lastSheet });
  };

  /**
   * Prima di passare a un altro pezzo: quello aperto si salva. Se non ha ancora un file e contiene
   * qualcosa, si chiede se salvarlo (la bozza e' una sola). false: l'utente ha annullato.
   */
  const leave = async (): Promise<boolean> => {
    await get().flush();
    snapshotOnLeave();
    await get().flush();
    const s = get().sheet;
    if (!s || get().path || (!s.markdown.trim() && !s.tabula?.blocks?.length)) return true;
    const choice = await choiceDialog(t('leave.title', { name: sheetTitle(s) }), t('leave.message'), { okLabel: t('leave.save'), altLabel: t('leave.discard') });
    if (choice === null) return false;
    if (choice === 'ok' && !(await get().saveAs())) return false;
    if (choice === 'alt') {
      await clearDraft();
      set({ draft: null });
    }
    return true;
  };

  return {
    ready: false,
    screen: 'splash',
    app: defaultAppState(),
    sheets: [],
    sheet: null,
    path: null,
    draft: null,
    loadTick: 0,
    saveState: 'saved',
    silentium: false,
    toasts: [],
    lastEdit: 0,

    async init() {
      const app = await loadAppState();
      setLang(app.lang);
      applyTheme(app.theme);
      const draft = await readDraft();
      set({ app, sheets: app.recent, draft: draft ? entryOf('', draft) : null });
      // il foglio si apre dalla pagina d'ingresso: riprendere l'ultimo o cominciarne uno nuovo
      set({ ready: true });
    },

    setScreen(screen) {
      set({ screen });
    },

    async resume() {
      const { app, sheets } = get();
      const draft = await readDraft();
      if (draft && !app.lastSheet) {
        show(draft, null);
        return;
      }
      const last = (app.lastSheet && sheets.find((s) => s.id === app.lastSheet)) || sheets[0];
      if (last) await get().open(last.id);
      else if (draft) show(draft, null);
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

    async open(path) {
      if (path === get().path && get().sheet) {
        set({ screen: 'sheet' });
        return;
      }
      if (!(await leave())) return;
      try {
        show(await readSheetFile(path), path);
      } catch (e) {
        // file spostato o cancellato: esce dall'elenco
        get().toast(t('sheet.loadError', { error: e instanceof Error ? e.message : String(e) }), 'error');
        recentRemove(path);
      }
    },

    async createNew() {
      if (!(await leave())) return;
      show(newSheet(newId('f'), new Date()), null);
    },

    async remove(path) {
      recentRemove(path);
    },

    async adopt(s, path = null) {
      if (!(await leave())) return;
      show(s, path);
      // un documento importato e' gia' testo da non perdere: va subito nella bozza
      if (!path) scheduleSave();
    },

    async save() {
      if (!get().sheet) return false;
      if (!get().path) return get().saveAs();
      set({ saveState: 'dirty' });
      await get().flush();
      return get().saveState === 'saved';
    },

    async saveAs() {
      const s = get().sheet;
      if (!s) return false;
      const name = s.meta.name || sheetTitle(s);
      const path = await platform.saveDialog(`${fileStem(name)}.${EXT}`, [EXT]);
      if (!path) return false;
      const wasDraft = !get().path;
      const named = { ...s, meta: { ...s.meta, name: s.meta.name || name } };
      try {
        await writeSheetFile(path, named);
      } catch (e) {
        get().toast(t('saveAs.error', { error: e instanceof Error ? e.message : String(e) }), 'error');
        return false;
      }
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      set({ sheet: named, path, saveState: 'saved' });
      if (wasDraft) {
        await clearDraft();
        set({ draft: null });
      }
      recentAdd(path, named);
      get().toast(t('saveAs.done', { name: path.slice(path.lastIndexOf('/') + 1) }), 'ok');
      return true;
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
      const path = get().path;
      if (!s || get().saveState === 'saved') return;
      // un pezzo nuovo ancora vuoto non lascia niente su disco
      if (!path && !s.markdown.trim() && !s.tabula?.blocks?.length) {
        set({ saveState: 'saved' });
        return;
      }
      set({ saveState: 'saving' });
      try {
        if (path) await writeSheetFile(path, s);
        else await writeDraft(s);
        // nel frattempo puo' essere cambiato di nuovo
        if (get().sheet === s) set({ saveState: 'saved' });
        else scheduleSave();
        if (path && get().path === path) recentAdd(path, s);
        else if (!path) set({ draft: entryOf('', s) });
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
  // un .clmn si apre nel suo file e li' si salva; il resto (anche i vecchi .folium) diventa un pezzo
  // nuovo da salvare dove si vuole
  if (path.toLowerCase().endsWith(`.${EXT}`)) {
    await useColumn.getState().open(path);
    return;
  }
  const { importFile } = await import('./importDoc');
  try {
    const s = await importFile(path, await platform.readBytes(path));
    await useColumn.getState().adopt(s);
  } catch (e) {
    useColumn.getState().toast(e instanceof Error ? e.message : String(e), 'error');
  }
}
