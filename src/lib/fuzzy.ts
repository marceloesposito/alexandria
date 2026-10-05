// Ricerca approssimata per il Quick switcher: le lettere della domanda vanno trovate in ordine nel
// testo; premia lettere consecutive, inizi di parola e testi brevi. Funzione pura.

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Punteggio (più alto = meglio) o null se la domanda non compare nel testo. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = norm(query.trim());
  if (!q) return 0;
  const s = norm(text);
  // corrispondenza esatta di una sottostringa: vince sempre sulle lettere sparse
  const at = s.indexOf(q);
  if (at >= 0) return 1000 - at - s.length / 100 + (at === 0 || /[\s/_.-]/.test(s[at - 1]) ? 50 : 0);
  let score = 0;
  let prev = -2;
  let i = 0;
  for (let j = 0; j < s.length && i < q.length; j++) {
    if (s[j] !== q[i]) continue;
    score += 10;
    if (j === prev + 1) score += 15;
    if (j === 0 || /[\s/_.-]/.test(s[j - 1])) score += 20;
    prev = j;
    i++;
  }
  if (i < q.length) return null;
  return score - s.length / 100;
}

/** Filtra e ordina gli elementi per punteggio; a parità resta l'ordine di partenza. */
export function fuzzyFilter<T>(items: T[], query: string, text: (x: T) => string, limit = 50): T[] {
  if (!query.trim()) return items.slice(0, limit);
  return items
    .map((x, i) => ({ x, i, s: fuzzyScore(query, text(x)) }))
    .filter((r): r is { x: T; i: number; s: number } => r.s !== null)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((r) => r.x);
}
