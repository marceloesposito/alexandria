// Picus: formato dei pacchetti di lingua (.picus). Solo dati, mai codice: il motore e' uno solo e
// ogni lingua porta stopword, regole dello stemmer, paradigmi dei verbi, irregolari e il dizionario
// delle locuzioni. File di testo modificabile a mano, una sezione per "@nome", commenti con "#".
//
//   @meta         lang en / name English / vowels aeiouy / elision on / license ...
//   @stopwords    parole separate da spazi, su piu' righe
//   @stem         vowels, rv, r1prefix, mark, fixe, undouble, "= parola stem", "step [ifnone]",
//                 regole "suff1,suff2 sostituzione|-|= [r1|r2|rv] [v] [vnb] [pre=..] [npre=..]
//                 [prestr=..,..] [min=n] [nshort] [fix] [then=suff,..@regione]"
//   @paradigm     slots / base / irregular (ordine dei campi) / verbs / notverbs / double /
//                 rule <slot> pattern>azione... (inglese) / class <nome> [ending] + tabelle
//                 "<tempo> desinenze", join, members (italiano)
//   @irregular    "take took taken" (posizionale) o "fare stem=fac pres=faccio,fai,... pp=fatto"
//   @derive       "prendere comprendere apprendere" (composti che si flettono come il primo)
//   @agree        "be base to,will>be i>am *>are": forma scelta dalla parola che precede
//   @aux          "avere *" (ausiliare predefinito) / "essere andare venire ..."
//   @clitic       person mi ti si ci vi si / beforene me te se ce ve se / modals dovere potere
//   @prep         "di del:il dello:lo ..." preposizioni articolate e articolo
//   @sense <nome> "variante  registro  [flag...] [note:testo]" (gruppo simmetrico)
//   @replace      "da -> a1 [reg] | a2 [reg]  reason:etichetta  [note:testo]" (suggerimento in un senso)
//
// Registro da -2 (gergale) a +2 (molto formale); flag: figurative, dated, technical, emphatic,
// euphemistic. "*" in una locuzione e' un vuoto di 1-3 parole ("take * into account").

import { FLAGS } from './flags';

export { FLAGS, type Flag } from './flags';

export interface Variant {
  text: string;
  tokens: string[];
  register: number;
  /** bit di FLAGS */
  flags: number;
  note?: string;
  /** locuzione nominale: genere e numero (ms fs mp fp; "n" senza genere). L'articolo che la precede
   *  fa parte del tratto e si accorda all'alternativa ("la chiave di volta" -> "il cardine") */
  gender?: string;
  /** locuzione fissa: non si flette ("does not" / "doesn't") */
  fixed?: boolean;
}

/** Euristica del registro per le parole che il dizionario non conosce (@register). */
export interface RegisterRules {
  /** suffisso -> punteggio ("zione" +1) */
  suffix: Map<string, number>;
  /** parola -> registro ("roba" -1, "pertanto" +1) */
  word: Map<string, number>;
  /** particelle dei verbi frasali ("out", "up"): verbo + particella scende */
  particles: Set<string>;
  particle: number;
  /** almeno n sillabe: punteggio; al massimo n sillabe: punteggio */
  long: [number, number] | null;
  short: [number, number] | null;
  /** almeno n significati nel thesaurus (parola comune): punteggio */
  poly: [number, number] | null;
}

export interface ArticleTable {
  /** "def"/"ind" + genere ("*" per tutti) -> forme in ordine, ognuna con le classi d'iniziale richieste */
  rows: Map<string, { form: string; when: string | null }[]>;
  /** classi d'iniziale: prefissi che ci stanno e prefissi esclusi ("!uni") */
  classes: Map<string, { yes: string[]; no: string[] }>;
}

export interface Sense {
  name: string;
  variants: Variant[];
}

export interface Replace {
  from: Variant;
  to: Variant[];
  reason: string;
}

export interface StemRule {
  suffixes: string[];
  /** null: si toglie; '=': resta com'e' (blocca i suffissi piu' corti) */
  repl: string | null;
  region: 'r1' | 'r2' | 'rv' | null;
  conds: { v?: boolean; vnb?: boolean; pre?: string; npre?: string; prestr?: string[]; min?: number; nshort?: boolean };
  fix?: boolean;
  /** poi si toglie anche uno di questi (alternative); "at>ic" e' una catena: at, poi ic */
  then?: { chains: string[][]; region: 'r1' | 'r2' | 'rv' | null };
}

export interface StemData {
  rv: boolean;
  r1prefix: string[];
  marks: { ch: string; to: string; ctx: string }[];
  fixe: string[];
  undouble: string[];
  exceptions: Map<string, string>;
  /** ifnone: solo se il passo prima non ha tolto nulla; limit: il suffisso si cerca dentro la regione */
  steps: { ifnone: boolean; limit: 'r1' | 'r2' | 'rv' | null; rules: StemRule[] }[];
}

export interface ParadigmRule {
  /** suffissi alternativi; lettere maiuscole: C consonante, V vocale, K consonante non w/x/y */
  pats: string[];
  /** il verbo deve avere una sola sillaba (o stare in "double") */
  mono: boolean;
  cut: number;
  dbl: boolean;
  add: string;
}

export interface ParadigmClass {
  name: string;
  ending: string;
  parent: string | null;
  tables: Map<string, string[]>;
  joins: { end: string; starts: string[]; repl: string }[];
  members: Set<string>;
}

export interface Paradigm {
  slots: string[];
  base: string;
  irregularOrder: string[];
  verbs: Set<string>;
  notverbs: Set<string>;
  double: Set<string>;
  rules: Map<string, ParadigmRule[] | string>;
  classes: ParadigmClass[];
}

export interface Irregular {
  base: string;
  /** campi posizionali (ordine "irregular" del paradigma) o chiavi (stem, pres, pp, fut...) */
  fields: Map<string, string>;
}

export interface Pack {
  lang: string;
  meta: Map<string, string>;
  vowels: string;
  elision: boolean;
  stopwords: Set<string>;
  stem: StemData;
  paradigm: Paradigm;
  irregular: Irregular[];
  derive: Map<string, string>;
  agree: Map<string, Map<string, { prev: string[] | null; form: string }[]>>;
  aux: { def: string | null; others: Map<string, Set<string>> };
  clitic: { person: string[]; beforene: string[]; modals: string[] } | null;
  prep: Map<string, Map<string, string>>;
  prepDrop: Set<string>;
  article: ArticleTable;
  register: RegisterRules;
  /** plurale dei nomi per desinenza ("ca>che:f"), dal suffisso piu' lungo; "*" = invariabile */
  plural: { suffix: string; repl: string; gender: string | null }[];
  /** genere dei nomi per desinenza ("zione f", "ma m"), dal suffisso piu' lungo */
  genders: { suffix: string; gender: string }[];
  /** contrari scritti a mano (il thesaurus italiano non ne ha), in tutte e due le direzioni */
  antonyms: Map<string, string[]>;
  senses: Sense[];
  replaces: Replace[];
}

export class PackError extends Error {
  constructor(
    message: string,
    public line: number,
    public section: string,
  ) {
    super(`riga ${line} (@${section}): ${message}`);
  }
}

const REG = /^[+-]?[0-2]$/;

/**
 * Testo di una locuzione in parole normalizzate (minuscole, apostrofo dritto), divise come le
 * divide il tokenizzatore: con l'elisione "l'accento" diventa "l'" + "accento".
 */
export function phraseTokens(text: string, elision = false): string[] {
  const words = text
    .toLowerCase()
    .replace(/[’‘ʼ]/g, "'")
    .split(/\s+/)
    .filter(Boolean);
  return elision ? words.flatMap((w) => w.split(/(?<=')(?=\p{L})/u)) : words;
}

function parseVariant(rest: string, line: number, section: string, needRegister: boolean, elision: boolean): Variant & { reason?: string } {
  const words = rest.trim().split(/\s+/);
  const text: string[] = [];
  let i = 0;
  for (; i < words.length; i++) {
    const w = words[i];
    if (REG.test(w) || w.includes(':') || (!needRegister && (FLAGS as readonly string[]).includes(w) && text.length)) break;
    text.push(w);
  }
  if (!text.length) throw new PackError('variante senza testo', line, section);
  let register = 0;
  if (i < words.length && REG.test(words[i])) register = Number(words[i++]);
  else if (needRegister) throw new PackError(`registro mancante (da -2 a +2) dopo "${text.join(' ')}"`, line, section);
  let flags = 0;
  let note: string | undefined;
  let reason: string | undefined;
  let gender: string | undefined;
  let fixed = false;
  for (; i < words.length; i++) {
    const w = words[i];
    if (w === 'fixed') {
      fixed = true;
      continue;
    }
    if (w.startsWith('g:')) {
      gender = w.slice(2);
      if (!/^(ms|fs|mp|fp|n)$/.test(gender)) throw new PackError(`genere "${gender}": ms, fs, mp, fp o n`, line, section);
      continue;
    }
    if (w.startsWith('note:')) {
      note = [w.slice(5), ...words.slice(i + 1)].join(' ').trim();
      break;
    }
    if (w.startsWith('reason:')) {
      reason = w.slice(7);
      continue;
    }
    const f = (FLAGS as readonly string[]).indexOf(w);
    if (f < 0) throw new PackError(`flag sconosciuto "${w}"`, line, section);
    flags |= 1 << f;
  }
  // "-" e' la variante vuota: in quel tono la parola si toglie ("basically" nel formale)
  const joined = text.join(' ') === '-' ? '' : text.join(' ');
  const v: Variant & { reason?: string } = { text: joined, tokens: phraseTokens(joined, elision), register, flags, note, reason };
  if (gender) v.gender = gender;
  if (fixed) v.fixed = true;
  return v;
}

const regionOf = (s: string) => (s === 'r1' || s === 'r2' || s === 'rv' ? s : null);

function parseStemRule(words: string[], line: number): StemRule {
  const [suff, repl, ...opts] = words;
  if (!suff || repl === undefined) throw new PackError('regola dello stemmer incompleta: "suffissi sostituzione"', line, 'stem');
  const rule: StemRule = { suffixes: suff.split(','), repl: repl === '-' ? null : repl, region: null, conds: {} };
  for (const o of opts) {
    if (regionOf(o)) rule.region = regionOf(o);
    else if (o === 'v') rule.conds.v = true;
    else if (o === 'vnb') rule.conds.vnb = true;
    else if (o === 'nshort') rule.conds.nshort = true;
    else if (o === 'fix') rule.fix = true;
    else if (o.startsWith('pre=')) rule.conds.pre = o.slice(4);
    else if (o.startsWith('npre=')) rule.conds.npre = o.slice(5);
    else if (o.startsWith('prestr=')) rule.conds.prestr = o.slice(7).split(',');
    else if (o.startsWith('min=')) rule.conds.min = Number(o.slice(4));
    else if (o.startsWith('then=')) {
      const [s, r] = o.slice(5).split('@');
      rule.then = { chains: s.split(',').map((c) => c.split('>')), region: regionOf(r ?? '') };
    } else throw new PackError(`opzione sconosciuta "${o}"`, line, 'stem');
  }
  return rule;
}

/** "pres*6" -> pres1..pres6 */
function expandSlots(words: string[]): string[] {
  return words.flatMap((w) => {
    const m = /^(.+)\*(\d)$/.exec(w);
    return m ? Array.from({ length: Number(m[2]) }, (_, i) => `${m[1]}${i + 1}`) : [w];
  });
}

function parseParadigmRule(words: string[], line: number): ParadigmRule[] {
  return words.map((w) => {
    const m = /^(#?)([^>]*)>(.*)$/.exec(w);
    if (!m) throw new PackError(`regola di flessione "${w}": serve "pattern>azione"`, line, 'paradigm');
    // azione: -n toglie n lettere, ++ raddoppia l'ultima, +x aggiunge x ("-1+ies", "++ed", "+s")
    const act = /^(?:-(\d))?(?:(\+\+)|\+)?(.*)$/.exec(m[3])!;
    if (act[3] && !act[2] && !m[3].includes('+')) throw new PackError(`azione "${m[3]}": usare -n, ++ e +desinenza`, line, 'paradigm');
    return { pats: m[2] === '*' ? [''] : m[2].split(','), mono: !!m[1], cut: Number(act[1] ?? 0), dbl: !!act[2], add: act[3] };
  });
}

export function parsePack(src: string): Pack {
  const pack: Pack = {
    lang: '',
    meta: new Map(),
    vowels: 'aeiou',
    elision: false,
    stopwords: new Set(),
    stem: { rv: false, r1prefix: [], marks: [], fixe: [], undouble: [], exceptions: new Map(), steps: [] },
    paradigm: { slots: [], base: '', irregularOrder: [], verbs: new Set(), notverbs: new Set(), double: new Set(), rules: new Map(), classes: [] },
    irregular: [],
    derive: new Map(),
    agree: new Map(),
    aux: { def: null, others: new Map() },
    clitic: null,
    prep: new Map(),
    prepDrop: new Set(),
    article: { rows: new Map(), classes: new Map() },
    register: { suffix: new Map(), word: new Map(), particles: new Set(), particle: -1, long: null, short: null, poly: null },
    antonyms: new Map(),
    plural: [],
    genders: [],
    senses: [],
    replaces: [],
  };
  let section = '';
  let sense: Sense | null = null;
  let cls: ParadigmClass | null = null;
  const lines = src.split(/\r?\n/);
  for (let n = 0; n < lines.length; n++) {
    const line = n + 1;
    // i commenti partono da "#" a inizio riga o dopo uno spazio ("#CVK" nei paradigmi non e' un commento)
    const raw = lines[n].replace(/(^|\s)#\s.*$|^#.*$/, '').trim();
    if (!raw) continue;
    if (raw.startsWith('@')) {
      const [head, ...rest] = raw.slice(1).split(/\s+/);
      section = head;
      sense = null;
      cls = null;
      if (head === 'sense') {
        if (!rest.length) throw new PackError('@sense senza nome', line, head);
        sense = { name: rest.join(' '), variants: [] };
        pack.senses.push(sense);
      } else if (!['meta', 'stopwords', 'stem', 'paradigm', 'irregular', 'derive', 'agree', 'aux', 'clitic', 'prep', 'article', 'register', 'antonym', 'noun', 'replace'].includes(head)) {
        throw new PackError(`sezione sconosciuta "@${head}"`, line, head);
      }
      continue;
    }
    const words = raw.split(/\s+/);
    const [key, ...rest] = words;
    switch (section) {
      case 'meta':
        pack.meta.set(key, rest.join(' '));
        if (key === 'lang') pack.lang = rest[0] ?? '';
        if (key === 'vowels') pack.vowels = rest[0] ?? pack.vowels;
        if (key === 'elision') pack.elision = rest[0] === 'on';
        break;
      case 'stopwords':
        for (const w of words) pack.stopwords.add(w.toLowerCase());
        break;
      case 'stem': {
        const st = pack.stem;
        if (key === 'rv') st.rv = true;
        else if (key === 'r1prefix') st.r1prefix.push(...rest);
        else if (key === 'mark') {
          if (rest.length < 3) throw new PackError('mark: "mark lettera Sostituta contesto"', line, section);
          st.marks.push({ ch: rest[0], to: rest[1], ctx: rest[2] });
        } else if (key === 'fixe') st.fixe.push(...rest);
        else if (key === 'undouble') st.undouble.push(...rest);
        else if (key === '=') {
          if (rest.length !== 2) throw new PackError('eccezione: "= parola stem"', line, section);
          st.exceptions.set(rest[0], rest[1]);
        } else if (key === 'step') {
          const limit = rest.find((r) => r.startsWith('limit='))?.slice(6) ?? '';
          st.steps.push({ ifnone: rest.includes('ifnone'), limit: regionOf(limit), rules: [] });
        }
        else {
          if (!st.steps.length) throw new PackError('regola prima di "step"', line, section);
          st.steps[st.steps.length - 1].rules.push(parseStemRule(words, line));
        }
        break;
      }
      case 'paradigm': {
        const p = pack.paradigm;
        if (key === 'slots') p.slots = expandSlots(rest);
        else if (key === 'base') p.base = rest[0];
        else if (key === 'irregular') p.irregularOrder = rest;
        else if (key === 'verbs') rest.forEach((v) => p.verbs.add(v));
        else if (key === 'notverbs') rest.forEach((v) => p.notverbs.add(v));
        else if (key === 'double') rest.forEach((v) => p.double.add(v));
        else if (key === 'rule') {
          const [slot, ...r] = rest;
          if (!p.slots.includes(slot)) throw new PackError(`slot sconosciuto "${slot}"`, line, section);
          p.rules.set(slot, r.length === 1 && p.slots.includes(r[0]) ? r[0] : parseParadigmRule(r, line));
        } else if (key === 'class') {
          const [name, parent] = rest;
          const par = parent ? p.classes.find((c) => c.name === parent) : undefined;
          if (parent && !par) throw new PackError(`classe madre "${parent}" non definita`, line, section);
          cls = { name, ending: par?.ending ?? '', parent: par?.name ?? null, tables: new Map(), joins: [], members: new Set() };
          p.classes.push(cls);
        } else if (cls && key === 'join') {
          const [end, starts, repl] = rest;
          if (!end || !starts || repl === undefined) throw new PackError('join: "join fine iniziali sostituzione"', line, section);
          cls.joins.push({ end, starts: starts.split(','), repl: repl === '-' ? '' : repl });
        } else if (cls && key === 'members') rest.forEach((v) => cls!.members.add(v));
        else if (cls && key === 'ending') cls.ending = rest[0];
        else if (cls && (key === 'strip' || key === 'link' || key === 'strong')) {
          // strip fut er: un tema irregolare del futuro sostituisce anche "er" (avr + ò)
          // link cond fut: senza un tema proprio il condizionale usa quello del futuro
          // strong pr i - e - - ero: persone forti del passato remoto ("prs=pres" -> presi, prese, presero)
          const [tense, ...vals] = rest;
          if (!tense || !vals.length) throw new PackError(`${key}: "${key} tempo valore"`, line, section);
          cls.tables.set(`:${key}-${tense}`, vals);
        }
        else if (cls) {
          // tabella: "pres o i a iamo ate ano" o "pp ato ata ati ate" (slot espansi nell'ordine)
          const slots = p.slots.filter((s) => s === key || (s.startsWith(key) && /^\d$/.test(s.slice(key.length))));
          if (!slots.length) throw new PackError(`tempo sconosciuto "${key}"`, line, section);
          if (rest.length !== slots.length) throw new PackError(`"${key}" vuole ${slots.length} desinenze, ne ha ${rest.length}`, line, section);
          cls.tables.set(key, rest);
        } else throw new PackError(`riga non riconosciuta "${raw}"`, line, section);
        break;
      }
      case 'irregular': {
        const fields = new Map<string, string>();
        if (rest.some((w) => w.includes('='))) {
          for (const w of rest) {
            const i = w.indexOf('=');
            if (i < 1) throw new PackError(`campo "${w}": serve chiave=valore`, line, section);
            fields.set(w.slice(0, i), w.slice(i + 1));
          }
        } else {
          const order = pack.paradigm.irregularOrder;
          if (!order.length) throw new PackError('manca "irregular" nel @paradigm', line, section);
          if (rest.length + 1 > order.length) throw new PackError(`troppi campi (al massimo ${order.length})`, line, section);
          [key, ...rest].forEach((w, i) => w !== '-' && fields.set(order[i], w));
        }
        pack.irregular.push({ base: key, fields });
        break;
      }
      case 'derive':
        for (const d of rest) pack.derive.set(d, key);
        break;
      case 'agree': {
        const [slot, ...rules] = rest;
        const forms = rules.map((r) => {
          const [cond, form] = r.split('>');
          if (form === undefined) throw new PackError(`"${r}": serve "precedenti>forma"`, line, section);
          return { prev: cond === '*' ? null : cond.split(','), form };
        });
        const m = pack.agree.get(key) ?? new Map();
        m.set(slot, forms);
        pack.agree.set(key, m);
        break;
      }
      case 'aux':
        if (rest[0] === '*') pack.aux.def = key;
        else pack.aux.others.set(key, new Set([...(pack.aux.others.get(key) ?? []), ...rest]));
        break;
      case 'clitic': {
        const c = (pack.clitic ??= { person: [], beforene: [], modals: [] });
        if (key === 'person' || key === 'beforene') {
          if (rest.length !== 6) throw new PackError(`${key}: servono 6 forme (persone 1-6)`, line, section);
          c[key] = rest;
        } else if (key === 'modals') c.modals = rest;
        else throw new PackError(`riga non riconosciuta "${raw}"`, line, section);
        break;
      }
      case 'prep': {
        // "drop che": la preposizione finale cade davanti a queste parole (rendersi conto di + che)
        if (key === 'drop') {
          rest.forEach((w) => pack.prepDrop.add(w));
          break;
        }
        const m = new Map<string, string>();
        for (const r of rest) {
          const i = r.lastIndexOf(':');
          if (i < 1) throw new PackError(`"${r}": serve "articolata:articolo"`, line, section);
          m.set(r.slice(0, i), r.slice(i + 1));
        }
        pack.prep.set(key, m);
        break;
      }
      case 'register': {
        // suffix +1 zione sione ita' / word -1 roba cosa / particles -1 out up / long 4 +0.5 / short 1 -0.5 / poly 5 -0.5
        const r = pack.register;
        const num = (s: string | undefined) => {
          const n = Number(s);
          if (s === undefined || !Number.isFinite(n) || Math.abs(n) > 2) throw new PackError(`"${s}": serve un numero fra -2 e +2`, line, section);
          return n;
        };
        if (key === 'suffix' || key === 'word') {
          const [score, ...list] = rest;
          const n = num(score);
          for (const w of list) r[key].set(w.toLowerCase(), n);
        } else if (key === 'particles') {
          const [score, ...list] = rest;
          r.particle = num(score);
          list.forEach((w) => r.particles.add(w.toLowerCase()));
        } else if (key === 'long' || key === 'short' || key === 'poly') {
          const n = Number(rest[0]);
          if (!Number.isInteger(n) || n < 1) throw new PackError(`${key}: "${key} soglia punteggio"`, line, section);
          r[key] = [n, num(rest[1])];
        } else throw new PackError(`riga non riconosciuta "${raw}"`, line, section);
        break;
      }
      case 'noun': {
        // "plural ca>che:f a>i:m tà>*" / "gender f zione sione tà" / "gender m ma ista"
        if (key === 'plural') {
          for (const r of rest) {
            const m = /^([^>]+)>([^:]*)(?::([mf]))?$/.exec(r);
            if (!m) throw new PackError(`plurale "${r}": serve "desinenza>plurale[:genere]"`, line, section);
            pack.plural.push({ suffix: m[1], repl: m[2], gender: m[3] ?? null });
          }
          pack.plural.sort((a, b) => b.suffix.length - a.suffix.length);
        } else if (key === 'gender') {
          const [g, ...suffixes] = rest;
          if (g !== 'm' && g !== 'f') throw new PackError('gender: "gender m|f desinenze..."', line, section);
          for (const s of suffixes) pack.genders.push({ suffix: s, gender: g });
          pack.genders.sort((a, b) => b.suffix.length - a.suffix.length);
        } else throw new PackError(`riga non riconosciuta "${raw}"`, line, section);
        break;
      }
      case 'antonym': {
        // "bello brutto orribile": la prima parola e i suoi contrari (valgono anche al contrario)
        if (!rest.length) throw new PackError('serve almeno un contrario', line, section);
        const add = (w: string, a: string) => {
          const list = pack.antonyms.get(w) ?? [];
          if (!list.includes(a)) list.push(a);
          pack.antonyms.set(w, list);
        };
        for (const a of rest) {
          add(key.toLowerCase(), a.replace(/_/g, ' '));
          add(a.replace(/_/g, ' ').toLowerCase(), key);
        }
        break;
      }
      case 'article': {
        // "cls Z sb sc ... z gn" classi d'iniziale; "def ms il lo:Z l':V" forme con la loro classe
        if (key === 'cls') {
          const [name, ...prefixes] = rest;
          if (!name || !prefixes.length) throw new PackError('cls: "cls Nome prefisso..."', line, section);
          pack.article.classes.set(name, { yes: prefixes.filter((x) => !x.startsWith('!')), no: prefixes.filter((x) => x.startsWith('!')).map((x) => x.slice(1)) });
        } else if (key === 'def' || key === 'ind') {
          const [gender, ...forms] = rest;
          if (!gender || !forms.length) throw new PackError(`${key}: "${key} genere forma[:classe]..."`, line, section);
          pack.article.rows.set(`${key} ${gender}`, forms.map((f) => {
            const i = f.lastIndexOf(':');
            return i > 0 ? { form: f.slice(0, i), when: f.slice(i + 1) } : { form: f, when: null };
          }));
        } else throw new PackError(`riga non riconosciuta "${raw}"`, line, section);
        break;
      }
      case 'sense': {
        const v = parseVariant(raw, line, section, true, pack.elision);
        sense!.variants.push(v);
        break;
      }
      case 'replace': {
        const arrow = raw.indexOf('->');
        if (arrow < 0) throw new PackError('serve "da -> a"', line, section);
        const from = parseVariant(raw.slice(0, arrow), line, section, false, pack.elision);
        const parts = raw.slice(arrow + 2).split('|');
        let reason = '';
        let note: string | undefined;
        const to = parts.map((p) => {
          const v = parseVariant(p, line, section, false, pack.elision);
          if (v.reason) reason = v.reason;
          if (v.note) note = v.note;
          const out: Variant = { text: v.text, tokens: v.tokens, register: v.register, flags: v.flags };
          if (v.gender) out.gender = v.gender;
          if (v.fixed) out.fixed = true;
          return out;
        });
        if (!reason) throw new PackError('manca "reason:"', line, section);
        const src: Variant = { text: from.text, tokens: from.tokens, register: from.register, flags: from.flags, note };
        if (from.gender) src.gender = from.gender;
        pack.replaces.push({ from: src, to, reason });
        break;
      }
      default:
        throw new PackError('riga fuori da una sezione', line, section || '-');
    }
  }
  if (!pack.lang) throw new PackError('manca "lang" in @meta', 1, 'meta');
  if (pack.paradigm.slots.length && !pack.paradigm.slots.includes(pack.paradigm.base)) throw new PackError(`base "${pack.paradigm.base}" non e' uno slot`, 1, 'paradigm');
  return pack;
}
