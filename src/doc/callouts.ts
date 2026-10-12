// Blocchi evidenziati (callout): riquadro con fondo chiaro, bordino, icona e intestazione.
// Nel Markdown la sintassi degli avvisi di GitHub/Obsidian: "> [!NOTE] Titolo" e poi il contenuto.
// Colore e icona scelti per il singolo riquadro vanno nei metadati alla Obsidian:
// "> [!NOTE|color=series-3 icon=book] Titolo". I tipi propri del Compendium (nome, colore, icona)
// stanno in `.alexandria/callouts.json` e nel Markdown si scrivono col loro id: "> [!definizione]".

/** Tipi predefiniti. `tip` e `warning` non si propongono piu' ma si leggono ancora (Markdown di GitHub). */
export const CALLOUT_KINDS = ['note', 'tip', 'important', 'warning', 'caution'] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];
/** Predefiniti proposti nei menu. */
export const CALLOUT_OFFERED: readonly CalloutKind[] = ['note', 'important', 'caution'];

export function isCalloutKind(x: unknown): x is CalloutKind {
  return (CALLOUT_KINDS as readonly unknown[]).includes(x);
}

/** Tavolozza: i colori della serie del tema (si adattano a chiaro e scuro). */
export const CALLOUT_COLORS = ['series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6', 'series-7', 'series-8'] as const;
export type CalloutColor = (typeof CALLOUT_COLORS)[number];

export function isCalloutColor(x: unknown): x is CalloutColor {
  return (CALLOUT_COLORS as readonly unknown[]).includes(x);
}

/** Icone a scelta (nomi; l'editor le disegna con lucide). */
export const CALLOUT_ICONS = [
  'info', 'lightbulb', 'star', 'triangle-alert', 'octagon-alert', 'book-open', 'bookmark', 'pencil',
  'quote', 'flag', 'circle-check', 'circle-help', 'target', 'flask-conical', 'graduation-cap', 'list',
  'link', 'calendar', 'user', 'message-square', 'eye', 'key', 'heart', 'sparkles',
] as const;
export type CalloutIcon = (typeof CALLOUT_ICONS)[number];

export function isCalloutIcon(x: unknown): x is CalloutIcon {
  return (CALLOUT_ICONS as readonly unknown[]).includes(x);
}

/** Aspetto dei tipi predefiniti. */
export const CALLOUT_BUILTIN: Record<CalloutKind, { color: CalloutColor; icon: CalloutIcon }> = {
  note: { color: 'series-2', icon: 'info' },
  tip: { color: 'series-3', icon: 'lightbulb' },
  important: { color: 'series-4', icon: 'star' },
  warning: { color: 'series-5', icon: 'triangle-alert' },
  caution: { color: 'series-7', icon: 'octagon-alert' },
};

/** Colori di stampa (tema chiaro): bordo e intestazione, e un fondo molto chiaro dello stesso colore. */
const PRINT: Record<CalloutColor, { stroke: string; fill: string }> = {
  'series-1': { stroke: '#8a4f2a', fill: '#f7f3f0' },
  'series-2': { stroke: '#3a6ea5', fill: '#f1f5fa' },
  'series-3': { stroke: '#3f7d4e', fill: '#f0f6f1' },
  'series-4': { stroke: '#8e4a8a', fill: '#f7f0f6' },
  'series-5': { stroke: '#a8741a', fill: '#fbf5ea' },
  'series-6': { stroke: '#2f8a87', fill: '#f0f7f7' },
  'series-7': { stroke: '#a83a2c', fill: '#faf0ee' },
  'series-8': { stroke: '#5b5f6b', fill: '#f4f4f5' },
};

export function calloutHex(color: CalloutColor): { stroke: string; fill: string } {
  return PRINT[color];
}

/** Tipo di riquadro creato dall'utente e salvato nel Compendium. */
export interface CalloutType {
  /** id nel Markdown ("[!definizione]"): minuscole, cifre e trattini */
  id: string;
  label: string;
  color: CalloutColor;
  icon: CalloutIcon;
}

/** Da un nome a un id libero: senza accenti, minuscolo, diverso dai predefiniti e dagli altri tipi. */
export function calloutTypeId(label: string, taken: readonly string[]): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'riquadro';
  const used = new Set<string>([...CALLOUT_KINDS, ...taken]);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Tipi validi da `callouts.json` (scarta quelli malformati, doppi o con l'id di un predefinito). */
export function normalizeCalloutTypes(raw: unknown): CalloutType[] {
  const list = (raw as { types?: unknown } | null)?.types;
  if (!Array.isArray(list)) return [];
  const out: CalloutType[] = [];
  for (const x of list as Partial<CalloutType>[]) {
    if (!x || typeof x.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(x.id)) continue;
    if (isCalloutKind(x.id) || out.some((o) => o.id === x.id)) continue;
    out.push({
      id: x.id,
      label: typeof x.label === 'string' && x.label.trim() ? x.label.trim() : x.id,
      color: isCalloutColor(x.color) ? x.color : 'series-2',
      icon: isCalloutIcon(x.icon) ? x.icon : 'info',
    });
  }
  return out;
}

export interface CalloutMarker {
  kind: string;
  title: string;
  /** colore e icona scelti per questo riquadro ('' = quelli del tipo) */
  color: string;
  icon: string;
}

/** Riga d'apertura: "[!NOTE]" o "[!tipo|color=... icon=...]" con un titolo facoltativo dopo. */
export function parseCalloutMarker(line: string): CalloutMarker | null {
  const m = /^\[!([A-Za-z0-9][\w-]*)(?:\|([^\]]*))?\][ \t]*(.*)$/.exec(line.trim());
  if (!m) return null;
  let color = '';
  let icon = '';
  for (const part of (m[2] ?? '').split(/[\s,;]+/)) {
    const [k, v] = part.split('=');
    if (k === 'color' && isCalloutColor(v)) color = v;
    if (k === 'icon' && isCalloutIcon(v)) icon = v;
  }
  return { kind: m[1].toLowerCase(), title: m[3].trim(), color, icon };
}

export function calloutMarker(kind: string, title: string, color = '', icon = ''): string {
  const t = title.replace(/\s+/g, ' ').trim();
  const k = isCalloutKind(kind) ? kind.toUpperCase() : kind;
  const meta = [isCalloutColor(color) ? `color=${color}` : '', isCalloutIcon(icon) ? `icon=${icon}` : ''].filter(Boolean).join(' ');
  return `[!${k}${meta ? '|' + meta : ''}]${t ? ' ' + t : ''}`;
}

/** Id del tipo dagli attributi del nodo: un id valido, altrimenti la nota. */
export function calloutKindOf(kind: unknown): string {
  return typeof kind === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(kind) ? kind : 'note';
}

export interface ResolvedCallout {
  kind: string;
  /** nome del tipo (predefinito nella lingua del documento, proprio, o l'id con la maiuscola) */
  label: string;
  /** intestazione: il titolo scelto, altrimenti il nome del tipo */
  heading: string;
  color: CalloutColor;
  icon: CalloutIcon;
}

/**
 * Aspetto finale di un riquadro: colore e icona scelti per lui, altrimenti quelli del tipo (proprio o
 * predefinito); un tipo sconosciuto (es. un "[!quote]" di Obsidian) ha l'aspetto della nota.
 */
export function resolveCallout(
  attrs: { kind?: unknown; title?: unknown; color?: unknown; icon?: unknown } | undefined,
  types: readonly CalloutType[],
  labels: Record<CalloutKind, string>,
): ResolvedCallout {
  const kind = calloutKindOf(attrs?.kind);
  const own = types.find((x) => x.id === kind);
  const base = own ?? (isCalloutKind(kind) ? CALLOUT_BUILTIN[kind] : CALLOUT_BUILTIN.note);
  const label = own?.label ?? (isCalloutKind(kind) ? labels[kind] : kind.charAt(0).toUpperCase() + kind.slice(1).replace(/-/g, ' '));
  const title = String(attrs?.title ?? '').trim();
  return {
    kind,
    label,
    heading: title || label,
    color: isCalloutColor(attrs?.color) ? attrs.color : base.color,
    icon: isCalloutIcon(attrs?.icon) ? attrs.icon : base.icon,
  };
}
