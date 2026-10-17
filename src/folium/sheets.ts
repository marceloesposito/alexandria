// Fogli in lavorazione: ogni foglio e' una cartella in <dati>/fogli/<id>/ con gli stessi file del
// .folium (non compressi). Il salvataggio riscrive solo i file cambiati dall'ultima volta.
import { platform, joinPath } from '../platform';
import { FILES, sheetFiles, sheetFromFiles, newSheet, type Sheet } from './format';
import { newId } from './tabula/model';

export interface SheetEntry {
  id: string;
  name: string;
  updated: string;
  /** prime parole del testo, per riconoscere i fogli senza nome */
  preview: string;
}

let root: string | null = null;

export async function dataRoot(): Promise<string> {
  if (!root) root = await platform.dataDir();
  return root;
}

export async function sheetsDir(): Promise<string> {
  return joinPath(await dataRoot(), 'fogli');
}

async function sheetDir(id: string): Promise<string> {
  return joinPath(await sheetsDir(), id);
}

/** Ultimo contenuto scritto per ogni file di ogni foglio (percorso assoluto -> testo o byte). */
const written = new Map<string, string | Uint8Array>();

function same(a: string | Uint8Array | undefined, b: string | Uint8Array): boolean {
  if (a === undefined) return false;
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export async function listSheets(): Promise<SheetEntry[]> {
  const dir = await sheetsDir();
  if (!(await platform.exists(dir))) return [];
  const out: SheetEntry[] = [];
  for (const e of await platform.list(dir)) {
    if (!e.isDir) continue;
    try {
      const meta = JSON.parse(await platform.readText(joinPath(e.path, FILES.meta)));
      let preview = '';
      try {
        preview = (await platform.readText(joinPath(e.path, FILES.text))).slice(0, 400);
      } catch {
        /* foglio senza testo */
      }
      out.push({ id: e.name, name: String(meta.name ?? ''), updated: String(meta.updated ?? ''), preview });
    } catch {
      /* cartella che non e' un foglio */
    }
  }
  return out.sort((a, b) => b.updated.localeCompare(a.updated));
}

async function readDirFiles(dir: string, prefix = ''): Promise<Map<string, string | Uint8Array>> {
  const out = new Map<string, string | Uint8Array>();
  for (const e of await platform.list(dir)) {
    const rel = prefix + e.name;
    if (e.isDir) {
      for (const [k, v] of await readDirFiles(e.path, rel + '/')) out.set(k, v);
    } else if (rel.startsWith(FILES.mediaDir)) out.set(rel, await platform.readBytes(e.path));
    else if (!rel.endsWith('.folium-tmp')) out.set(rel, await platform.readText(e.path));
  }
  return out;
}

export async function loadSheet(id: string): Promise<Sheet> {
  const dir = await sheetDir(id);
  const files = await readDirFiles(dir);
  for (const [rel, v] of files) written.set(joinPath(dir, rel), v);
  const s = sheetFromFiles(files, id);
  // l'id e' quello della cartella, anche se il file dice altro (copie fatte a mano)
  return { ...s, meta: { ...s.meta, id } };
}

/** Scrive i file cambiati del foglio; toglie quelli che non ci sono piu' (versioni potate, media). */
export async function saveSheet(s: Sheet): Promise<void> {
  const dir = await sheetDir(s.meta.id);
  const files = sheetFiles(s);
  const keep = new Set<string>();
  for (const [rel, data] of files) {
    const path = joinPath(dir, rel);
    keep.add(path);
    if (same(written.get(path), data)) continue;
    if (typeof data === 'string') await platform.writeText(path, data);
    else await platform.writeBytes(path, data);
    written.set(path, data);
  }
  for (const path of [...written.keys()]) {
    if (!path.startsWith(dir + '/') || keep.has(path)) continue;
    await platform.remove(path);
    written.delete(path);
  }
}

export async function createSheet(now = new Date(), name = ''): Promise<Sheet> {
  const s = newSheet(newId('f'), now, name);
  await platform.mkdir(await sheetDir(s.meta.id));
  await saveSheet(s);
  return s;
}

export async function deleteSheet(id: string): Promise<void> {
  const dir = await sheetDir(id);
  await platform.remove(dir);
  for (const path of [...written.keys()]) if (path.startsWith(dir + '/')) written.delete(path);
}

/** Un foglio arrivato da fuori (.folium aperto, documento importato) diventa un foglio in lavorazione. */
export async function adoptSheet(s: Sheet): Promise<Sheet> {
  const taken = new Set((await listSheets()).map((e) => e.id));
  const id = taken.has(s.meta.id) || !s.meta.id ? newId('f') : s.meta.id;
  const out = { ...s, meta: { ...s.meta, id } };
  await platform.mkdir(await sheetDir(id));
  await saveSheet(out);
  return out;
}

// ---------------------------------------------------------------- stato dell'app

export interface AppState {
  lastSheet: string | null;
  theme: 'system' | 'light' | 'dark';
  lang: 'it' | 'en';
  author: string;
  timer?: unknown;
  /** storico del timer di oggi */
  timerLog?: unknown;
  /** pannello aperto a sinistra */
  panel: 'sheets' | 'index' | null;
  zoom: number;
}

export function defaultAppState(): AppState {
  const lang = typeof navigator !== 'undefined' && !navigator.language.startsWith('it') ? 'en' : 'it';
  return { lastSheet: null, theme: 'system', lang, author: '', panel: null, zoom: 1 };
}

export async function loadAppState(): Promise<AppState> {
  try {
    const raw = JSON.parse(await platform.readText(joinPath(await dataRoot(), 'stato.json')));
    const d = defaultAppState();
    return {
      lastSheet: typeof raw.lastSheet === 'string' ? raw.lastSheet : null,
      theme: ['system', 'light', 'dark'].includes(raw.theme) ? raw.theme : d.theme,
      lang: raw.lang === 'en' || raw.lang === 'it' ? raw.lang : d.lang,
      author: typeof raw.author === 'string' ? raw.author : '',
      timer: raw.timer,
      timerLog: raw.timerLog,
      panel: raw.panel === 'sheets' || raw.panel === 'index' ? raw.panel : null,
      zoom: typeof raw.zoom === 'number' && raw.zoom >= 0.6 && raw.zoom <= 2 ? raw.zoom : 1,
    };
  } catch {
    return defaultAppState();
  }
}

export async function saveAppState(s: AppState): Promise<void> {
  await platform.writeText(joinPath(await dataRoot(), 'stato.json'), JSON.stringify(s, null, 2));
}
