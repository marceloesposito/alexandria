// Blocchi evidenziati (callout): riquadro con fondo chiaro, bordino, icona e intestazione.
// Nel Markdown la sintassi degli avvisi di GitHub/Obsidian: "> [!NOTE] Titolo" e poi il contenuto.

export const CALLOUT_KINDS = ['note', 'tip', 'important', 'warning', 'caution'] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export function isCalloutKind(x: unknown): x is CalloutKind {
  return (CALLOUT_KINDS as readonly unknown[]).includes(x);
}

/** Riga d'apertura: "[!NOTE]" con un titolo facoltativo dopo. */
export function parseCalloutMarker(line: string): { kind: CalloutKind; title: string } | null {
  const m = /^\[!(\w+)\][ \t]*(.*)$/.exec(line.trim());
  if (!m) return null;
  const kind = m[1].toLowerCase();
  return isCalloutKind(kind) ? { kind, title: m[2].trim() } : null;
}

export function calloutMarker(kind: CalloutKind, title: string): string {
  const t = title.replace(/\s+/g, ' ').trim();
  return `[!${kind.toUpperCase()}]${t ? ' ' + t : ''}`;
}

/** Colori di stampa: bordo e intestazione (i colori della serie del tema chiaro) e fondo molto chiaro. */
export const CALLOUT_HEX: Record<CalloutKind, { stroke: string; fill: string }> = {
  note: { stroke: '#3a6ea5', fill: '#f1f5fa' },
  tip: { stroke: '#3f7d4e', fill: '#f0f6f1' },
  important: { stroke: '#8e4a8a', fill: '#f7f0f6' },
  warning: { stroke: '#a8741a', fill: '#fbf5ea' },
  caution: { stroke: '#a83a2c', fill: '#faf0ee' },
};

/** Intestazione del riquadro: il titolo scelto, altrimenti il nome del tipo nella lingua del documento. */
export function calloutHeading(kind: unknown, title: unknown, labels: Record<CalloutKind, string>): { kind: CalloutKind; heading: string } {
  const k = isCalloutKind(kind) ? kind : 'note';
  const t = String(title ?? '').trim();
  return { kind: k, heading: t || labels[k] };
}
