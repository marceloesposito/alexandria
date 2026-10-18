// Picus: stemmer generico guidato dai dati del pacchetto (@stem), sul modello di Snowball: regioni
// R1/R2/RV fissate sulla parola iniziale, passi in cui si sceglie il suffisso piu' lungo e lo si
// toglie solo se rispetta regione e condizioni. Serve a riconoscere le ripetizioni (argue, argued,
// arguing), non a fare linguistica: le differenze con Snowball si mettono fra le eccezioni.
import type { Pack, StemData, StemRule } from './pack';

interface Ctx {
  v: (c: string | undefined) => boolean;
  r1: number;
  r2: number;
  rv: number;
}

function regionAfter(w: string, from: number, v: Ctx['v']): number {
  for (let i = from + 1; i < w.length; i++) if (!v(w[i]) && v(w[i - 1])) return i + 1;
  return w.length;
}

function regions(w: string, st: StemData, v: Ctx['v']): Omit<Ctx, 'v'> {
  const pre = st.r1prefix.find((p) => w.startsWith(p));
  const r1 = pre ? pre.length : regionAfter(w, 0, v);
  const r2 = regionAfter(w, r1, v);
  let rv = w.length;
  if (st.rv && w.length > 2) {
    if (!v(w[1])) {
      for (let i = 2; i < w.length; i++) if (v(w[i])) { rv = i + 1; break; }
    } else if (v(w[0])) {
      for (let i = 2; i < w.length; i++) if (!v(w[i])) { rv = i + 1; break; }
    } else rv = 3;
  }
  return { r1, r2, rv };
}

/** sillaba breve in fondo (Porter2): consonante, vocale, consonante non w/x/Y; o vocale+consonante a inizio */
function endsShort(w: string, v: Ctx['v']): boolean {
  const n = w.length;
  if (n === 2) return v(w[0]) && !v(w[1]);
  return n > 2 && !v(w[n - 3]) && v(w[n - 2]) && !v(w[n - 1]) && !'wxY'.includes(w[n - 1]);
}

function holds(r: StemRule, w: string, at: number, c: Ctx): boolean {
  if (r.region && at < c[r.region]) return false;
  const stem = w.slice(0, at);
  const k = r.conds;
  if (k.min !== undefined && stem.length < k.min) return false;
  if (k.v && ![...stem].some(c.v)) return false;
  if (k.vnb && ![...stem.slice(0, -1)].some(c.v)) return false;
  if (k.pre !== undefined && !(stem && k.pre.includes(stem[stem.length - 1]))) return false;
  if (k.npre !== undefined && (!stem || k.npre.includes(stem[stem.length - 1]))) return false;
  // la parte che precede deve stare anche lei nella regione (Snowball: "parlarne", non "alzarsi")
  if (k.prestr && !k.prestr.some((p) => stem.endsWith(p) && (!r.region || at - p.length >= c[r.region]))) return false;
  if (k.nshort && endsShort(stem, c.v)) return false;
  return true;
}

function longest(w: string, suffixes: string[], from = 0): string | null {
  let best: string | null = null;
  for (const s of suffixes) if (w.endsWith(s) && w.length - s.length >= from && (!best || s.length > best.length)) best = s;
  return best;
}

function mark(w: string, st: StemData, v: Ctx['v']): string {
  if (!st.marks.length) return w;
  const a = [...w];
  for (const m of st.marks) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== m.ch) continue;
      const ok = m.ctx.split(',').some((ctx) => {
        if (ctx === '*') return true;
        if (ctx === 'initial') return i === 0;
        if (ctx === 'after-vowel') return i > 0 && v(a[i - 1]);
        if (ctx === 'between-vowels') return i > 0 && i < a.length - 1 && v(a[i - 1]) && v(a[i + 1]);
        if (ctx.startsWith('after=')) return i > 0 && ctx.slice(6).includes(a[i - 1]);
        return false;
      });
      if (ok) a[i] = m.to;
    }
  }
  return a.join('');
}

/** Stemmer del pacchetto, con una cache: nello stesso documento le parole si ripetono. */
export function makeStemmer(pack: Pack): (word: string) => string {
  const st = pack.stem;
  const vowels = pack.vowels;
  const v = (c: string | undefined) => !!c && vowels.includes(c);
  const cache = new Map<string, string>();
  return (word) => {
    const hit = cache.get(word);
    if (hit !== undefined) return hit;
    let w = word.replace(/^'+/, '');
    const exc = st.exceptions.get(w);
    if (exc !== undefined || w.length <= 2 || !st.steps.length) {
      const out = exc ?? w;
      cache.set(word, out);
      return out;
    }
    w = mark(w, st, v);
    const c: Ctx = { v, ...regions(w, st, v) };
    let changed = true;
    for (const step of st.steps) {
      if (step.ifnone && changed) {
        changed = false;
        continue;
      }
      changed = false;
      const suff = longest(
        w,
        step.rules.flatMap((r) => r.suffixes),
        step.limit ? c[step.limit] : 0,
      );
      if (suff === null) continue;
      const at = w.length - suff.length;
      const rule = step.rules.find((r) => r.suffixes.includes(suff) && holds(r, w, at, c));
      if (!rule || rule.repl === '=') continue;
      w = w.slice(0, at) + (rule.repl ?? '');
      changed = true;
      if (rule.fix) {
        if (st.fixe.some((f) => w.endsWith(f))) w += 'e';
        else if (st.undouble.some((d) => w.endsWith(d))) w = w.slice(0, -1);
        else if (c.r1 >= w.length && endsShort(w, v)) w += 'e';
      }
      if (rule.then) {
        // la catena che comincia con il suffisso piu' lungo; ogni anello solo se c'e' ed e' nella regione
        const { chains, region } = rule.then;
        const first = longest(
          w,
          chains.map((ch) => ch[0]),
        );
        for (const t of chains.find((ch) => ch[0] === first) ?? []) {
          if (!w.endsWith(t) || (region && w.length - t.length < c[region])) break;
          w = w.slice(0, -t.length);
        }
      }
    }
    const out = w.toLowerCase();
    cache.set(word, out);
    return out;
  };
}
