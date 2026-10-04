// Ponte fra editor e motore delle citazioni: l'editor chiede l'etichetta di una citazione,
// il motore (citations/engine.ts) la fornisce secondo lo stile del documento.
import { useSyncExternalStore } from 'react';
import type { CitationItem } from '../doc/types';

export interface CitationRenderer {
  /** Testo della citazione nel corpo, es. "(Rossi, 2020, p. 12)" oppure "[3]" */
  label(items: CitationItem[]): string;
  /** Lo stile usa note a pie' di pagina (es. Chicago note) */
  isNoteStyle(): boolean;
  /** Titolo leggibile della fonte, per il tooltip */
  describe(key: string): string | null;
}

const fallback: CitationRenderer = {
  label: (items) =>
    '(' +
    items
      .map((i) => [i.prefix, i.key, i.locator, i.suffix].filter(Boolean).join(' '))
      .join('; ') +
    ')',
  isNoteStyle: () => false,
  describe: () => null,
};

let current: CitationRenderer = fallback;
let tick = 0;
const listeners = new Set<() => void>();

export function setCitationRenderer(r: CitationRenderer | null) {
  current = r ?? fallback;
  tick++;
  listeners.forEach((l) => l());
}

export function citationRenderer(): CitationRenderer {
  return current;
}

/** Hook: si ri-disegna quando cambia stile o bibliografia. */
export function useCitationTick(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => tick,
  );
}
