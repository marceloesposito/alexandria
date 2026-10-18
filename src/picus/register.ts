// Picus: stima del registro (-2 gergale .. +2 molto formale) delle parole che il dizionario non
// conosce, con un'euristica deterministica dai dati del pacchetto (@register): parole marcate,
// suffissi dotti (-zione, -tion, -ita'), particelle dei verbi frasali (give up, tirare fuori),
// lunghezza in sillabe e polisemia nel thesaurus (tanti significati = parola comune, verso il neutro).
import type { Pack } from './pack';

function syllables(w: string, vowels: string): number {
  let n = 0;
  for (let i = 0; i < w.length; i++) if (vowels.includes(w[i]) && (i === 0 || !vowels.includes(w[i - 1]))) n++;
  return Math.max(1, n);
}

/** Registro di una parola sola; `meanings` e' quanti significati ha nel thesaurus (se lo si sa). */
export function wordRegister(pack: Pack, word: string, meanings?: number): number {
  const r = pack.register;
  const w = word.toLowerCase();
  const marked = r.word.get(w);
  if (marked !== undefined) return marked;
  let score = 0;
  let suffix = '';
  for (const s of r.suffix.keys()) if (w.endsWith(s) && s.length > suffix.length && w.length > s.length + 2) suffix = s;
  if (suffix) score += r.suffix.get(suffix)!;
  const syl = syllables(w, pack.vowels);
  if (r.long && syl >= r.long[0]) score += r.long[1];
  if (r.short && syl <= r.short[0]) score += r.short[1];
  if (r.poly && meanings !== undefined && meanings >= r.poly[0]) score += r.poly[1];
  return clamp(score);
}

const clamp = (n: number) => Math.max(-2, Math.min(2, Math.round(n * 2) / 2));

/**
 * Registro di una parola o di una locuzione. Un verbo seguito da una particella ("give up",
 * "tirare fuori") scende; per le altre locuzioni vale la parola che si allontana di piu' dal neutro.
 */
export function phraseRegister(pack: Pack, text: string, meanings?: number): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  if (words.length === 1) return wordRegister(pack, words[0], meanings);
  const marked = pack.register.word.get(words.join(' '));
  if (marked !== undefined) return marked;
  if (words.length <= 3 && pack.register.particles.has(words[words.length - 1])) return clamp(pack.register.particle);
  const scores = words.filter((w) => !pack.stopwords.has(w)).map((w) => wordRegister(pack, w));
  if (!scores.length) return 0;
  return scores.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
}
