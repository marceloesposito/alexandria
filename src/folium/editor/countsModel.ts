// Contatore della barretta: l'autore sceglie cosa vedere (parole, battute, pagine...). Funzioni pure.
import type { Counts } from 'logos/doc/counts';

export const COUNT_KEYS = ['words', 'chars', 'charsNoSpaces', 'pages', 'cartelle', 'reading'] as const;
export type CountKey = (typeof COUNT_KEYS)[number];

export const DEFAULT_SHOWN: CountKey[] = ['words'];

export function normalizeShown(raw: unknown): CountKey[] {
  if (!Array.isArray(raw)) return DEFAULT_SHOWN;
  const keys = COUNT_KEYS.filter((k) => raw.includes(k));
  return keys.length ? keys : DEFAULT_SHOWN;
}

/** Accende o spegne un conteggio; almeno uno resta sempre acceso. */
export function toggleShown(shown: CountKey[], k: CountKey): CountKey[] {
  const next = shown.includes(k) ? shown.filter((x) => x !== k) : [...shown, k];
  return next.length ? COUNT_KEYS.filter((x) => next.includes(x)) : shown;
}

/** Valore di un conteggio; le pagine vere (dai confini disegnati) vincono sulla stima. */
export function countValue(c: Counts | null, k: CountKey, pages: number | null): number {
  if (!c) return 0;
  switch (k) {
    case 'words':
      return c.words;
    case 'chars':
      return c.chars;
    case 'charsNoSpaces':
      return c.charsNoSpaces;
    case 'pages':
      return pages ?? c.pages;
    case 'cartelle':
      return c.cartelle;
    case 'reading':
      return c.readingMinutes;
  }
}

/** Etichetta del contatore: "1.234 parole · 3 pagine". `unit(k, n)` da' la parola giusta. */
export function countsLabel(c: Counts | null, shown: CountKey[], pages: number | null, unit: (k: CountKey, n: number) => string, locale?: string): string {
  return shown.map((k) => {
    const n = countValue(c, k, pages);
    return `${k === 'cartelle' ? n.toLocaleString(locale, { maximumFractionDigits: 1 }) : n.toLocaleString(locale)} ${unit(k, n)}`;
  }).join(' · ');
}
