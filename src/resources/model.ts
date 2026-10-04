// Risorse del vault (fonti, ispirazioni, materiali): modello, layer e filtri stile AutoCAD.
// Funzioni pure: la vista (whiteboard, grafo, albero) chiede qui cosa e' visibile.

export type ResourceKind =
  | 'pdf'
  | 'text'
  | 'markdown'
  | 'rtf'
  | 'docx'
  | 'odt'
  | 'epub'
  | 'html'
  | 'image'
  | 'web'
  | 'youtube'
  | 'video'
  | 'audio'
  | 'reference' // voce bibliografica senza file (da BibTeX/RIS/DOI)
  | 'other';

/** Voce CSL-JSON (sottoinsieme usato dall'app; i campi ignoti si conservano). */
export interface CslItem {
  type?: string;
  title?: string;
  author?: { family?: string; given?: string; literal?: string }[];
  editor?: { family?: string; given?: string; literal?: string }[];
  issued?: { 'date-parts'?: (number | string)[][]; literal?: string };
  'container-title'?: string;
  publisher?: string;
  'publisher-place'?: string;
  page?: string;
  volume?: string;
  issue?: string;
  DOI?: string;
  ISBN?: string;
  URL?: string;
  accessed?: { 'date-parts'?: (number | string)[][] };
  abstract?: string;
  language?: string;
  [k: string]: unknown;
}

export interface PinRect {
  x: number; // 0..1 rispetto alla pagina o all'immagine
  y: number;
  w: number;
  h: number;
}

export interface Pin {
  id: string;
  label: string;
  kind: 'text' | 'rect' | 'time';
  quote?: string;
  page?: number;
  rect?: PinRect;
  time?: number; // secondi
  /** indicazione per la citazione: "p. 12", "min. 3:20", "par. 4" */
  locator?: string;
  note?: string;
  created: string;
}

export interface Resource {
  id: string;
  kind: ResourceKind;
  title: string;
  /** file dentro resources/<id>/ (assente per link e voci bibliografiche) */
  file?: string;
  url?: string;
  /** elemento della Library a cui la risorsa rimanda (il file vive li') */
  library?: string;
  csl: CslItem | null;
  citeKey: string | null;
  isSource: boolean;
  tags: string[];
  layers: string[];
  created: string;
  meta: {
    mime?: string;
    size?: number;
    sha256?: string;
    pages?: number;
    duration?: number;
    siteName?: string;
    description?: string;
    thumb?: string; // file dentro resources/<id>/
    videoId?: string;
    ocr?: boolean;
    archived?: boolean;
  };
  pins: Pin[];
}

// ---------------------------------------------------------------- layer

export type FilterField = 'tag' | 'kind' | 'year' | 'author' | 'title' | 'source' | 'domain' | 'text' | 'pinned';
export type FilterOp = 'is' | 'not' | 'contains' | 'gte' | 'lte';

export interface Condition {
  field: FilterField;
  op: FilterOp;
  value: string;
}

export interface FilterRule {
  match: 'all' | 'any';
  conditions: Condition[];
}

export interface Layer {
  id: string;
  name: string;
  parent: string | null;
  color: string; // token CSS, es. 'var(--series-3)'
  visible: boolean;
  locked: boolean;
  /** 'group' = appartenenza manuale; 'filter' = regola sulle proprieta' */
  kind: 'group' | 'filter';
  rule?: FilterRule;
  /** creato da un suggerimento dell'app */
  suggested?: boolean;
  reason?: string;
}

export interface LayersFile {
  version: 1;
  layers: Layer[];
  /** suggerimenti scartati dall'utente (per non riproporli) */
  dismissed: string[];
}

export const LAYER_COLORS = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);

export function yearOf(r: Resource): number | null {
  const dp = r.csl?.issued?.['date-parts']?.[0]?.[0];
  const y = typeof dp === 'string' ? parseInt(dp, 10) : dp;
  if (typeof y === 'number' && !Number.isNaN(y)) return y;
  const lit = r.csl?.issued?.literal?.match(/\d{4}/);
  return lit ? parseInt(lit[0], 10) : null;
}

export function authorsOf(r: Resource): string[] {
  return (r.csl?.author ?? []).map((a) => a.literal ?? [a.family, a.given].filter(Boolean).join(', ')).filter(Boolean);
}

export function firstAuthorFamily(r: Resource): string {
  const a = r.csl?.author?.[0];
  return a?.family ?? a?.literal ?? '';
}

export function domainOf(r: Resource): string | null {
  const u = r.url ?? r.csl?.URL;
  if (!u) return null;
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function matchCondition(r: Resource, c: Condition, text?: string): boolean {
  const v = fold(c.value.trim());
  let result: boolean;
  switch (c.field) {
    case 'tag':
      result = c.op === 'contains' ? r.tags.some((t) => fold(t).includes(v)) : r.tags.some((t) => fold(t) === v);
      break;
    case 'kind':
      result = r.kind === c.value;
      break;
    case 'source':
      result = r.isSource === (v === 'true' || v === 'si' || v === 'yes');
      break;
    case 'pinned':
      result = r.pins.length > 0;
      break;
    case 'year': {
      const y = yearOf(r);
      const n = parseInt(c.value, 10);
      if (y === null || Number.isNaN(n)) return c.op === 'not';
      result = c.op === 'gte' ? y >= n : c.op === 'lte' ? y <= n : y === n;
      if (c.op === 'gte' || c.op === 'lte') return result;
      break;
    }
    case 'author':
      result = authorsOf(r).some((a) => (c.op === 'is' || c.op === 'not' ? fold(a).split(',')[0].trim() === v : fold(a).includes(v)));
      break;
    case 'title':
      result = fold(r.title).includes(v);
      break;
    case 'domain':
      result = (domainOf(r) ?? '') === v || (c.op === 'contains' && (domainOf(r) ?? '').includes(v));
      break;
    case 'text':
      result = !!text && fold(text).includes(v);
      break;
    default:
      result = false;
  }
  return c.op === 'not' ? !result : result;
}

export function matchRule(r: Resource, rule: FilterRule, text?: string): boolean {
  if (!rule.conditions.length) return false;
  return rule.match === 'all'
    ? rule.conditions.every((c) => matchCondition(r, c, text))
    : rule.conditions.some((c) => matchCondition(r, c, text));
}

/** Discendenti di un layer (incluso). */
export function subtree(layers: Layer[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const l of layers) {
      if (l.parent && out.has(l.parent) && !out.has(l.id)) {
        out.add(l.id);
        grew = true;
      }
    }
  }
  return out;
}

/** Antenati di un layer (incluso), dal piu' vicino. */
export function ancestors(layers: Layer[], id: string): Layer[] {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const out: Layer[] = [];
  let cur = byId.get(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    cur = cur.parent ? byId.get(cur.parent) : undefined;
  }
  return out;
}

/** Il layer e' acceso solo se lo sono anche tutti i suoi genitori (come in AutoCAD). */
export function layerOn(layers: Layer[], id: string): boolean {
  return ancestors(layers, id).every((l) => l.visible);
}

export function layerLocked(layers: Layer[], id: string): boolean {
  return ancestors(layers, id).some((l) => l.locked);
}

/** Layer a cui appartiene una risorsa: gruppi manuali piu' filtri la cui regola la include. */
export function layersOf(r: Resource, layers: Layer[], text?: string): Layer[] {
  return layers.filter((l) => (l.kind === 'group' ? r.layers.includes(l.id) : !!l.rule && matchRule(r, l.rule, text)));
}

/** Membri di un layer: per un gruppo anche quelli dei sottogruppi; per un filtro chi soddisfa la regola. */
export function membersOf(layer: Layer, all: Layer[], resources: Resource[], texts?: Map<string, string>): Resource[] {
  if (layer.kind === 'filter') {
    return layer.rule ? resources.filter((r) => matchRule(r, layer.rule!, texts?.get(r.id))) : [];
  }
  const ids = subtree(all, layer.id);
  const subFilters = all.filter((l) => ids.has(l.id) && l.kind === 'filter' && l.rule);
  return resources.filter(
    (r) => r.layers.some((x) => ids.has(x)) || subFilters.some((f) => matchRule(r, f.rule!, texts?.get(r.id))),
  );
}

/**
 * Visibilita' di una risorsa: nascosta se uno dei suoi gruppi manuali e' spento;
 * se c'e' un layer o filtro attivo, si vedono solo i suoi membri.
 */
export function isVisible(
  r: Resource,
  layers: Layer[],
  active: string | null,
  resources: Resource[],
  texts?: Map<string, string>,
): boolean {
  for (const id of r.layers) if (layers.some((l) => l.id === id) && !layerOn(layers, id)) return false;
  for (const l of layers) {
    if (l.kind === 'filter' && l.rule && !layerOn(layers, l.id) && matchRule(r, l.rule, texts?.get(r.id))) return false;
  }
  if (active) {
    const layer = layers.find((l) => l.id === active);
    if (layer) return membersOf(layer, layers, resources, texts).some((m) => m.id === r.id);
  }
  return true;
}

export function isLocked(r: Resource, layers: Layer[]): boolean {
  return r.layers.some((id) => layers.some((l) => l.id === id) && layerLocked(layers, id));
}

export function colorOf(r: Resource, layers: Layer[]): string | null {
  const l = layers.find((x) => r.layers.includes(x.id));
  return l?.color ?? null;
}

let counter = 0;
export function newResourceId(): string {
  counter += 1;
  return `r${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function newLayerId(): string {
  counter += 1;
  return `l${Date.now().toString(36)}${counter.toString(36)}`;
}

export function newPinId(): string {
  counter += 1;
  return `p${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Testo leggibile del locator di un pin a una certa ora: 75 s -> "min. 1:15". */
export function timeLocator(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function displayAuthorYear(r: Resource): string {
  const a = firstAuthorFamily(r);
  const y = yearOf(r);
  return [a, y].filter(Boolean).join(' ');
}
