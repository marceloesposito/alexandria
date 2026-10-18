// Picus: alternative in sezioni per tono (Formale >= +1, Neutro 0, Informale <= -1). Dentro una
// sezione prima le meno usate di recente nel documento, poi l'ordine del dizionario. La scala
// interna resta -2..+2, cosi' le soglie delle sezioni possono cambiare.

export type Tone = 'formal' | 'neutral' | 'casual';
export const TONES: Tone[] = ['formal', 'neutral', 'casual'];

export const toneOf = (register: number): Tone => (register >= 1 ? 'formal' : register <= -1 ? 'casual' : 'neutral');

/** registro "centrale" del tono di un documento */
export const toneCenter = (t: Tone): number => (t === 'formal' ? 1 : t === 'casual' ? -1 : 0);

export interface Ranked<T> {
  tone: Tone;
  open: boolean;
  items: T[];
}

/**
 * Sezioni non vuote. `lastUse`: ultima posizione nel documento di ogni testo (assente: mai usato);
 * con un tono di destinazione la sua sezione viene prima ed e' aperta, le altre chiuse.
 */
export function rank<T extends { base: string; register: number }>(items: T[], lastUse: Map<string, number>, target: Tone | null): Ranked<T>[] {
  const order = new Map(items.map((it, i) => [it, i]));
  const key = (it: T) => lastUse.get(it.base) ?? -Infinity;
  const sorted = [...items].sort((a, b) => key(a) - key(b) || order.get(a)! - order.get(b)!);
  const tones = target ? [target, ...TONES.filter((t) => t !== target)] : TONES;
  return tones
    .map((tone) => ({ tone, open: !target || tone === target, items: sorted.filter((it) => toneOf(it.register) === tone) }))
    .filter((s) => s.items.length > 0);
}
