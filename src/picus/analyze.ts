// Picus: analisi di un paragrafo. Locuzioni (con la forma del verbo, l'ausiliare e il clitico che
// le precedono), sensi, ripetizioni, scarti di tono; per ogni rilievo le alternative gia' flesse
// come l'originale e divise per tono. Funzioni pure: il testo entra, i rilievi escono.
import { parsePack, type Pack, type Variant } from './pack';
import { buildMorph, type Morph } from './inflect';
import { buildLexicon, findMatches, type Hit, type Lexicon, type Match } from './match';
import { tokenize, type Token } from './tokens';
import { makeStemmer } from './stem';
import { SENSE_RULES, type SenseRule } from './senses';
import { rank, toneCenter, type Ranked, type Tone } from './rank';
import { matchCase } from '../thesaurus/model';
import { articleIndex, determiner, joinArticle, type Det } from './article';

export type FindingKind = 'style' | 'tone' | 'repetition' | 'variation' | 'synonym';

export interface Suggestion {
  /** testo da mettere al posto dell'originale */
  text: string;
  /** forma del dizionario */
  base: string;
  register: number;
  flags: number;
  note?: string;
  /** forma femminile quando l'accordo non si puo' sapere (italiano: "si e' reso/resa conto") */
  alt?: string;
  /** la sostituzione arriva fino a qui (inghiotte l'articolo che segue: "di" + "l'" -> "dell'") */
  to?: number;
  /** termine simile, non sinonimo stretto (thesaurus) */
  related?: boolean;
}

export interface SenseSuggestions {
  /** nome del senso ('' per i suggerimenti di @replace) */
  sense: string;
  sections: Ranked<Suggestion>[];
}

export interface Finding {
  kind: FindingKind;
  /** tutti i motivi dello stesso tratto (es. stile e tono) */
  tags: FindingKind[];
  start: number;
  end: number;
  original: string;
  /** forma del dizionario della locuzione ('' per una parola ripetuta) */
  base: string;
  register: number | null;
  reason?: string;
  note?: string;
  senses: SenseSuggestions[];
  /** ripetizione: l'occorrenza precedente */
  prev?: [number, number];
  /** per "ignora": stesso rilievo nello stesso documento */
  key: string;
  /** per "disattiva questa categoria": style:<motivo>, tone, repetition, variation, synonym */
  category: string;
  /** le alternative vengono dal thesaurus (attribuzione nel pannello) */
  source?: 'thesaurus';
}

export interface AnalyzeOptions {
  tone?: Tone | null;
  /** scarto di registro dal tono del documento oltre cui si segnala (2) */
  tolerance?: number;
  /** finestra delle ripetizioni in parole (50) */
  window?: number;
  /** anche le locuzioni senza problemi, con le loro varianti (domanda su una selezione) */
  variations?: boolean;
  ignore?: Set<string>;
  off?: Set<string>;
  /** ultima posizione nel documento di ogni locuzione (vedi `usage`) */
  lastUse?: Map<string, number>;
}

export interface Engine {
  pack: Pack;
  morph: Morph;
  lex: Lexicon;
  stem: (w: string) => string;
  rules: Record<string, SenseRule>;
  ppSlots: string[];
  slotIndex: Map<string, number>;
  /** articoli delle preposizioni articolate (il, lo, la, l'...) */
  articles: Set<string>;
  /** articoli e preposizioni articolate davanti alle locuzioni nominali */
  dets: Map<string, Det>;
}

export function createEngine(src: string | Pack): Engine {
  const pack = typeof src === 'string' ? parsePack(src) : src;
  const morph = buildMorph(pack);
  return {
    pack,
    morph,
    lex: buildLexicon(pack, morph),
    stem: makeStemmer(pack),
    rules: SENSE_RULES[pack.lang] ?? {},
    ppSlots: morph.slots.filter((s) => s.startsWith('pp')),
    slotIndex: new Map(morph.slots.map((s, i) => [s, i])),
    articles: new Set([...pack.prep.values()].flatMap((m) => [...m.values()])),
    dets: articleIndex(pack),
  };
}

/** Contesto grammaticale della forma trovata, per rigenerare le alternative nella stessa forma. */
interface Ctx {
  slot: string | null;
  person: number | null;
  prev: string | undefined;
  auxSlot: string | null;
  auxText: string | null;
  fem: boolean;
  /** genere noto (dall'ausiliare essere con il participio accordato) */
  femKnown: boolean;
  article: string | null;
  gapText: string | null;
  /** articolo subito dopo il tratto, con la fine nel testo */
  next: { w: string; end: number } | null;
  /** parola subito dopo il tratto */
  after: string | undefined;
  /** articolo davanti a una locuzione nominale, compreso nel tratto ("la chiave di volta") */
  det: Det | null;
  detText: string | null;
}

interface Resolved {
  start: number;
  hit: Hit;
  ctx: Ctx;
  score: number;
}

export function cliticWords(e: Engine, clitic: string, person: number): string[] {
  const cl = e.pack.clitic;
  if (!clitic || !cl) return [];
  if (clitic === 'ne') return ['ne'];
  if (clitic === cl.person[2]) return [cl.person[person - 1]];
  return [cl.beforene[person - 1], 'ne'];
}

function resolve(e: Engine, text: string, tokens: Token[], m: Match, hit: Hit): Resolved | null {
  const { morph, lex } = e;
  let start = m.start;
  let score = 1;
  const nx = tokens[m.end];
  const ctx: Ctx = { slot: hit.slot, person: null, prev: undefined, auxSlot: null, auxText: null, fem: false, femKnown: false, article: hit.article, gapText: null, next: null, after: nx && !nx.brk ? nx.w : undefined, det: null, detText: null };
  if (nx && !nx.brk && hit.article === null && e.articles.has(nx.w)) ctx.next = { w: nx.w, end: nx.end };
  const slot = hit.slot;
  // la k-esima parola prima di `at`, se fra le due non c'e' punteggiatura
  const tokAt = (at: number, k: number) => (at - k >= 0 && !tokens[at - k + 1].brk ? tokens[at - k] : undefined);
  const before = (k: number) => tokAt(start, k);
  // parole del clitico subito prima di `at`: quante sono, o -1 se non ci sono
  const cliticLen = (at: number, p: number): number => {
    const want = cliticWords(e, hit.clitic!, p);
    for (let k = 0; k < want.length; k++) if (tokAt(at, want.length - k)?.w !== want[k]) return -1;
    return want.length;
  };

  if (slot && slot.startsWith('pp')) {
    const idx = e.ppSlots.length === 4 ? e.ppSlots.indexOf(slot) : 0;
    const plural = idx >= 2;
    const a = before(1);
    const cands = a ? lex.aux.get(a.w) : undefined;
    let chosen: { verb: string; slot: string } | undefined;
    for (const c of cands ?? []) {
      const p = morph.personOf(c.slot);
      // il clitico sta prima dell'ausiliare: "mi sono reso conto"
      if (hit.clitic && (!p || cliticLen(start - 1, p) < 0)) continue;
      // con "essere" il participio si accorda: "si sono resi" e' plurale
      if (c.verb !== e.pack.aux.def && p && e.ppSlots.length === 4 && p >= 4 !== plural) continue;
      chosen = c;
      break;
    }
    if (chosen) {
      start--;
      ctx.auxSlot = chosen.slot;
      ctx.auxText = text.slice(tokens[start].start, tokens[start].end);
      ctx.person = morph.personOf(chosen.slot);
      if (chosen.verb !== e.pack.aux.def && e.ppSlots.length === 4) {
        ctx.fem = idx % 2 === 1;
        ctx.femKnown = true;
      }
      score = 2;
    } else if (hit.clitic) return null;
    else score = 0.5;
  } else if (slot) ctx.person = morph.personOf(slot) ?? hit.person;

  if (hit.clitic && ctx.person) {
    const n = cliticLen(start, ctx.person);
    if (n < 0) return null;
    start -= n;
  } else if (hit.clitic) return null;

  // infinito dopo un modale: la persona del modale ("devo capire" -> "devo rendermi conto")
  if ((slot === 'inf' || slot === 'ger') && ctx.person === null) {
    const prev = before(1);
    const p = prev && lex.modal.get(prev.w);
    if (p) ctx.person = p;
  }
  // locuzione nominale: l'articolo (anche articolato) che la precede si accorda all'alternativa
  if (lex.entries[hit.vi].variant.gender) {
    const a = before(1);
    const d = a && e.dets.get(a.w);
    if (d) {
      start--;
      ctx.det = d;
      ctx.detText = text.slice(tokens[start].start, tokens[start].end);
    }
  }
  ctx.prev = before(1)?.w;
  if (m.gap) ctx.gapText = text.slice(tokens[m.gap[0]].start, tokens[m.gap[1] - 1].end);
  return { start, hit, ctx, score };
}

/** Testo dell'alternativa nella forma dell'originale. */
export function realize(e: Engine, target: Variant, ctx: Ctx): { text: string; alt?: string; to?: number } {
  const { morph, pack } = e;
  const [head, ...rest] = target.tokens;
  const split = target.gender ? null : morph.isVerb(head) ? { verb: head, clitic: '' } : morph.splitClitic(head);
  const f = split && ctx.slot ? morph.forms(split.verb) : null;
  let words: string[];
  let altWords: string[] | null = null;
  if (split && f && ctx.slot) {
    const at = (slot: string) => f[e.slotIndex.get(slot)!];
    const person = ctx.person ?? 3;
    if (ctx.auxSlot) {
      const aux = morph.auxOf(split.verb, split.clitic) ?? pack.aux.def!;
      const auxForm = morph.forms(aux)?.[e.slotIndex.get(ctx.auxSlot)!] ?? ctx.auxText ?? '';
      let pp = at(e.ppSlots[0]);
      if (aux !== pack.aux.def && e.ppSlots.length === 4) {
        const plural = person >= 4 ? 2 : 0;
        pp = at(e.ppSlots[(ctx.fem ? 1 : 0) + plural]);
        if (!ctx.femKnown) altWords = [...cliticWords(e, split.clitic, person), auxForm, at(e.ppSlots[1 + plural]), ...rest];
      }
      words = [...cliticWords(e, split.clitic, person), auxForm, pp, ...rest];
    } else if (ctx.slot === 'inf' || ctx.slot === 'ger') {
      const form = at(ctx.slot);
      const cl = split.clitic ? cliticWords(e, split.clitic, person).join('') : '';
      words = [cl ? morph.attach(form, ctx.slot, cl) : form, ...rest];
    } else {
      const form = morph.agree(split.verb, ctx.slot, ctx.prev) ?? at(ctx.slot);
      words = [...cliticWords(e, split.clitic, morph.personOf(ctx.slot) ?? person), form, ...rest];
    }
  } else {
    words = [...target.tokens];
    // l'ausiliare era nel tratto sostituito: resta davanti a un'alternativa senza verbo
    if (ctx.auxText) words.unshift(ctx.auxText);
  }
  let to: number | undefined;
  const finish = (ws: string[]): string => {
    let out = [...ws];
    // vuoto: le parole dell'originale ("take them into account" -> "consider them")
    if (ctx.gapText !== null) {
      const g = out.indexOf('*');
      if (g >= 0) out[g] = ctx.gapText;
      else out.splice(1, 0, ctx.gapText);
    } else out = out.filter((w) => w !== '*');
    // preposizione articolata: "tenere conto della" -> "considerare la"
    if (ctx.article) {
      const last = out[out.length - 1];
      const table = pack.prep.get(last);
      const contracted = table && [...table].find(([, art]) => art === ctx.article)?.[0];
      if (contracted) out[out.length - 1] = contracted;
      else out.push(ctx.article);
    } else if (ctx.article === null && ctx.after && pack.prepDrop.has(ctx.after) && pack.prep.has(out[out.length - 1])) {
      out.pop();
    } else if (ctx.next) {
      // l'alternativa finisce con una preposizione e dopo c'e' un articolo: "di" + "l'" -> "dell'"
      const table = pack.prep.get(out[out.length - 1]);
      const contracted = table && [...table].find(([, art]) => art === ctx.next!.w)?.[0];
      if (contracted) {
        out[out.length - 1] = contracted;
        to = ctx.next.end;
      }
    }
    // con l'elisione "l'" + "accento" si riattaccano
    let s = out.join(' ');
    if (pack.elision) s = s.replace(/(\p{L})' (?=\p{L})/gu, "$1'");
    if (ctx.det) {
      const first = s.split(' ')[0] ?? '';
      const art = target.gender ? determiner(pack, ctx.det, target.gender, first) : null;
      s = joinArticle(art ?? ctx.detText!.toLowerCase(), s);
    }
    return s;
  };
  const text = finish(words);
  const r: { text: string; alt?: string; to?: number } = { text };
  if (altWords) r.alt = finish(altWords);
  if (to !== undefined) r.to = to;
  return r;
}

/** Ultima posizione di ogni locuzione nei testi (blocchi del documento in ordine). */
export function usage(e: Engine, blocks: string[]): Map<string, number> {
  const out = new Map<string, number>();
  let pos = 0;
  for (const b of blocks) {
    for (const m of findMatches(e.lex, tokenize(b, e.pack.elision))) {
      for (const h of m.hits) out.set(e.lex.entries[h.vi].variant.text, pos + m.start);
    }
    pos += b.length + 1;
  }
  return out;
}

const PRIORITY: FindingKind[] = ['style', 'tone', 'repetition', 'variation', 'synonym'];

export function analyze(e: Engine, text: string, opts: AnalyzeOptions = {}): Finding[] {
  const tokens = tokenize(text, e.pack.elision);
  const matches = findMatches(e.lex, tokens);
  const lastUse = opts.lastUse ?? new Map();
  const target = opts.tone ?? null;
  const tolerance = opts.tolerance ?? 2;
  const window = opts.window ?? 50;
  const off = opts.off ?? new Set();
  const ignore = opts.ignore ?? new Set();
  const found = new Map<number, Finding>();
  const covered = new Set<number>();
  const lastSense = new Map<number, { at: number; span: [number, number] }>();
  let paraStart = 0;

  const add = (f: Finding, at: number) => {
    if (off.has(f.category) || off.has(f.kind) || ignore.has(f.key)) return;
    const old = found.get(at);
    if (!old) return void found.set(at, f);
    // "varianti" non e' un motivo: accanto a un problema vero non si dice
    const tags = [...new Set([...old.tags, ...f.tags])].filter((k, _, all) => k !== 'variation' || all.length === 1);
    const first = PRIORITY.indexOf(f.kind) < PRIORITY.indexOf(old.kind) ? f : old;
    found.set(at, { ...first, tags, senses: first.senses.length ? first.senses : f.senses, prev: old.prev ?? f.prev });
  };

  // alternative nella forma dell'originale e con le sue maiuscole
  const suggest = (variants: Variant[], exclude: string, ctx: Ctx, original: string): Ranked<Suggestion>[] =>
    rank(
      variants
        .filter((v) => v.text !== exclude)
        .map((v) => {
          const r = realize(e, v, ctx);
          const s: Suggestion = { text: matchCase(original, r.text), base: v.text, register: v.register, flags: v.flags };
          if (r.alt) s.alt = matchCase(original, r.alt);
          if (r.to !== undefined) s.to = r.to;
          if (v.note) s.note = v.note;
          return s;
        }),
      lastUse,
      target,
    );

  for (const m of matches) {
    if (tokens[m.start].para) {
      lastSense.clear();
      paraStart = m.start;
    }
    // per ogni variante la lettura migliore (participio con ausiliare, clitico presente...)
    const byVariant = new Map<number, Resolved>();
    for (const h of m.hits) {
      const r = resolve(e, text, tokens, m, h);
      if (!r) continue;
      const old = byVariant.get(h.vi);
      if (!old || r.score > old.score) byVariant.set(h.vi, r);
    }
    if (!byVariant.size) continue;
    let resolved = [...byVariant.values()];
    const entryOf = (r: Resolved) => e.lex.entries[r.hit.vi];
    // sensi: se piu' di uno, la regola della locuzione (se c'e') sceglie
    const senseRes = resolved.filter((r) => entryOf(r).sense >= 0);
    if (senseRes.length > 1) {
      const rule = e.rules[entryOf(senseRes[0]).variant.text];
      const name = rule?.(tokens, m.start, m.end);
      const pick = name ? senseRes.filter((r) => e.pack.senses[entryOf(r).sense].name === name) : [];
      if (pick.length) resolved = [...resolved.filter((r) => entryOf(r).sense < 0), ...pick];
    }
    const r0 = resolved.reduce((a, b) => (b.start < a.start ? b : a));
    const start = tokens[r0.start].start;
    const end = tokens[m.end - 1].end;
    const original = text.slice(start, end);
    const base = entryOf(r0).variant.text;
    for (let k = r0.start; k < m.end; k++) covered.add(k);

    // @replace: suggerimento in un senso solo (giri di parole, ridondanze)
    for (const r of resolved.filter((x) => entryOf(x).replace >= 0)) {
      const rep = e.pack.replaces[entryOf(r).replace];
      add(
        {
          kind: 'style',
          tags: ['style'],
          start,
          end,
          original,
          base: rep.from.text,
          register: rep.from.register,
          reason: rep.reason,
          note: rep.from.note,
          senses: [{ sense: '', sections: suggest(rep.to, '', r.ctx, original) }],
          key: `style:${rep.from.text}`,
          category: `style:${rep.reason}`,
        },
        start,
      );
    }

    const senseHits = resolved.filter((x) => entryOf(x).sense >= 0);
    if (!senseHits.length) continue;
    const senses = senseHits.map((r) => {
      const s = e.pack.senses[entryOf(r).sense];
      return { sense: s.name, sections: suggest(s.variants, entryOf(r).variant.text, r.ctx, original) };
    });
    const register = entryOf(senseHits[0]).variant.register;
    const note = entryOf(senseHits[0]).variant.note;
    const common = { start, end, original, base, register, note, senses };

    // ripetizione del gruppo: "therefore" e "thus" vicini contano come la stessa scelta
    for (const r of senseHits) {
      const si = entryOf(r).sense;
      const last = lastSense.get(si);
      if (last && m.start - last.at <= window && m.start >= paraStart) add({ ...common, kind: 'repetition', tags: ['repetition'], prev: last.span, key: `repetition:${base}`, category: 'repetition' }, start);
      lastSense.set(si, { at: m.start, span: [start, end] });
    }

    // tono: scarto dal tono del documento
    if (target && Math.abs(register - toneCenter(target)) >= tolerance) add({ ...common, kind: 'tone', tags: ['tone'], key: `tone:${base}`, category: 'tone' }, start);
    if (opts.variations) add({ ...common, kind: 'variation', tags: ['variation'], key: `variation:${base}`, category: 'variation' }, start);
  }

  // ripetizioni di parole piene (stessa radice) fuori dalle locuzioni
  const seen = new Map<string, number>();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.para) seen.clear();
    // fuori anche le forme di ausiliari e modali ("abbiamo", "devo"): si ripetono per forza
    if (covered.has(i) || t.w.length < 4 || !/^\p{L}+$/u.test(t.w) || e.pack.stopwords.has(t.w) || e.lex.aux.has(t.w) || e.lex.modal.has(t.w)) continue;
    // nomi propri a meta' frase: si ripetono per forza
    const ch = text[t.start];
    if (!t.sent && ch !== ch.toLowerCase()) continue;
    const s = e.stem(t.w);
    const prev = seen.get(s);
    seen.set(s, i);
    if (prev === undefined || i - prev > window) continue;
    const p = tokens[prev];
    add(
      {
        kind: 'repetition',
        tags: ['repetition'],
        start: t.start,
        end: t.end,
        original: text.slice(t.start, t.end),
        base: '',
        register: null,
        senses: [],
        prev: [p.start, p.end],
        key: `repetition:${s}`,
        category: 'repetition',
      },
      t.start,
    );
  }
  return [...found.values()].sort((a, b) => a.start - b.start);
}
