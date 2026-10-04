// Commenti a margine: modello, ancore e disposizione delle bolle. Funzioni pure.

export interface Anchor {
  /** 'line' = commento sulla riga cliccata; 'text' = collegato a una parola o a una selezione */
  kind: 'line' | 'text';
  from: number;
  to: number;
  quote: string;
  prefix: string;
  suffix: string;
}

export interface Reply {
  id: string;
  author: string;
  body: string;
  created: string;
}

export interface Comment {
  id: string;
  author: string;
  body: string;
  created: string;
  updated?: string;
  anchor: Anchor | null; // null = orfano
  /** posizione libera nella colonna dopo il collegamento (px rispetto alla pagina / alla colonna) */
  offsetY: number | null;
  offsetX: number | null;
  resolved: boolean;
  replies: Reply[];
}

export interface CommentsFile {
  version: 1;
  comments: Comment[];
}

export const CONTEXT = 32;

let n = 0;
export function newCommentId(): string {
  n += 1;
  return `c${Date.now().toString(36)}${n.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeCommentsFile(raw: unknown): CommentsFile {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as CommentsFile).comments)) return { version: 1, comments: [] };
  const comments = (raw as CommentsFile).comments
    .filter((c) => c && typeof c.id === 'string')
    .map((c) => ({
      id: c.id,
      author: String(c.author ?? ''),
      body: String(c.body ?? ''),
      created: String(c.created ?? new Date(0).toISOString()),
      updated: c.updated,
      anchor: c.anchor ?? null,
      offsetY: typeof c.offsetY === 'number' ? c.offsetY : null,
      offsetX: typeof c.offsetX === 'number' ? c.offsetX : null,
      resolved: !!c.resolved,
      replies: Array.isArray(c.replies) ? c.replies : [],
    }));
  return { version: 1, comments };
}

// ---------------------------------------------------------------- testo piatto del documento

/** Testo del documento con la mappa indice -> posizione ProseMirror (blocchi separati da \n). */
export interface FlatText {
  text: string;
  map: number[]; // map[i] = posizione del carattere i
}

/** Posizione ProseMirror -> indice nel testo piatto (il primo carattere a quella posizione o dopo). */
export function indexOfPos(flat: FlatText, pos: number): number {
  let lo = 0;
  let hi = flat.map.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (flat.map[mid] < pos) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function makeAnchor(flat: FlatText, from: number, to: number, kind: Anchor['kind']): Anchor {
  const a = indexOfPos(flat, from);
  const b = indexOfPos(flat, to);
  return {
    kind,
    from,
    to,
    quote: flat.text.slice(a, b),
    prefix: flat.text.slice(Math.max(0, a - CONTEXT), a),
    suffix: flat.text.slice(b, b + CONTEXT),
  };
}

function commonSuffixLen(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

function commonPrefixLen(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Ritrova un'ancora in un testo cambiato (stile W3C TextQuoteSelector):
 * 1) citazione esatta: fra le occorrenze vince quella con piu' contesto uguale, poi la piu' vicina;
 * 2) senza citazione esatta: il tratto fra prefisso e suffisso, se entrambi si ritrovano vicini;
 * altrimenti null (commento orfano).
 */
export function reanchor(flat: FlatText, anchor: Anchor): { from: number; to: number } | null {
  const { text, map } = flat;
  const toPos = (a: number, b: number) => ({
    from: map[a] ?? (map.length ? map[map.length - 1] + 1 : 0),
    to: b > a ? map[b - 1] + 1 : map[a] ?? 0,
  });
  if (anchor.quote) {
    const hits: number[] = [];
    let i = text.indexOf(anchor.quote);
    while (i >= 0 && hits.length < 500) {
      hits.push(i);
      i = text.indexOf(anchor.quote, i + 1);
    }
    if (hits.length) {
      const expected = indexOfPos(flat, anchor.from);
      let best = hits[0];
      let bestScore = -Infinity;
      for (const h of hits) {
        const ctx =
          commonSuffixLen(text.slice(Math.max(0, h - CONTEXT), h), anchor.prefix) +
          commonPrefixLen(text.slice(h + anchor.quote.length, h + anchor.quote.length + CONTEXT), anchor.suffix);
        const score = ctx * 1000 - Math.abs(h - expected) / 1000;
        if (score > bestScore) {
          bestScore = score;
          best = h;
        }
      }
      return toPos(best, best + anchor.quote.length);
    }
  }
  // il testo citato e' cambiato: si cerca fra prefisso e suffisso
  const pre = anchor.prefix.slice(-Math.min(16, anchor.prefix.length));
  const suf = anchor.suffix.slice(0, Math.min(16, anchor.suffix.length));
  if (pre.length >= 6 && suf.length >= 6) {
    let p = text.indexOf(pre);
    while (p >= 0) {
      const start = p + pre.length;
      const s = text.indexOf(suf, start);
      const maxLen = Math.max(40, anchor.quote.length * 3);
      if (s >= 0 && s - start <= maxLen && s > start) return toPos(start, s);
      p = text.indexOf(pre, p + 1);
    }
  }
  return null;
}

// ---------------------------------------------------------------- parole

const WORD_CHAR = /[\p{L}\p{N}_'’-]/u;

/** Estremi della parola che contiene l'indice i del testo (o null se i e' su uno spazio). */
export function wordAt(text: string, i: number): { start: number; end: number } | null {
  if (i < 0 || i > text.length) return null;
  let s = i;
  let e = i;
  if (!WORD_CHAR.test(text[i] ?? '') && i > 0 && WORD_CHAR.test(text[i - 1])) {
    s = i - 1;
    e = i - 1;
  }
  if (!WORD_CHAR.test(text[s] ?? '')) return null;
  while (s > 0 && WORD_CHAR.test(text[s - 1])) s--;
  while (e < text.length && WORD_CHAR.test(text[e])) e++;
  return { start: s, end: e };
}

// ---------------------------------------------------------------- disposizione delle bolle

export interface BubbleIn {
  id: string;
  /** y desiderata (allineata all'ancora) */
  y: number;
  height: number;
  /** posizione scelta dall'utente: non si sposta */
  pinned: boolean;
}

/**
 * Le bolle non si sovrappongono: in ordine di y, ognuna scende sotto la precedente.
 * Quelle spostate a mano restano dove sono e le altre le aggirano.
 */
export function layoutBubbles(items: BubbleIn[], gap = 8): Map<string, number> {
  const out = new Map<string, number>();
  const fixed = items.filter((b) => b.pinned).sort((a, b) => a.y - b.y);
  fixed.forEach((b) => out.set(b.id, b.y));
  const free = items.filter((b) => !b.pinned).sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  let cursor = -Infinity;
  for (const b of free) {
    let y = Math.max(b.y, cursor);
    // salta le bolle fisse che si sovrapporrebbero
    let moved = true;
    while (moved) {
      moved = false;
      for (const f of fixed) {
        const fy = out.get(f.id)!;
        if (y < fy + f.height + gap && y + b.height + gap > fy) {
          y = fy + f.height + gap;
          moved = true;
        }
      }
    }
    out.set(b.id, y);
    cursor = y + b.height + gap;
  }
  return out;
}

export function matchesQuery(c: Comment, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    c.body.toLowerCase().includes(s) ||
    c.author.toLowerCase().includes(s) ||
    (c.anchor?.quote.toLowerCase().includes(s) ?? false) ||
    c.replies.some((r) => r.body.toLowerCase().includes(s))
  );
}
