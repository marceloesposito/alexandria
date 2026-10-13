// Sezioni della colonna sinistra dello Scriptorium (scheda Armarium): ordine e sezioni nascoste
// scelti dall'utente, nelle preferenze dell'app. Le sezioni nuove (moduli aggiunti dopo) compaiono
// in fondo; quelle sconosciute nelle preferenze si ignorano.
export interface SectionLayout {
  order: string[];
  hidden: string[];
}

export const DEFAULT_SECTIONS: SectionLayout = { order: [], hidden: [] };

/** Tutte le sezioni nell'ordine scelto (anche le nascoste), partendo da quelle disponibili. */
export function orderedSections(available: string[], saved: SectionLayout | undefined): string[] {
  const order = (saved?.order ?? []).filter((id) => available.includes(id));
  return [...order, ...available.filter((id) => !order.includes(id))];
}

export function visibleSections(available: string[], saved: SectionLayout | undefined): string[] {
  const hidden = new Set(saved?.hidden ?? []);
  return orderedSections(available, saved).filter((id) => !hidden.has(id));
}

/** Sposta `id` nella posizione di `target` (trascinamento) o di un passo (frecce, `delta`). */
export function moveSection(available: string[], saved: SectionLayout | undefined, id: string, to: number): SectionLayout {
  const list = orderedSections(available, saved).filter((x) => x !== id);
  const at = Math.max(0, Math.min(list.length, to));
  list.splice(at, 0, id);
  return { order: list, hidden: [...(saved?.hidden ?? [])] };
}

export function toggleSection(saved: SectionLayout | undefined, id: string): SectionLayout {
  const hidden = saved?.hidden ?? [];
  return { order: [...(saved?.order ?? [])], hidden: hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id] };
}
