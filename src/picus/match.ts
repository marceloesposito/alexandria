// Picus: trie a livello di parola su tutte le forme flesse delle locuzioni del pacchetto. Si
// tokenizza una volta e da ogni parola si scende nel trie tenendo la corrispondenza piu' lunga:
// leftmost-longest e a parole intere per costruzione, senza attraversare la punteggiatura.
import type { Pack, Variant } from './pack';
import type { Morph } from './inflect';
import type { Token } from './tokens';

export interface Hit {
  /** indice in Lexicon.variants */
  vi: number;
  /** slot del verbo iniziale nel testo (null: locuzione senza verbo) */
  slot: string | null;
  /** clitico che deve stare prima del verbo (italiano: "mi rendo conto"), con la persona dello slot */
  clitic: string | null;
  /** articolo della preposizione articolata finale ("della" -> "la"); '' preposizione semplice */
  article: string | null;
  /** persona del clitico attaccato a infinito o gerundio ("rendermi" -> 1) */
  person: number | null;
}

export interface Entry {
  variant: Variant;
  /** gruppo: indice del senso, o -1 per i "da" di @replace */
  sense: number;
  /** per i "da" di @replace: indice in pack.replaces */
  replace: number;
}

interface Node {
  next: Map<string, Node>;
  gap?: Node;
  hits: Hit[];
}

export interface Match {
  start: number;
  /** escluso */
  end: number;
  hits: Hit[];
  /** parole del vuoto "*" (indici di token), se c'e' */
  gap: [number, number] | null;
}

export interface Lexicon {
  entries: Entry[];
  root: Node;
  /** forma del testo -> slot e verbo, per gli ausiliari e i modali (italiano) */
  aux: Map<string, { verb: string; slot: string }[]>;
  modal: Map<string, number>;
}

const node = (): Node => ({ next: new Map(), hits: [] });

function insert(root: Node, tokens: string[], hit: Hit) {
  let n = root;
  for (const t of tokens) {
    if (t === '*') n = n.gap ??= node();
    else {
      let c = n.next.get(t);
      if (!c) n.next.set(t, (c = node()));
      n = c;
    }
  }
  if (!n.hits.some((h) => h.vi === hit.vi && h.slot === hit.slot && h.article === hit.article && h.person === hit.person)) n.hits.push(hit);
}

/** Una locuzione si cerca nel testo se non finisce con un vuoto ("consider *" serve solo come proposta). */
export const matchable = (v: Variant) => v.tokens.length > 0 && v.tokens[v.tokens.length - 1] !== '*' && v.tokens[0] !== '*';

export function buildLexicon(pack: Pack, morph: Morph): Lexicon {
  const entries: Entry[] = [];
  pack.senses.forEach((s, si) => s.variants.forEach((v) => entries.push({ variant: v, sense: si, replace: -1 })));
  pack.replaces.forEach((r, ri) => entries.push({ variant: r.from, sense: -1, replace: ri }));
  const root = node();
  const cl = pack.clitic;

  entries.forEach((e, vi) => {
    const v = e.variant;
    if (!matchable(v)) return;
    const [head, ...rest] = v.tokens;
    // preposizione articolata finale: "tenere conto di" vale anche per del, della, dell'...
    const last = rest.length ? rest[rest.length - 1] : null;
    const preps = last && pack.prep.get(last);
    const tails: [string[], string | null][] = [[rest, last && preps ? '' : null]];
    if (preps) for (const [form, art] of preps) tails.push([[...rest.slice(0, -1), form], art]);

    const add = (first: string, slot: string | null, clitic: string | null, person: number | null) => {
      for (const [tail, article] of tails) insert(root, [first, ...tail], { vi, slot, clitic, article, person });
    };

    const split = morph.isVerb(head) ? { verb: head, clitic: '' } : morph.splitClitic(head);
    const forms = split && morph.forms(split.verb);
    if (!split || !forms) {
      add(head, null, null, null);
      return;
    }
    morph.slots.forEach((slot, i) => {
      const f = forms[i];
      if (!f) return;
      if (!split.clitic || !cl) return add(f, slot, null, null);
      if (slot === 'inf' || slot === 'ger') {
        // clitico attaccato, per ogni persona: rendermi, renderti, rendersi... (ne: tenerne)
        if (split.clitic === 'ne') return add(morph.attach(f, slot, 'ne'), slot, null, null);
        const persons = split.clitic === cl.person[2] ? cl.person : cl.beforene.map((b) => `${b}ne`);
        persons.forEach((pr, p) => add(morph.attach(f, slot, pr), slot, null, p + 1));
        return;
      }
      add(f, slot, split.clitic, null);
    });
  });

  // ausiliari e modali: forma -> slot (per "ho preso", "mi sono reso", "devo rendermi")
  const aux = new Map<string, { verb: string; slot: string }[]>();
  const auxVerbs = pack.aux.def ? [pack.aux.def, ...pack.aux.others.keys()] : [];
  for (const a of auxVerbs) {
    const f = morph.forms(a);
    f?.forEach((form, i) => {
      const slot = morph.slots[i];
      // solo le forme finite: non il participio, l'infinito o il gerundio
      if (form && !/^(pp|inf$|ger$|ing$)/.test(slot)) aux.set(form, [...(aux.get(form) ?? []), { verb: a, slot }]);
    });
  }
  const modal = new Map<string, number>();
  for (const m of cl?.modals ?? []) {
    morph.forms(m)?.forEach((form, i) => {
      const slot = morph.slots[i];
      const p = morph.personOf(slot);
      if (form && p && !slot.startsWith('pp') && !modal.has(form)) modal.set(form, p);
    });
  }
  return { entries, root, aux, modal };
}

const MAX_GAP = 3;

/** Corrispondenze leftmost-longest nella sequenza di parole. */
export function findMatches(lex: Lexicon, tokens: Token[]): Match[] {
  const out: Match[] = [];
  let i = 0;
  while (i < tokens.length) {
    let best: Match | null = null;
    const walk = (n: Node, j: number, gap: [number, number] | null) => {
      if (n.hits.length && j > i && (!best || j > best.end)) best = { start: i, end: j, hits: n.hits, gap };
      if (j >= tokens.length || (j > i && tokens[j].brk)) return;
      const c = n.next.get(tokens[j].w);
      if (c) walk(c, j + 1, gap);
      if (n.gap && j > i) {
        for (let k = j + 1; k <= Math.min(j + MAX_GAP, tokens.length); k++) {
          if (k > j + 1 && tokens[k - 1].brk) break;
          walk(n.gap, k, [j, k]);
        }
      }
    };
    walk(lex.root, i, null);
    if (best) {
      out.push(best);
      i = (best as Match).end;
    } else i++;
  }
  return out;
}
