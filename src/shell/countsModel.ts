// Conteggi dell'etichetta flottante: quali restano sempre in vista quando e' chiusa (scelta dell'utente,
// nelle preferenze dell'app). L'ordine e' sempre quello della lista, qualunque sia l'ordine dei clic.
export const COUNT_KINDS = ['words', 'chars', 'charsNoSpaces', 'cartelle', 'pages', 'reading'] as const;

export type CountKind = (typeof COUNT_KINDS)[number];

export const DEFAULT_COUNTS_SHOWN: CountKind[] = ['words', 'pages'];

/** Valore letto dallo stato salvato: voci sconosciute scartate, ordine della lista. */
export function normalizeShown(v: unknown): CountKind[] {
  if (!Array.isArray(v)) return [...DEFAULT_COUNTS_SHOWN];
  return COUNT_KINDS.filter((k) => v.includes(k));
}

export function toggleShown(shown: readonly CountKind[], kind: CountKind): CountKind[] {
  const on = shown.includes(kind);
  return COUNT_KINDS.filter((k) => (k === kind ? !on : shown.includes(k)));
}
