// Pezzi su disco. Column non crea cartelle per i pezzi: un pezzo nuovo non ha un file finche' l'utente
// non sceglie dove salvarlo (Salva, Salva come); da li' si salva da solo in quel .clmn. Finche' non ha
// un file, il pezzo aperto sta in una bozza sola (bozza.clmn nella cartella dei dati), cosi' una
// chiusura o un crash non lo perdono. L'elenco dei pezzi e' quello dei file aperti di recente.
import { platform, joinPath } from '../platform';
import { pack, unpack, type Sheet } from './format';
import { newId } from './tabula/model';
import { clampFrame, DEFAULT_FRAME, type Frame, type SnapZone } from './tabula/snap';
import { DEFAULT_BAR, normalizeBar, type BarPos } from './barPosition';
import { DEFAULT_SHOWN, normalizeShown, type CountKey } from './editor/countsModel';

/** Un pezzo nell'elenco dei recenti: `id` e' il percorso del suo file. */
export interface SheetEntry {
  id: string;
  name: string;
  updated: string;
  /** prime parole del testo, per riconoscere i pezzi senza nome */
  preview: string;
}

export const MAX_RECENT = 30;

let root: string | null = null;

export async function dataRoot(): Promise<string> {
  if (!root) root = await platform.dataDir();
  return root;
}

async function draftPath(): Promise<string> {
  return joinPath(await dataRoot(), 'bozza.clmn');
}

export function entryOf(path: string, s: Sheet): SheetEntry {
  return { id: path, name: s.meta.name, updated: s.meta.updated, preview: s.markdown.slice(0, 400) };
}

/** I recenti con `entry` in cima (al posto della sua voce vecchia). */
export function withRecent(list: SheetEntry[], entry: SheetEntry): SheetEntry[] {
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX_RECENT);
}

export async function readSheetFile(path: string): Promise<Sheet> {
  return unpack(await platform.readBytes(path), newId('f'));
}

/** Scrive il .clmn passando da un file accanto: un'interruzione non lascia mai un file a meta'. */
export async function writeSheetFile(path: string, s: Sheet): Promise<void> {
  const tmp = `${path}-tmp`;
  await platform.writeBytes(tmp, await pack(s));
  if (await platform.exists(path)) await platform.remove(path);
  await platform.rename(tmp, path);
}

export async function readDraft(): Promise<Sheet | null> {
  const p = await draftPath();
  if (!(await platform.exists(p))) return null;
  try {
    return await readSheetFile(p);
  } catch {
    return null;
  }
}

export async function writeDraft(s: Sheet): Promise<void> {
  await writeSheetFile(await draftPath(), s);
}

export async function clearDraft(): Promise<void> {
  const p = await draftPath();
  if (await platform.exists(p)) await platform.remove(p);
}

// ---------------------------------------------------------------- stato dell'app

export interface AppState {
  /** file dell'ultimo pezzo aperto (null: la bozza o nessuno) */
  lastSheet: string | null;
  /** pezzi aperti di recente, il piu' recente in cima */
  recent: SheetEntry[];
  theme: 'system' | 'light' | 'dark';
  lang: 'it' | 'en';
  author: string;
  timer?: unknown;
  /** storico del timer di oggi */
  timerLog?: unknown;
  /** pannello aperto a sinistra */
  panel: 'sheets' | 'index' | null;
  zoom: number;
  /** onboarding gia' visto */
  onboarded: boolean;
  /** Tabula flottante (bordo sinistro): aperta, posizione (frazioni dello spazio), misure prima dell'aggancio */
  tabula: PanelWin;
  /** Palimpsestus flottante (bordo destro) */
  versions: PanelWin;
  /** barretta: libera dove la si e' lasciata o agganciata in alto */
  bar: BarPos;
  /** cosa mostra il contatore */
  counts: CountKey[];
  /** mentre si scrive gli altri paragrafi si attenuano (in Typewriter sempre) */
  focus: boolean;
}

export interface PanelWin {
  open: boolean;
  frame: Frame;
  free: Frame;
  snap: SnapZone | null;
}

export type PanelId = 'tabula' | 'versions';

/** Posto di partenza: la Tabula a sinistra, il Palimpsestus a destra, quasi tutta l'altezza. */
const START: Record<PanelId, Frame> = { tabula: { ...DEFAULT_FRAME, x: 0.04 }, versions: { ...DEFAULT_FRAME, x: 0.54 } };

const ZONES: SnapZone[] = ['left', 'right', 'top', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

function normalizePanel(raw: unknown, id: PanelId): PanelWin {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<PanelWin>;
  const frame = (f: unknown): Frame => {
    const x = f as Partial<Frame> | null;
    return x && [x.x, x.y, x.w, x.h].every((v) => typeof v === 'number' && Number.isFinite(v)) ? clampFrame(x as Frame) : START[id];
  };
  return { open: r.open === true, frame: frame(r.frame), free: frame(r.free ?? r.frame), snap: ZONES.includes(r.snap as SnapZone) ? (r.snap as SnapZone) : null };
}

function normalizeRecent(raw: unknown): SheetEntry[] {
  if (!Array.isArray(raw)) return [];
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && typeof (e as SheetEntry).id === 'string' && !!(e as SheetEntry).id)
    .map((e) => ({ id: str(e.id), name: str(e.name), updated: str(e.updated), preview: str(e.preview) }))
    .slice(0, MAX_RECENT);
}

export function defaultAppState(): AppState {
  const lang = typeof navigator !== 'undefined' && !navigator.language.startsWith('it') ? 'en' : 'it';
  return { lastSheet: null, recent: [], theme: 'system', lang, author: '', panel: null, zoom: 1, onboarded: false, tabula: normalizePanel(null, 'tabula'), versions: normalizePanel(null, 'versions'), bar: DEFAULT_BAR, counts: DEFAULT_SHOWN, focus: true };
}

export async function loadAppState(): Promise<AppState> {
  try {
    const raw = JSON.parse(await platform.readText(joinPath(await dataRoot(), 'stato.json')));
    const d = defaultAppState();
    return {
      lastSheet: typeof raw.lastSheet === 'string' ? raw.lastSheet : null,
      recent: normalizeRecent(raw.recent),
      theme: ['system', 'light', 'dark'].includes(raw.theme) ? raw.theme : d.theme,
      lang: raw.lang === 'en' || raw.lang === 'it' ? raw.lang : d.lang,
      author: typeof raw.author === 'string' ? raw.author : '',
      timer: raw.timer,
      timerLog: raw.timerLog,
      panel: raw.panel === 'sheets' || raw.panel === 'index' ? raw.panel : null,
      zoom: typeof raw.zoom === 'number' && raw.zoom >= 0.6 && raw.zoom <= 2 ? raw.zoom : 1,
      onboarded: raw.onboarded === true,
      tabula: normalizePanel(raw.tabula, 'tabula'),
      versions: normalizePanel(raw.versions, 'versions'),
      bar: normalizeBar(raw.bar),
      counts: normalizeShown(raw.counts),
      focus: raw.focus !== false,
    };
  } catch {
    return defaultAppState();
  }
}

export async function saveAppState(s: AppState): Promise<void> {
  await platform.writeText(joinPath(await dataRoot(), 'stato.json'), JSON.stringify(s, null, 2));
}
