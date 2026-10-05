// Revisione arrivata da Word: dal .docx del relatore si leggono le revisioni tracciate (w:ins, w:del)
// e i commenti (word/comments.xml), poi si ritrovano nel testo della pergamena con il contesto.
// Lettura e ricerca sono funzioni pure; l'applicazione all'editor sta in revision/word.ts.
import { DOMParser, type Element as XmlElement } from '@xmldom/xmldom';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface WordRun {
  text: string;
  kind: 'normal' | 'ins' | 'del';
  author?: string;
  date?: string;
  /** commenti il cui intervallo copre questo pezzo */
  comments: string[];
}

export interface WordComment {
  id: string;
  author: string;
  date: string;
  text: string;
}

export interface WordReview {
  paragraphs: WordRun[][];
  comments: WordComment[];
}

type El = XmlElement;

function children(el: El, local?: string): El[] {
  const out: El[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (!local || (n as unknown as El).localName === local)) out.push(n as unknown as El);
  return out;
}

const attr = (el: El, name: string) => el.getAttributeNS(W, name) ?? el.getAttribute(`w:${name}`) ?? '';

/** Testo di un run: w:t, w:delText, tabulazioni e a capo. */
function runText(r: El): string {
  let s = '';
  for (const c of children(r)) {
    if (c.localName === 't' || c.localName === 'delText') s += c.textContent ?? '';
    else if (c.localName === 'tab') s += '\t';
    else if (c.localName === 'br' || c.localName === 'cr') s += '\n';
  }
  return s;
}

export function parseWordReview(documentXml: string, commentsXml?: string | null): WordReview {
  const doc = new DOMParser().parseFromString(documentXml, 'text/xml');
  const paragraphs: WordRun[][] = [];
  const open = new Set<string>();
  const walk = (el: El, kind: WordRun['kind'], author: string | undefined, date: string | undefined, out: WordRun[]) => {
    for (const c of children(el)) {
      switch (c.localName) {
        case 'r': {
          const text = runText(c);
          if (!text) break;
          const last = out[out.length - 1];
          const comments = [...open];
          if (last && last.kind === kind && last.author === author && last.comments.join() === comments.join()) last.text += text;
          else out.push({ text, kind, ...(author ? { author } : {}), ...(date ? { date } : {}), comments });
          break;
        }
        case 'ins':
        case 'del':
          walk(c, c.localName, attr(c, 'author') || undefined, attr(c, 'date').slice(0, 10) || undefined, out);
          break;
        case 'commentRangeStart':
          open.add(attr(c, 'id'));
          break;
        case 'commentRangeEnd':
          open.delete(attr(c, 'id'));
          break;
        case 'hyperlink':
        case 'smartTag':
        case 'sdt':
        case 'sdtContent':
        case 'fldSimple':
          walk(c, kind, author, date, out);
          break;
        default:
          break;
      }
    }
  };
  const body = doc.getElementsByTagNameNS(W, 'body')[0] as El | undefined;
  const paras = body ? Array.from(body.getElementsByTagNameNS(W, 'p')) : [];
  for (const p of paras as El[]) {
    const runs: WordRun[] = [];
    walk(p, 'normal', undefined, undefined, runs);
    paragraphs.push(runs);
  }
  const comments: WordComment[] = [];
  if (commentsXml) {
    const cdoc = new DOMParser().parseFromString(commentsXml, 'text/xml');
    for (const c of Array.from(cdoc.getElementsByTagNameNS(W, 'comment')) as El[]) {
      const text = (Array.from(c.getElementsByTagNameNS(W, 'p')) as El[])
        .map((p) => (Array.from(p.getElementsByTagNameNS(W, 't')) as El[]).map((t) => t.textContent ?? '').join(''))
        .join('\n')
        .trim();
      comments.push({ id: attr(c, 'id'), author: attr(c, 'author'), date: attr(c, 'date').slice(0, 10), text });
    }
  }
  return { paragraphs, comments };
}

// ---------------------------------------------------------------- ricerca nel testo della pergamena

const CTX = 40;

function suffixMatch(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

function prefixMatch(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

const norm = (s: string) => s.replace(/\s+/g, ' ');

/**
 * Ritrova nel testo un pezzo (quote) con il suo contesto. Con quote vuota cerca il punto fra
 * prefisso e suffisso (un inserimento). Restituisce indici nel testo o null.
 */
export function locate(text: string, prefix: string, quote: string, suffix: string): [number, number] | null {
  const t = text;
  if (quote) {
    let best: number | null = null;
    let bestScore = -1;
    for (let i = t.indexOf(quote); i >= 0; i = t.indexOf(quote, i + 1)) {
      const score = suffixMatch(t.slice(Math.max(0, i - CTX), i), prefix) + prefixMatch(t.slice(i + quote.length, i + quote.length + CTX), suffix);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best === null) return null;
    // una parola corta senza contesto uguale è troppo ambigua
    if (quote.length < 12 && (prefix || suffix) && bestScore < Math.min(4, prefix.length + suffix.length)) return null;
    return [best, best + quote.length];
  }
  const p = prefix.slice(-CTX);
  const s = suffix.slice(0, CTX);
  let best: number | null = null;
  let bestScore = 0;
  const tryAt = (i: number) => {
    const score = suffixMatch(t.slice(Math.max(0, i - CTX), i), p) + prefixMatch(t.slice(i, i + CTX), s);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  };
  const tail = p.slice(-12);
  if (tail) for (let i = t.indexOf(tail); i >= 0; i = t.indexOf(tail, i + 1)) tryAt(i + tail.length);
  const head = s.slice(0, 12);
  if (head) for (let i = t.indexOf(head); i >= 0; i = t.indexOf(head, i + 1)) tryAt(i);
  return best !== null && bestScore >= Math.min(8, p.length + s.length) ? [best, best] : null;
}

export interface PlannedChange {
  kind: 'insertion' | 'deletion';
  /** indici nel testo della pergamena */
  at: [number, number];
  text: string;
  author: string;
  date: string;
}

export interface PlannedComment {
  at: [number, number] | null;
  quote: string;
  comment: WordComment;
}

export interface ReviewPlan {
  changes: PlannedChange[];
  comments: PlannedComment[];
  /** revisioni che non si sono ritrovate nel testo */
  missed: { kind: 'insertion' | 'deletion'; text: string; author: string; context: string }[];
}

/**
 * Confronta il testo della pergamena con il .docx: il testo "originale" di ogni paragrafo (parti
 * normali e cancellate) dà il contesto per ritrovare ogni revisione e ogni commento.
 */
export function planReview(text: string, review: WordReview, fallbackAuthor = 'Word'): ReviewPlan {
  const plan: ReviewPlan = { changes: [], comments: [], missed: [] };
  const commentQuotes = new Map<string, { before: string; quote: string; after: string | null }>();
  for (const runs of review.paragraphs) {
    const orig = runs.filter((r) => r.kind !== 'ins');
    const originalText = orig.map((r) => r.text).join('');
    let offset = 0;
    for (const r of runs) {
      const before = norm(originalText.slice(0, offset));
      if (r.kind === 'del' || r.kind === 'ins') {
        const after = norm(originalText.slice(offset + (r.kind === 'del' ? r.text.length : 0)));
        const at = locate(text, before, r.kind === 'del' ? r.text : '', after);
        const kind = r.kind === 'del' ? 'deletion' : 'insertion';
        if (at) plan.changes.push({ kind, at, text: r.text, author: r.author || fallbackAuthor, date: r.date || '' });
        else plan.missed.push({ kind, text: r.text, author: r.author || fallbackAuthor, context: before.slice(-40) });
      }
      for (const id of r.comments) {
        if (r.kind === 'ins') continue;
        const q = commentQuotes.get(id);
        if (q && q.after === null) q.quote += r.text;
        else if (!q) commentQuotes.set(id, { before, quote: r.text, after: null });
      }
      // il contesto dopo il commento: il resto del paragrafo
      for (const [id, q] of commentQuotes) if (!r.comments.includes(id) && q.after === null) q.after = norm(originalText.slice(offset));
      if (r.kind !== 'ins') offset += r.text.length;
    }
  }
  for (const c of review.comments) {
    const q = commentQuotes.get(c.id);
    const at = q ? locate(text, q.before, q.quote, q.after ?? '') : null;
    plan.comments.push({ at, quote: q?.quote ?? '', comment: c });
  }
  // dalla fine all'inizio, così si applicano senza spostare le posizioni successive
  plan.changes.sort((a, b) => b.at[0] - a.at[0]);
  return plan;
}
