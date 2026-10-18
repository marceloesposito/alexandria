// Picus: riscrittura deterministica di un tratto qualunque in tre toni (Formale, Neutro, Informale).
// Niente modelli linguistici: si sostituiscono le unita' che si sanno cambiare, ognuna con alternative
// di registro noto o stimato, e si compone una versione per tono.
// 1. unita' del dizionario del pacchetto (locuzioni, giri di parole, contrazioni, riempitivi), gia'
//    flesse e accordate da `realize`;
// 2. parole piene (e locuzioni del thesaurus): sinonimi del significato scelto con Lesk, flessi come
//    nel testo; per i nomi italiani genere, numero e articolo che precede si accordano;
// 3. per ogni tono, unita' per unita', l'alternativa col registro piu' vicino al tono (l'originale
//    resta se e' gia' nel tono giusto: si cambia solo cio' che stona).
import { tokenize, type Token } from './tokens';
import { findMatches } from './match';
import { realize, resolveMatch, type Engine } from './analyze';
import { matchCase, type Entry } from '../thesaurus/model';
import { chooseMeaning, entryOf, inflect, isNounPos, isVerbPos, probes, type Probe } from './synonyms';
import { phraseRegister } from './register';
import { TONES, toneCenter, toneOf, type Tone } from './rank';
import { determiner, joinArticle, type Det } from './article';
import { genderOf, pluralOf } from './nouns';

export interface Option {
  text: string;
  base: string;
  register: number;
  source: 'pack' | 'thesaurus';
  /** abbastanza sicura da metterla da sola in una versione (il significato e' quello giusto) */
  sure: boolean;
  flags: number;
  note?: string;
  /** la sostituzione arriva fino a qui (articolo che segue inghiottito) */
  to?: number;
}

export interface Unit {
  start: number;
  end: number;
  original: string;
  register: number;
  /** l'originale puo' restare (no per i giri di parole e le ridondanze) */
  keep: boolean;
  /** senso del dizionario, motivo (@replace) o categoria del thesaurus */
  label: string;
  options: Option[];
}

/** Una modifica al testo originale: [start, end) diventa `text`. */
export interface Edit {
  start: number;
  end: number;
  text: string;
}

export interface Version {
  tone: Tone;
  text: string;
  /** tratti cambiati, nelle posizioni del testo della versione */
  changes: { start: number; end: number }[];
  /** le modifiche da fare al testo originale per ottenerla */
  edits: Edit[];
}

export interface Rewrite {
  start: number;
  end: number;
  original: string;
  units: Unit[];
  versions: Version[];
}

/** Blocchi grezzi del thesaurus per piu' chiavi in una volta (null: non c'e'). */
export type LookupMany = (keys: string[]) => Promise<Map<string, string | null>>;

const WINDOW = 12;
const MAX_OPTIONS = 8;

const isContent = (e: Engine, t: Token, text: string) => {
  if (t.w.length < 3 || !/^\p{L}[\p{L}'-]*$/u.test(t.w) || e.pack.stopwords.has(t.w) || e.lex.aux.has(t.w) || e.lex.modal.has(t.w)) return false;
  // nomi propri a meta' frase
  const ch = text[t.start];
  return t.sent || ch === ch.toLowerCase();
};

/** Unita' del dizionario del pacchetto nel tratto [from, to). */
function packUnits(e: Engine, text: string, tokens: Token[], from: number, to: number, covered: Set<number>): Unit[] {
  const out: Unit[] = [];
  for (const m of findMatches(e.lex, tokens)) {
    const reading = resolveMatch(e, text, tokens, m);
    if (!reading) continue;
    const start = tokens[reading.start].start;
    const end = tokens[m.end - 1].end;
    if (start < from || end > to) continue;
    const original = text.slice(start, end);
    const options: Option[] = [];
    let keep = true;
    let register = 0;
    let label = '';
    for (const r of reading.resolved) {
      const entry = e.lex.entries[r.hit.vi];
      const variants = entry.sense >= 0 ? e.pack.senses[entry.sense].variants.filter((v) => v !== entry.variant) : e.pack.replaces[entry.replace].to;
      if (entry.sense >= 0) {
        if (!label) ({ register } = entry.variant);
        label ||= e.pack.senses[entry.sense].name;
      } else {
        const rep = e.pack.replaces[entry.replace];
        // un giro di parole non resta in nessun tono; un'espressione solo ampollosa resta nel formale
        if (rep.reason !== 'pompous') keep = false;
        register = rep.from.register;
        label = rep.reason;
      }
      for (const v of variants) {
        const r2 = realize(e, v, r.ctx);
        if (options.some((o) => o.text.toLowerCase() === r2.text.toLowerCase())) continue;
        const o: Option = { text: r2.text ? matchCase(original, r2.text) : '', base: v.text, register: v.register, source: 'pack', sure: true, flags: v.flags };
        if (v.note) o.note = v.note;
        if (r2.to !== undefined) o.to = r2.to;
        options.push(o);
      }
    }
    if (!options.length) continue;
    // "prendere una decisione rapida" -> "decidere rapida": se dopo un giro di parole viene una parola
    // piena che lo modifica, la sostituzione resta solo una proposta e non entra nelle versioni
    const next = tokens[m.end];
    if (!keep && next && !next.brk && isContent(e, next, text) && isContent(e, tokens[m.end - 1], text)) {
      keep = true;
      options.forEach((o) => (o.sure = false));
    }
    for (let k = reading.start; k < m.end; k++) covered.add(k);
    out.push({ start, end, original, register, keep, label, options });
  }
  return out;
}

/** Unita' dal thesaurus per le parole piene che il dizionario non copre. */
async function thesaurusUnits(e: Engine, text: string, tokens: Token[], from: number, to: number, covered: Set<number>, lang: 'it' | 'en', lookupMany: LookupMany): Promise<Unit[]> {
  const inSpan = (i: number) => tokens[i].start >= from && tokens[i].end <= to;
  // sequenze che cominciano con ogni parola piena libera (le piu' lunghe prima: "carry out")
  const byToken = new Map<number, Probe[]>();
  for (let i = 0; i < tokens.length; i++) {
    if (!inSpan(i) || covered.has(i) || !isContent(e, tokens[i], text)) continue;
    const list = probes(e, tokens, i, lang, 3).filter((p) => p.start === i && p.end - 1 < tokens.length && [...Array(p.end - p.start).keys()].every((k) => inSpan(i + k) && !covered.has(i + k)));
    if (list.length) byToken.set(i, list);
  }
  const keys = [...new Set([...byToken.values()].flatMap((ps) => ps.flatMap((p) => p.keys.map((k) => k.key))))];
  const found = await lookupMany(keys);
  // radici del contesto per Lesk
  const stems = tokens.map((t) => (isContent(e, t, text) ? e.stem(t.w) : ''));
  const out: Unit[] = [];
  const nounChecks: { option: Option; unit: Unit; plural: boolean; det: Det | null; detText: string | null }[] = [];
  for (const [i, list] of byToken) {
    if (covered.has(i)) continue;
    let made = false;
    for (const p of list) {
      for (const k of p.keys) {
        const entry = entryOf(found.get(k.key) ?? null);
        if (!entry) continue;
        const unit = thesaurusUnit(e, text, tokens, p, k, entry, stems, lang, nounChecks);
        if (!unit) continue;
        for (let j = p.start; j < p.end; j++) covered.add(j);
        out.push(unit);
        made = true;
        break;
      }
      if (made) break;
    }
  }
  // seconda lettura per i candidati di una parola: polisemia per il registro (se il pacchetto la usa)
  // e categoria dei nomi italiani con genere incerto (-e)
  const poly = !!e.pack.register.poly;
  const bases = [...new Set(out.flatMap((u) => u.options.filter((o) => !o.base.includes(' ')).map((o) => o.base)))];
  const more = bases.length && (poly || nounChecks.length) ? await lookupMany(bases) : new Map<string, string | null>();
  if (poly) {
    for (const u of out) {
      for (const o of u.options) {
        const en = entryOf(more.get(o.base) ?? null);
        if (en) o.register = phraseRegister(e.pack, o.base, en.meanings.length);
      }
    }
  }
  if (nounChecks.length) {
    for (const c of nounChecks) {
      const pos = entryOf(more.get(c.option.base) ?? null)?.meanings.find((m) => isNounPos(m.pos))?.pos;
      const g = genderOf(e.pack, c.option.base, pos);
      let word = c.option.base;
      if (c.plural) word = pluralOf(e.pack, word, g) ?? word;
      const art = c.det && g ? determiner(e.pack, c.det, `${g}${c.plural ? 'p' : 's'}`, word) : null;
      if (art) word = joinArticle(art, word);
      else if (c.det) {
        // genere ignoto: l'articolo resta quello del testo e l'alternativa non entra da sola in una versione
        c.option.sure = false;
        word = joinArticle(c.detText!, word);
      }
      c.option.text = matchCase(c.unit.original, word);
    }
  }
  return out;
}

function thesaurusUnit(e: Engine, text: string, tokens: Token[], p: Probe, k: Probe['keys'][number], entry: Entry, stems: string[], lang: 'it' | 'en', nounChecks: { option: Option; unit: Unit; plural: boolean; det: Det | null; detText: string | null }[]): Unit | null {
  let start = tokens[p.start].start;
  const end = tokens[p.end - 1].end;
  const word = text.slice(start, end);
  // forma del testo: verbo flesso -> significati da verbo; dopo un articolo -> da nome
  const prev = p.start > 0 && !tokens[p.start].brk ? tokens[p.start - 1] : undefined;
  const det = prev ? e.dets.get(prev.w) ?? null : null;
  let meanings = entry.meanings.filter((m) => m.synonyms.length);
  if (k.lemma && k.lemma.slot !== e.morph.base && !(lang === 'en' && k.lemma.slot === '3sg') && meanings.some((m) => isVerbPos(m.pos))) meanings = meanings.filter((m) => isVerbPos(m.pos));
  else if (det && meanings.some((m) => isNounPos(m.pos))) meanings = meanings.filter((m) => isNounPos(m.pos));
  if (!meanings.length) return null;
  const context = new Set(stems.slice(Math.max(0, p.start - WINDOW), p.end + WINDOW).filter((s, j) => s && (j + Math.max(0, p.start - WINDOW) < p.start || j + Math.max(0, p.start - WINDOW) >= p.end)));
  const { index, sure } = chooseMeaning(e, meanings, context);
  const meaning = meanings[index];
  const noun = lang === 'it' && isNounPos(meaning.pos);
  // un nome italiano con l'articolo davanti: l'articolo entra nel tratto, si accorda all'alternativa
  const withDet = noun && det && prev ? prev : null;
  if (withDet) start = withDet.start;
  const original = text.slice(start, end);
  const plural = noun && k.key !== word.toLowerCase();
  const single = !k.key.includes(' ');
  // niente termini con la maiuscola (vengono da nomi propri: "Brobdingnagian") e niente "look back" per "look"
  const terms = meaning.synonyms.filter((t) => t === t.toLowerCase() && !t.startsWith(`${k.key} `) && t !== k.key);
  const ordered = single ? [...terms.filter((t) => !t.includes(' ')), ...terms.filter((t) => t.includes(' '))] : terms;
  const unit: Unit = { start, end, original, register: phraseRegister(e.pack, k.key, entry.meanings.length), keep: true, label: meaning.pos, options: [] };
  for (const t of ordered.slice(0, MAX_OPTIONS)) {
    const option: Option = { text: matchCase(original, noun ? t : inflect(e, t, word, k.key, k.lemma, lang)), base: t, register: phraseRegister(e.pack, t), source: 'thesaurus', sure, flags: 0 };
    // inglese: "a" / "an" davanti al sinonimo
    if (lang === 'en' && det?.kind === 'ind' && prev && !withDet) {
      const art = determiner(e.pack, det, 'n', option.text);
      if (art && art !== prev.w) {
        unit.start = prev.start;
        unit.original = text.slice(prev.start, end);
        option.text = joinArticle(matchCase(text.slice(prev.start, prev.end), art), option.text);
      } else if (unit.start === prev.start) option.text = joinArticle(text.slice(prev.start, prev.end), option.text);
    }
    if (noun) nounChecks.push({ option, unit, plural, det: withDet ? det : null, detText: withDet ? text.slice(withDet.start, withDet.end).toLowerCase() : null });
    unit.options.push(option);
  }
  return unit.options.length ? unit : null;
}

/**
 * Modifiche da fare al testo per una scelta di alternative, nelle posizioni del testo originale (le
 * applica l'editor, cosi' il resto della frase tiene i suoi stili). Una parola tolta ("basically,")
 * si porta via la virgola e lo spazio che seguono; se era a inizio frase la maiuscola passa alla
 * parola dopo.
 */
function plan(text: string, to: number, choices: { unit: Unit; option: Option }[]): Edit[] {
  const edits: Edit[] = [];
  let at = 0;
  let capitalize = false;
  const upper = (s: string) => s.replace(/\p{L}/u, (c) => c.toUpperCase());
  for (const { unit, option } of choices) {
    if (unit.start < at) continue;
    if (capitalize) {
      // la prima lettera dopo la parola tolta: nella prossima sostituzione o nel testo in mezzo
      const gap = text.slice(at, unit.start);
      const i = gap.search(/\p{L}/u);
      if (i >= 0) edits.push({ start: at + i, end: at + i + 1, text: gap[i].toUpperCase() });
      capitalize = i < 0;
    }
    const end = option.to ?? unit.end;
    if (option.text) {
      edits.push({ start: unit.start, end, text: capitalize ? upper(option.text) : option.text });
      capitalize = false;
      at = end;
      continue;
    }
    const skip = /^,?\s*/.exec(text.slice(end, to))![0].length;
    edits.push({ start: unit.start, end: end + skip, text: '' });
    at = end + skip;
    if (unit.original.charAt(0) !== unit.original.charAt(0).toLowerCase()) capitalize = true;
  }
  if (capitalize) {
    const i = text.slice(at, to).search(/\p{L}/u);
    if (i >= 0) edits.push({ start: at + i, end: at + i + 1, text: text[at + i].toUpperCase() });
  }
  return edits.sort((a, b) => a.start - b.start);
}

/** Testo della versione e tratti cambiati (nelle sue posizioni), applicando le modifiche. */
function compose(text: string, from: number, to: number, edits: Edit[]): { text: string; changes: Version['changes'] } {
  let out = '';
  let at = from;
  const changes: Version['changes'] = [];
  for (const ed of edits) {
    out += text.slice(at, ed.start);
    if (ed.text && ed.end - ed.start > 1) changes.push({ start: out.length, end: out.length + ed.text.length });
    out += ed.text;
    at = ed.end;
  }
  return { text: out + text.slice(at, to), changes };
}

/** La frase che contiene l'offset `at` (dal segno di fine frase precedente al prossimo, compreso). */
export function sentenceAt(text: string, at: number): [number, number] {
  // il cursore subito dopo il punto ("Terza?|") sta ancora in quella frase
  while (at > 0 && /[\s.!?…"»”)]/.test(text[at - 1]) && (at === text.length || /\s/.test(text[at]))) at--;
  let s = at;
  while (s > 0 && !/[.!?…]/.test(text[s - 1])) s--;
  while (s < text.length && /\s/.test(text[s])) s++;
  let e = at;
  while (e < text.length && !/[.!?…]/.test(text[e])) e++;
  while (e < text.length && /[.!?…"»”)]/.test(text[e])) e++;
  return [s, Math.max(s, e)];
}

/**
 * Tre riscritture del tratto [from, to) del testo (un blocco). `lang` e' la lingua del thesaurus
 * (null: solo il dizionario del pacchetto).
 */
export async function rewrite(e: Engine, text: string, from: number, to: number, lang: 'it' | 'en' | null, lookupMany: LookupMany): Promise<Rewrite> {
  const tokens = tokenize(text, e.pack.elision);
  const covered = new Set<number>();
  const units = packUnits(e, text, tokens, from, to, covered);
  if (lang) units.push(...(await thesaurusUnits(e, text, tokens, from, to, covered, lang, lookupMany)));
  units.sort((a, b) => a.start - b.start);
  const versions = TONES.map((tone) => {
    const c = toneCenter(tone);
    const used = new Set<string>();
    const choices: { unit: Unit; option: Option }[] = [];
    for (const unit of units) {
      if (unit.keep && toneOf(unit.register) === tone) continue;
      const dist = (r: number) => Math.abs(r - c);
      let best: Option | null = null;
      for (const o of unit.options) {
        if (!o.sure || used.has(o.text.toLowerCase())) continue;
        if (!best || dist(o.register) < dist(best.register) || (dist(o.register) === dist(best.register) && o.source === 'pack' && best.source !== 'pack')) best = o;
      }
      // l'originale resta se nessuna alternativa e' davvero piu' vicina al tono (per i sinonimi del
      // thesaurus, con registro solo stimato, serve un punto intero)
      const gain = best?.source === 'pack' ? 0.5 : 1;
      if (!best || (unit.keep && dist(best.register) > dist(unit.register) - gain)) continue;
      used.add(best.text.toLowerCase());
      choices.push({ unit, option: best });
    }
    const edits = plan(text, to, choices);
    return { tone, ...compose(text, from, to, edits), edits };
  });
  return { start: from, end: to, original: text.slice(from, to), units, versions };
}
