// Picus: flessione dei verbi guidata dal paradigma del pacchetto. Ogni forma e' uno "slot"
// (inglese: base 3sg past pp ing; italiano: inf ger pp1-4 pres1-6 ...): si riconosce lo slot della
// forma nel testo e si rigenera lo stesso slot per il verbo dell'alternativa.
//
// Due modi, entrambi solo dati:
// - regole a pattern (inglese): "rule past e>+d Cy>-1+ied #CVK>++ed *>+ed";
// - classi con tabelle di desinenze (italiano): "class are" + "pres o i a iamo ate ano", con le
//   giunture ortografiche ("join c i,e ch": cerc+i -> cerchi) e gli irregolari per tempo.
import type { Pack, ParadigmClass, ParadigmRule } from './pack';

export interface Morph {
  slots: string[];
  base: string;
  /** forme di un verbo, una per slot; null se la parola non e' un verbo conosciuto */
  forms(verb: string): string[] | null;
  isVerb(word: string): boolean;
  /** persona 1-6 dello slot (o indice 1-4 del participio); null per inf, ger, base */
  personOf(slot: string): number | null;
  /** slot che hanno questa forma per questo verbo */
  slotsOf(verb: string, form: string): string[];
  /** forma scelta per concordanza con la parola che precede (@agree), se il pacchetto la prevede */
  agree(verb: string, slot: string, prev: string | undefined): string | null;
  /** clitico attaccato in una locuzione del dizionario ("rendersi" -> rendere + si) */
  splitClitic(word: string): { verb: string; clitic: string } | null;
  /** infinito o gerundio con il clitico attaccato (render + si, rendendo + si) */
  attach(form: string, slot: string, clitic: string): string;
  /** ausiliare del verbo (italiano), null se il pacchetto non ne ha */
  auxOf(verb: string, clitic: string): string | null;
}

function matchesPat(w: string, pat: string, vowels: string): boolean {
  if (pat.length > w.length) return false;
  const off = w.length - pat.length;
  for (let i = 0; i < pat.length; i++) {
    const p = pat[i];
    const c = w[off + i];
    const isV = vowels.includes(c);
    if (p === 'C' ? isV : p === 'V' ? !isV : p === 'K' ? isV || 'wxy'.includes(c) : p !== c) return false;
  }
  return true;
}

function syllables(w: string, vowels: string): number {
  let n = 0;
  for (let i = 0; i < w.length; i++) if (vowels.includes(w[i]) && (i === 0 || !vowels.includes(w[i - 1]))) n++;
  return n;
}

function applyRules(w: string, rules: ParadigmRule[], vowels: string, dbl: boolean): string {
  for (const r of rules) {
    if (r.mono && !(dbl || syllables(w, vowels) === 1)) continue;
    if (!r.pats.some((p) => matchesPat(w, p, vowels))) continue;
    let out = r.cut ? w.slice(0, -r.cut) : w;
    if (r.dbl) out += out[out.length - 1];
    return out + r.add;
  }
  return w;
}

export function buildMorph(pack: Pack): Morph {
  const p = pack.paradigm;
  const vowels = pack.vowels;
  const slotIndex = new Map(p.slots.map((s, i) => [s, i]));
  const irregular = new Map(pack.irregular.map((i) => [i.base, i.fields]));
  const cache = new Map<string, string[] | null>();

  // tempi (gruppi di slot con lo stesso prefisso: pres -> pres1..pres6, inf -> inf)
  const tenses = new Map<string, string[]>();
  for (const s of p.slots) {
    const t = s.replace(/\d$/, '');
    tenses.set(t, [...(tenses.get(t) ?? []), s]);
  }

  const classByName = new Map(p.classes.map((c) => [c.name, c]));
  const table = (c: ParadigmClass | undefined, tense: string): string[] | undefined => {
    for (let k = c; k; k = k.parent ? classByName.get(k.parent) : undefined) {
      const t = k.tables.get(tense);
      if (t) return t;
    }
    return undefined;
  };
  const joinsOf = (c: ParadigmClass) => {
    const out: ParadigmClass['joins'] = [];
    for (let k: ParadigmClass | undefined = c; k; k = k.parent ? classByName.get(k.parent) : undefined) out.push(...k.joins);
    return out.sort((a, b) => b.end.length - a.end.length);
  };
  const meta = (c: ParadigmClass | undefined, key: string): string[] | undefined => {
    for (let k = c; k; k = k.parent ? classByName.get(k.parent) : undefined) {
      const t = k.tables.get(`:${key}`);
      if (t) return t;
    }
    return undefined;
  };

  const classOf = (verb: string, fields?: Map<string, string>): ParadigmClass | undefined => {
    const named = fields?.get('class');
    if (named) return classByName.get(named);
    return p.classes.find((c) => c.members.has(verb)) ?? p.classes.find((c) => !c.members.size && c.ending && verb.endsWith(c.ending));
  };

  const join = (stem: string, ending: string, joins: ParadigmClass['joins']): string => {
    for (const j of joins) {
      if (stem.endsWith(j.end) && j.starts.some((s) => ending.startsWith(s))) return stem.slice(0, stem.length - j.end.length) + j.repl + ending;
    }
    return stem + ending;
  };

  function classForms(verb: string, fields: Map<string, string> | undefined): string[] | null {
    const c = classOf(verb, fields);
    if (!c) return null;
    const joins = joinsOf(c);
    const base = fields?.get('stem') ?? (verb.endsWith(c.ending) ? verb.slice(0, verb.length - c.ending.length) : null);
    if (base === null) return null;
    const out: string[] = new Array(p.slots.length).fill('');
    // temi per tempo: un valore senza virgole e' un tema (o una forma, se finisce come la prima desinenza)
    const strip = (tense: string) => meta(c, `strip-${tense}`)?.[0] ?? '';
    const stemFor = (tense: string): string | null => {
      const v = fields?.get(tense);
      if (v && !v.includes(',')) {
        const ends = table(c, tense) ?? [];
        const first = (ends[0] ?? '').slice(strip(tense).length);
        return first && v.endsWith(first) && v.length > first.length ? v.slice(0, v.length - first.length) : v;
      }
      const linked = meta(c, `link-${tense}`)?.[0];
      return linked ? stemFor(linked) : null;
    };
    for (const [tense, slots] of tenses) {
      const v = fields?.get(tense);
      // una lista e' l'intero tempo; per infinito e gerundio il valore e' la forma ("fare", "dicendo")
      if (v && (v.includes(',') || slots.length === 1)) {
        const list = v.split(',');
        slots.forEach((s, i) => (out[slotIndex.get(s)!] = list[i] ?? list[list.length - 1]));
        continue;
      }
      const ends = table(c, tense);
      if (!ends) continue;
      const own = stemFor(tense);
      const cut = own !== null ? strip(tense) : '';
      slots.forEach((s, i) => {
        const e = ends[i];
        out[slotIndex.get(s)!] = own !== null ? join(own, e.slice(cut.length), joins) : join(base, e, joins);
      });
      // passato remoto forte: "prs=pres" -> presi, prese, presero (le altre persone restano regolari)
      const strong = fields?.get(`${tense}s`);
      const pattern = meta(c, `strong-${tense}`);
      if (strong && pattern) slots.forEach((s, i) => pattern[i] && pattern[i] !== '-' && (out[slotIndex.get(s)!] = strong + pattern[i]));
    }
    return out;
  }

  function ruleForms(verb: string, fields: Map<string, string> | undefined): string[] {
    const dbl = p.double.has(verb);
    const out: string[] = new Array(p.slots.length).fill('');
    const compute = (slot: string): string => {
      const given = fields?.get(slot);
      if (given) return given;
      if (slot === p.base) return verb;
      const r = p.rules.get(slot);
      if (typeof r === 'string') return compute(r);
      return r ? applyRules(verb, r, vowels, dbl) : verb;
    };
    p.slots.forEach((s, i) => (out[i] = compute(s)));
    return out;
  }

  function forms(verb: string): string[] | null {
    if (cache.has(verb)) return cache.get(verb)!;
    let out: string[] | null = null;
    const root = pack.derive.get(verb);
    if (root && verb.endsWith(root)) {
      const prefix = verb.slice(0, verb.length - root.length);
      out = forms(root)?.map((f) => prefix + f) ?? null;
    } else {
      const fields = irregular.get(verb);
      if (p.classes.length) out = classForms(verb, fields);
      else if (p.rules.size && isVerb(verb)) out = ruleForms(verb, fields);
    }
    cache.set(verb, out);
    return out;
  }

  function isVerb(w: string): boolean {
    if (p.notverbs.has(w)) return false;
    if (p.verbs.has(w) || irregular.has(w) || pack.derive.has(w)) return true;
    return p.classes.some((c) => c.ending && w.endsWith(c.ending) && w.length > c.ending.length + 1);
  }

  const cl = pack.clitic;
  const cliticSuffixes = cl ? [`${cl.beforene[2]}ne`, cl.person[2], 'ne'] : [];

  return {
    slots: p.slots,
    base: p.base,
    forms,
    isVerb: (w) => isVerb(w) && forms(w) !== null,
    personOf(slot) {
      const m = /(\d)$/.exec(slot);
      return m ? Number(m[1]) : null;
    },
    slotsOf(verb, form) {
      const f = forms(verb);
      return f ? p.slots.filter((_, i) => f[i] === form) : [];
    },
    agree(verb, slot, prev) {
      const rules = pack.agree.get(verb)?.get(slot);
      if (!rules) return null;
      for (const r of rules) if (!r.prev || (prev !== undefined && r.prev.includes(prev))) return r.form;
      return null;
    },
    splitClitic(word) {
      for (const s of cliticSuffixes) {
        if (!word.endsWith(s) || word.length <= s.length + 2) continue;
        const stem = word.slice(0, -s.length);
        for (const v of [`${stem}e`, `${stem}re`]) if (isVerb(v) && forms(v)) return { verb: v, clitic: s };
      }
      return null;
    },
    attach(form, slot, clitic) {
      if (slot === 'inf') {
        let s = form.endsWith('e') ? form.slice(0, -1) : form;
        if (s.endsWith('rr')) s = s.slice(0, -1);
        return s + clitic;
      }
      return form + clitic;
    },
    auxOf(verb, clitic) {
      if (!pack.aux.def) return null;
      // con il riflessivo l'ausiliare marcato "reflexive" in @aux (in italiano "essere")
      if (clitic && clitic !== 'ne') for (const [aux, list] of pack.aux.others) if (list.has('reflexive')) return aux;
      const own = irregular.get(verb)?.get('aux');
      if (own) return own;
      // non si eredita dal verbo base: giungere vuole essere, raggiungere avere
      for (const [aux, list] of pack.aux.others) if (list.has(verb)) return aux;
      return pack.aux.def;
    },
  };
}
