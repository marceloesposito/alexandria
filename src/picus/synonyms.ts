// Picus: sinonimi dal thesaurus offline (MyThes di LibreOffice, italiano e inglese) per la parola o
// la locuzione sotto il cursore, flessi come nel testo: "looked" -> "appeared", "carried out" ->
// "executed", "cities" -> "towns". Funzioni pure: il blocco grezzo del thesaurus lo legge il Rust.
import { parseEntry, baseForms, inflectLike, matchCase, type Entry } from '../thesaurus/model';
import { cliticWords, type Engine, type Finding, type Suggestion } from './analyze';
import { tokenize, type Token } from './tokens';

/** Una sequenza di parole del testo con le chiavi da cercare nel thesaurus, nell'ordine. */
export interface Probe {
  start: number;
  /** escluso */
  end: number;
  keys: { key: string; lemma: { base: string; slot: string } | null }[];
}

/** Forme base candidate di una parola: quelle del thesaurus e, per l'italiano, dallo stemmer. */
function guesses(e: Engine, word: string, lang: 'it' | 'en'): string[] {
  const out = baseForms(word, lang);
  if (lang === 'it') {
    const s = e.stem(word);
    for (const end of ['are', 'ere', 'ire', 'iare']) out.push(s + end);
  }
  return out;
}

/** Chiavi per una parola: la parola, poi le sue forme base (con lo slot se e' una forma verbale). */
export function wordKeys(e: Engine, word: string, lang: 'it' | 'en'): Probe['keys'] {
  const keys: Probe['keys'] = [{ key: word, lemma: null }];
  const add = (key: string, lemma: Probe['keys'][number]['lemma']) => !keys.some((k) => k.key === key) && keys.push({ key, lemma });
  for (const l of e.morph.lemmas(word, guesses(e, word, lang))) if (l.base !== word) add(l.base, l);
  for (const b of baseForms(word, lang)) add(b, null);
  return keys;
}

/**
 * Sequenze attorno alla parola `at` (indice di token), dalla piu' lunga (4 parole) alla parola sola;
 * nelle locuzioni il primo verbo torna alla forma base ("carried out" -> "carry out").
 */
export function probes(e: Engine, tokens: Token[], at: number, lang: 'it' | 'en', max = 4): Probe[] {
  const out: Probe[] = [];
  for (let len = Math.min(max, tokens.length); len >= 1; len--) {
    for (let s = Math.max(0, at - len + 1); s <= at && s + len <= tokens.length; s++) {
      const span = tokens.slice(s, s + len);
      if (span.slice(1).some((t) => t.brk)) continue;
      const words = span.map((t) => t.w);
      if (len === 1) {
        out.push({ start: s, end: s + 1, keys: wordKeys(e, words[0], lang) });
        continue;
      }
      // non si cerca una sequenza che comincia o finisce con una parola vuota ("the", "di")
      if (e.pack.stopwords.has(words[0]) && !e.morph.isVerb(words[0])) continue;
      if (e.pack.stopwords.has(words[len - 1]) && len > 2) continue;
      const keys: Probe['keys'] = [{ key: joinWords(words), lemma: null }];
      for (const l of e.morph.lemmas(words[0], guesses(e, words[0], lang))) {
        const key = joinWords([l.base, ...words.slice(1)]);
        if (!keys.some((k) => k.key === key)) keys.push({ key, lemma: l });
      }
      out.push({ start: s, end: s + len, keys });
    }
  }
  return out;
}

const joinWords = (ws: string[]) => ws.join(' ').replace(/' /g, "'");

const isVerbPos = (pos: string) => /^v|verb/i.test(pos);

/** Il sinonimo nella forma dell'originale. */
function inflect(e: Engine, syn: string, original: string, base: string, lemma: Probe['keys'][number]['lemma'], lang: 'it' | 'en'): string {
  const words = syn.split(' ');
  if (lemma) {
    const head = words[0].toLowerCase();
    const i = e.morph.slots.indexOf(lemma.slot);
    // riflessivo ("aspettarsi"): il clitico va prima del verbo finito ("ci aspettiamo")
    const split = e.morph.formsAny(head) ? null : e.morph.splitClitic(head);
    const f = e.morph.formsAny(split?.verb ?? head);
    if (f && f[i]) {
      const person = e.morph.personOf(lemma.slot);
      if (!split) words[0] = f[i];
      else if (lemma.slot === 'inf' || lemma.slot === 'ger') words[0] = e.morph.attach(f[i], lemma.slot, cliticWords(e, split.clitic, 3).join(''));
      else if (person && !lemma.slot.startsWith('pp')) words.splice(0, 1, ...cliticWords(e, split.clitic, person), f[i]);
    }
  } else if (base !== original.toLowerCase()) {
    return inflectLike(original.toLowerCase(), base, syn, lang);
  }
  return words.join(' ');
}

const MAX_MEANINGS = 6;
const MAX_TERMS = 12;

/**
 * Rilievo "sinonimi" per il tratto [start, end) del testo. `entry` e' la voce del thesaurus trovata
 * con la chiave `key`; `lemma` dice in che forma era il verbo (null: la parola com'e').
 */
export function synonymFinding(e: Engine, text: string, start: number, end: number, key: string, entry: Entry, lemma: Probe['keys'][number]['lemma'], lang: 'it' | 'en'): Finding | null {
  const original = text.slice(start, end);
  let meanings = entry.meanings.filter((m) => m.synonyms.length || m.related.length);
  // una forma verbale ("looked", "abbiamo cercato"): solo i significati da verbo, se ci sono
  if (lemma && lemma.slot !== e.morph.base && meanings.some((m) => isVerbPos(m.pos))) {
    const verbal = meanings.filter((m) => isVerbPos(m.pos));
    // in inglese la forma in -s vale anche per i plurali dei nomi
    if (!(lang === 'en' && lemma.slot === '3sg')) meanings = verbal;
  }
  meanings = meanings.slice(0, MAX_MEANINGS);
  if (!meanings.length) return null;
  const seen = new Set<string>();
  const senses = meanings
    .map((m) => {
      const items: Suggestion[] = [];
      // WordNet mette fra i sinonimi di "look" anche "look back", "look after": non lo sono
      const single = !key.includes(' ');
      const usable = (terms: readonly string[]) => {
        const ok = terms.filter((t) => !t.toLowerCase().startsWith(`${key} `));
        // per una parola sola prima i sinonimi di una parola
        return single ? [...ok.filter((t) => !t.includes(' ')), ...ok.filter((t) => t.includes(' '))] : ok;
      };
      for (const [terms, related] of [
        [usable(m.synonyms), false],
        [usable(m.related), true],
      ] as const) {
        for (const t of terms) {
          if (items.length >= MAX_TERMS) break;
          const s = matchCase(original, inflect(e, t, original, key, lemma, lang));
          if (seen.has(s.toLowerCase()) || s.toLowerCase() === original.toLowerCase()) continue;
          seen.add(s.toLowerCase());
          const it: Suggestion = { text: s, base: t, register: 0, flags: 0 };
          if (related) it.related = true;
          items.push(it);
        }
      }
      return { sense: m.pos, sections: [{ tone: 'neutral' as const, open: true, items }] };
    })
    .filter((s) => s.sections[0].items.length);
  if (!senses.length) return null;
  return { kind: 'synonym', tags: ['synonym'], start, end, original, base: key, register: null, senses, key: `synonym:${key}`, category: 'synonym', source: 'thesaurus' };
}

/** Voce del thesaurus da un blocco grezzo (null se vuoto). */
export const entryOf = (raw: string | null): Entry | null => (raw ? parseEntry(raw) : null);

/** Blocco grezzo del thesaurus per una chiave (dalla piattaforma: il Rust o il server di sviluppo). */
export type Lookup = (key: string) => Promise<string | null>;

/**
 * Sinonimi per il punto chiesto nel testo di un blocco: con `to` null la parola (o la locuzione piu'
 * lunga che il thesaurus conosce) attorno all'offset `from`; altrimenti esattamente il tratto
 * selezionato [from, to).
 */
export async function synonymsAt(e: Engine, text: string, lang: 'it' | 'en', lookup: Lookup, from: number, to: number | null): Promise<Finding | null> {
  const tokens = tokenize(text, e.pack.elision);
  let list: Probe[];
  if (to === null) {
    const at = tokens.findIndex((t) => from >= t.start && from <= t.end);
    if (at < 0) return null;
    list = probes(e, tokens, at, lang);
  } else {
    const s = tokens.findIndex((t) => t.end > from);
    let end = tokens.findIndex((t) => t.start >= to);
    if (end < 0) end = tokens.length;
    if (s < 0 || end <= s) return null;
    list = probes(e, tokens, s, lang, end - s).filter((p) => p.start === s && p.end === end);
  }
  for (const p of list) {
    for (const k of p.keys) {
      const entry = entryOf(await lookup(k.key));
      if (!entry) continue;
      const f = synonymFinding(e, text, tokens[p.start].start, tokens[p.end - 1].end, k.key, entry, k.lemma, lang);
      if (f) return f;
    }
  }
  return null;
}
