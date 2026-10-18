// Picus: punto d'ingresso del motore, caricato in modo pigro (import('./engine')) quando l'editor e'
// pronto, cosi' l'avvio dell'app non paga nulla e la prima domanda e' gia' istantanea. Il pacchetto
// inglese e' incluso; gli altri arrivano come testo dalla piattaforma (risorse o cartella utente).
import EN from './packs/en.picus?raw';
import { createEngine, type Engine } from './analyze';

export { analyze, usage, type Engine, type Finding, type Suggestion, type SenseSuggestions, type FindingKind, type AnalyzeOptions } from './analyze';
export { TONES, toneOf, type Tone } from './rank';
export { PackError } from './pack';

const cache = new Map<string, Engine>();

/** Lingua del pacchetto incluso nell'app. */
export const BUILTIN = 'en';

/** Motore per una lingua: l'inglese incluso, le altre dal testo del pacchetto (una volta sola). */
export function engineFor(lang: string, src?: string | null): Engine | null {
  const hit = cache.get(lang);
  if (hit) return hit;
  const text = lang === BUILTIN ? EN : src;
  if (!text) return null;
  const e = createEngine(text);
  if (e.pack.lang !== lang) throw new Error(`pacchetto "${e.pack.lang}" al posto di "${lang}"`);
  cache.set(lang, e);
  return e;
}

/** Dopo l'installazione o la rimozione di un pacchetto. */
export function forgetEngine(lang: string) {
  if (lang !== BUILTIN) cache.delete(lang);
}
