// Tipi di oggetto con proprietà (Capitolo, Scena, Personaggio, Voce di diario...). Si applicano alle
// pergamene (dati nel file delle impostazioni, il .md non cambia) e alle risorse dell'Armarium.
// Funzioni pure.

export type PropKind = 'text' | 'number' | 'date' | 'select' | 'multi' | 'checkbox' | 'url' | 'person';
export type PropValue = string | number | boolean | string[] | null;

export interface PropDef {
  key: string;
  label: string;
  kind: PropKind;
  /** valori ammessi per select e multi */
  options?: string[];
}

export type TypeTarget = 'doc' | 'resource';

export interface ObjectType {
  id: string;
  name: string;
  /** nome di un'icona dell'elenco TYPE_ICONS */
  icon: string;
  color: string; // token, es. 'var(--series-2)'
  appliesTo: TypeTarget[];
  properties: PropDef[];
}

export interface TypesFile {
  version: 1;
  types: ObjectType[];
}

/** Tipo e valori delle proprietà di un oggetto. */
export interface ObjectData {
  type: string | null;
  props: Record<string, PropValue>;
}

export const TYPE_ICONS = ['file', 'book', 'clapperboard', 'newspaper', 'user', 'map-pin', 'mic', 'dices', 'notebook', 'lightbulb', 'tag'] as const;
export const PROP_KINDS: PropKind[] = ['text', 'number', 'date', 'select', 'multi', 'checkbox', 'url', 'person'];

export const emptyObject = (): ObjectData => ({ type: null, props: {} });

const p = (key: string, label: string, kind: PropKind, options?: string[]): PropDef => (options ? { key, label, kind, options } : { key, label, kind });

/** Tipi di partenza, neutri: servono a chi scrive saggi, romanzi, sceneggiature, articoli, giochi. */
export function builtInTypes(lang: 'it' | 'en' = 'it'): ObjectType[] {
  const it = lang === 'it';
  const status = it ? ['Idea', 'Bozza', 'Rivista', 'Finale'] : ['Idea', 'Draft', 'Revised', 'Final'];
  const L = (a: string, b: string) => (it ? a : b);
  return [
    { id: 'chapter', name: L('Capitolo', 'Chapter'), icon: 'book', color: 'var(--series-1)', appliesTo: ['doc'], properties: [p('status', L('Stato', 'Status'), 'select', status), p('target', L('Parole obiettivo', 'Word target'), 'number'), p('summary', L('Sinossi', 'Synopsis'), 'text')] },
    { id: 'scene', name: L('Scena', 'Scene'), icon: 'clapperboard', color: 'var(--series-2)', appliesTo: ['doc'], properties: [p('status', L('Stato', 'Status'), 'select', status), p('pov', L('Punto di vista', 'Point of view'), 'person'), p('place', L('Luogo', 'Place'), 'text'), p('time', L('Quando', 'When'), 'text')] },
    { id: 'article', name: L('Articolo', 'Article'), icon: 'newspaper', color: 'var(--series-3)', appliesTo: ['doc'], properties: [p('status', L('Stato', 'Status'), 'select', status), p('outlet', L('Testata', 'Outlet'), 'text'), p('deadline', L('Scadenza', 'Deadline'), 'date'), p('target', L('Parole obiettivo', 'Word target'), 'number')] },
    { id: 'character', name: L('Personaggio', 'Character'), icon: 'user', color: 'var(--series-4)', appliesTo: ['doc', 'resource'], properties: [p('role', L('Ruolo', 'Role'), 'text'), p('age', L('Età', 'Age'), 'text'), p('traits', L('Tratti', 'Traits'), 'multi', [])] },
    { id: 'place', name: L('Luogo', 'Place'), icon: 'map-pin', color: 'var(--series-5)', appliesTo: ['doc', 'resource'], properties: [p('region', L('Regione', 'Region'), 'text'), p('notes', L('Note', 'Notes'), 'text')] },
    { id: 'interview', name: L('Intervista', 'Interview'), icon: 'mic', color: 'var(--series-6)', appliesTo: ['doc', 'resource'], properties: [p('person', L('Persona', 'Person'), 'person'), p('date', L('Data', 'Date'), 'date'), p('consent', L('Consenso', 'Consent'), 'checkbox')] },
    { id: 'session', name: L('Sessione', 'Session'), icon: 'dices', color: 'var(--series-7)', appliesTo: ['doc'], properties: [p('date', L('Data', 'Date'), 'date'), p('players', L('Giocatori', 'Players'), 'multi', []), p('done', L('Giocata', 'Played'), 'checkbox')] },
    { id: 'journal', name: L('Voce di diario', 'Journal entry'), icon: 'notebook', color: 'var(--series-8)', appliesTo: ['doc'], properties: [p('date', L('Data', 'Date'), 'date'), p('mood', L('Umore', 'Mood'), 'select', it ? ['Sereno', 'Neutro', 'Inquieto', 'Euforico', 'Stanco'] : ['Calm', 'Neutral', 'Restless', 'Elated', 'Tired']), p('place', L('Luogo', 'Place'), 'text'), p('tags', 'Tag', 'multi', [])] },
  ];
}

function isPropKind(x: unknown): x is PropKind {
  return typeof x === 'string' && (PROP_KINDS as string[]).includes(x);
}

/** Legge il file dei tipi; senza file valgono quelli di partenza. */
export function normalizeTypes(raw: unknown, lang: 'it' | 'en' = 'it'): ObjectType[] {
  const list = (raw as Partial<TypesFile> | null)?.types;
  if (!Array.isArray(list)) return builtInTypes(lang);
  return list
    .filter((t): t is ObjectType => !!t && typeof t.id === 'string' && typeof t.name === 'string')
    .map((t) => ({
      id: t.id,
      name: t.name,
      icon: typeof t.icon === 'string' ? t.icon : 'file',
      color: typeof t.color === 'string' ? t.color : 'var(--series-1)',
      appliesTo: Array.isArray(t.appliesTo) && t.appliesTo.length ? t.appliesTo.filter((a) => a === 'doc' || a === 'resource') : ['doc'],
      properties: (Array.isArray(t.properties) ? t.properties : [])
        .filter((d) => d && typeof d.key === 'string' && isPropKind(d.kind))
        .map((d) => ({ key: d.key, label: typeof d.label === 'string' ? d.label : d.key, kind: d.kind, ...(Array.isArray(d.options) ? { options: d.options.map(String) } : {}) })),
    }));
}

export function normalizeObject(raw: unknown): ObjectData {
  const o = raw as Partial<ObjectData> | null;
  if (!o || typeof o !== 'object') return emptyObject();
  const props: Record<string, PropValue> = {};
  for (const [k, v] of Object.entries(o.props ?? {})) {
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) props[k] = v as PropValue;
    else if (Array.isArray(v)) props[k] = v.map(String);
  }
  return { type: typeof o.type === 'string' ? o.type : null, props };
}

export function typeById(types: ObjectType[], id: string | null | undefined): ObjectType | null {
  return (id && types.find((t) => t.id === id)) || null;
}

export function typesFor(types: ObjectType[], target: TypeTarget): ObjectType[] {
  return types.filter((t) => t.appliesTo.includes(target));
}

/** Chiave di proprietà nuova e unica a partire dall'etichetta. */
export function propKey(label: string, taken: string[]): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'prop';
  let k = base;
  for (let n = 2; taken.includes(k); n++) k = `${base}-${n}`;
  return k;
}

function isEmpty(v: PropValue | undefined): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Valore leggibile di una proprietà (per header, tabelle, export). */
export function formatProp(def: PropDef, v: PropValue | undefined, lang: 'it' | 'en' = 'it'): string {
  if (isEmpty(v)) return '';
  switch (def.kind) {
    case 'checkbox':
      return v ? (lang === 'it' ? 'Sì' : 'Yes') : lang === 'it' ? 'No' : 'No';
    case 'multi':
      return (Array.isArray(v) ? v : String(v).split(',')).map((x) => x.trim()).filter(Boolean).join(', ');
    case 'date': {
      const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return String(v);
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return d.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    default:
      return String(v);
  }
}

/** Valore da confrontare (ordinamento e filtri). */
export function sortValue(def: PropDef | undefined, v: PropValue | undefined): string | number {
  if (isEmpty(v)) return '';
  if (def?.kind === 'number') return Number(v) || 0;
  if (def?.kind === 'checkbox') return v ? 1 : 0;
  if (def?.kind === 'select' && def.options?.length) {
    const i = def.options.indexOf(String(v));
    return i >= 0 ? i : String(v);
  }
  return Array.isArray(v) ? v.join(', ').toLowerCase() : String(v).toLowerCase();
}

/** Converte il testo scritto dall'utente nel valore della proprietà. */
export function parsePropInput(def: PropDef, s: string): PropValue {
  const x = s.trim();
  if (!x) return null;
  if (def.kind === 'number') {
    const n = Number(x.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  if (def.kind === 'multi') return x.split(',').map((y) => y.trim()).filter(Boolean);
  if (def.kind === 'checkbox') return /^(1|true|si|sì|yes|x)$/i.test(x);
  return x;
}

/** Corrispondenza per i filtri degli Strata: "is", "not", "contains", "gte", "lte". */
export function matchProp(def: PropDef | undefined, v: PropValue | undefined, op: 'is' | 'not' | 'contains' | 'gte' | 'lte', want: string): boolean {
  const w = want.trim().toLowerCase();
  let r: boolean;
  if (op === 'gte' || op === 'lte') {
    if (isEmpty(v)) return false;
    const num = def ? def.kind === 'number' : !Number.isNaN(Number(v)) && want.trim() !== '' && !Number.isNaN(Number(want));
    const a = num ? Number(v) : String(v);
    const b = num ? Number(want) : want.trim();
    return op === 'gte' ? a >= b : a <= b;
  }
  const values = isEmpty(v) ? [] : Array.isArray(v) ? v.map((x) => x.toLowerCase()) : [String(typeof v === 'boolean' ? (v ? 'true' : 'false') : v).toLowerCase()];
  if (op === 'contains') r = values.some((x) => x.includes(w));
  else r = w === '' ? values.length === 0 : values.some((x) => x === w);
  return op === 'not' ? !r : r;
}

// ---------------------------------------------------------------- header del documento

export type HeaderLayout = 'line' | 'table' | 'block';

export interface HeaderSettings {
  /** dove mostrarlo: vista senza bordi, vista pagina, export */
  borderless: boolean;
  paged: boolean;
  export: boolean;
  /** campi in ordine: '@type', '@author', '@date' o la chiave di una proprietà; vuoto = tipo e tutte le proprietà */
  fields: string[];
  layout: HeaderLayout;
  align: 'left' | 'center';
}

export const defaultHeader = (): HeaderSettings => ({ borderless: true, paged: false, export: false, fields: [], layout: 'line', align: 'left' });

export function normalizeHeader(raw: unknown): HeaderSettings {
  const d = defaultHeader();
  const h = (raw ?? {}) as Partial<HeaderSettings>;
  return {
    borderless: typeof h.borderless === 'boolean' ? h.borderless : d.borderless,
    paged: typeof h.paged === 'boolean' ? h.paged : d.paged,
    export: typeof h.export === 'boolean' ? h.export : d.export,
    fields: Array.isArray(h.fields) ? h.fields.filter((f): f is string => typeof f === 'string') : d.fields,
    layout: h.layout === 'table' || h.layout === 'block' ? h.layout : 'line',
    align: h.align === 'center' ? 'center' : 'left',
  };
}

export interface HeaderRow {
  key: string;
  label: string;
  value: string;
}

/** Righe dell'header (etichetta e valore) nell'ordine scelto, senza i campi vuoti. */
export function headerRows(
  obj: ObjectData,
  type: ObjectType | null,
  header: HeaderSettings,
  meta: { author: string; date: string },
  labels: { type: string; author: string; date: string },
  lang: 'it' | 'en' = 'it',
): HeaderRow[] {
  const fields = header.fields.length ? header.fields : ['@type', ...(type?.properties.map((d) => d.key) ?? [])];
  const rows: HeaderRow[] = [];
  for (const f of fields) {
    if (f === '@type') {
      if (type) rows.push({ key: f, label: labels.type, value: type.name });
    } else if (f === '@author') {
      if (meta.author) rows.push({ key: f, label: labels.author, value: meta.author });
    } else if (f === '@date') {
      if (meta.date) rows.push({ key: f, label: labels.date, value: meta.date });
    } else {
      const def = type?.properties.find((d) => d.key === f);
      if (!def) continue;
      const value = formatProp(def, obj.props[f], lang);
      if (value) rows.push({ key: f, label: def.label, value });
    }
  }
  return rows;
}
