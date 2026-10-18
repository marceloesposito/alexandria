// Quando fare una versione automatica del foglio: dopo una pausa nella scrittura, se il testo e'
// cambiato abbastanza dall'ultima versione; alla chiusura basta un cambiamento qualsiasi.

export const PAUSE_MS = 90_000;
export const MIN_CHANGE = 40;

/** Caratteri cambiati fra due testi (parte diversa fra prefisso e suffisso comuni, la piu' lunga). */
export function changedChars(a: string, b: string): number {
  if (a === b) return 0;
  let p = 0;
  const max = Math.min(a.length, b.length);
  while (p < max && a[p] === b[p]) p++;
  let s = 0;
  while (s < max - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return Math.max(a.length - p - s, b.length - p - s);
}

export function shouldSnapshot(opts: { last: string | null; text: string; lastEdit: number; now: number; closing?: boolean }): boolean {
  const { last, text, lastEdit, now, closing } = opts;
  // il foglio vuoto mai scritto non ha storia
  if (last === null) return text.trim().length > 0 && (closing || now - lastEdit >= PAUSE_MS);
  const changed = changedChars(last, text);
  if (closing) return changed > 0;
  return changed >= MIN_CHANGE && now - lastEdit >= PAUSE_MS;
}
