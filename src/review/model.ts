// Risposta ai revisori: i punti di una revisione (dalla lettera della rivista o dai commenti), la
// risposta dell'autore, le versioni del Palimpsestus che li risolvono; la lettera di risposta e la
// versione con le modifiche evidenziate. Funzioni pure.
import { diffWordsWithSpace } from 'diff';
import type { DiffRow } from '../versions/docDiff';

export type ItemStatus = 'todo' | 'done' | 'declined';

export interface ReviewItem {
  id: string;
  reviewer: string;
  text: string;
  response: string;
  status: ItemStatus;
  /** pergamena e commento da cui viene il punto (se arriva dai Marginalia) */
  source?: { rel: string; commentId: string };
  commits: string[];
}

export interface ReviewRound {
  version: 1;
  id: string;
  name: string;
  created: string;
  /** versione di partenza: la "versione con modifiche evidenziate" confronta da qui */
  baseSha: string | null;
  items: ReviewItem[];
}

let n = 0;
export const newItemId = () => `i${Date.now().toString(36)}${(++n).toString(36)}`;

// punti numerati o elenchi: "1.", "1)", "R1.2", "Comment 3:", "Punto 2 -", "- ", "• "
const ITEM_START = /^\s*(?:(?:R(?:eviewer)?\s*\d+[.:]?\s*)?(?:comment|commento|point|punto|issue|osservazione)?\s*\d+(?:\.\d+)*[.):-]\s+|[-•*]\s+)/i;
const REVIEWER_HEAD = /^\s*(?:reviewer|revisore|referee)\s*#?\s*(\d+|[A-Z])\b[^\n]*$/i;

/**
 * Divide la lettera dei revisori in punti: le righe "Reviewer 1"/"Revisore 2" cambiano revisore,
 * i punti numerati o puntati aprono un punto nuovo; senza numerazione vale un punto per paragrafo.
 */
export function splitLetter(letter: string, defaultReviewer = 'Reviewer 1'): { reviewer: string; text: string }[] {
  const lines = letter.replace(/\r\n?/g, '\n').split('\n');
  const numbered = lines.some((l) => ITEM_START.test(l));
  const out: { reviewer: string; text: string }[] = [];
  let reviewer = defaultReviewer;
  let cur: string[] = [];
  const flush = () => {
    const text = cur.join('\n').trim();
    if (text) out.push({ reviewer, text });
    cur = [];
  };
  for (const line of lines) {
    const head = REVIEWER_HEAD.exec(line);
    if (head) {
      flush();
      reviewer = line.trim().replace(/[:.]+$/, '');
      continue;
    }
    if (numbered ? ITEM_START.test(line) : !line.trim()) flush();
    if (line.trim()) cur.push(numbered ? line.replace(ITEM_START, '') : line);
  }
  flush();
  return out;
}

const esc = (s: string) => s.replace(/[\\`*_[\]<>#|~$]/g, (c) => `\\${c}`);
const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function tag(kind: 'ins' | 'del', text: string, author: string, date: string): string {
  if (!text) return '';
  return `<${kind} data-author="${attr(author)}" data-date="${date}">${esc(text)}</${kind}>`;
}

function prefixOf(kind: string): string {
  return kind === 'h1' ? '# ' : kind === 'h2' ? '## ' : kind === 'h3' ? '### ' : kind === 'quote' ? '> ' : '';
}

/**
 * Versione con le modifiche evidenziate: il confronto per blocchi (docDiff) diventa Markdown con
 * <ins>/<del>; nei blocchi cambiati il confronto è per parole.
 */
export function changesMarkdown(rows: DiffRow[], author: string, date: string): string {
  const out: string[] = [];
  for (const r of rows) {
    if (r.kind === 'same' && r.after) out.push(r.after.key);
    else if (r.kind === 'add' && r.after) out.push(['p', 'h1', 'h2', 'h3', 'quote'].includes(r.after.kind) ? prefixOf(r.after.kind) + tag('ins', r.after.text, author, date) : r.after.key);
    else if (r.kind === 'del' && r.before && ['p', 'h1', 'h2', 'h3', 'quote', 'list'].includes(r.before.kind)) out.push(prefixOf(r.before.kind) + tag('del', r.before.text, author, date));
    else if (r.kind === 'mod' && r.before && r.after) {
      const parts = diffWordsWithSpace(r.before.text, r.after.text)
        .map((p) => (p.added ? tag('ins', p.value, author, date) : p.removed ? tag('del', p.value, author, date) : esc(p.value)))
        .join('');
      out.push(prefixOf(r.after.kind) + parts);
    }
  }
  return out.join('\n\n') + '\n';
}

/** Lettera di risposta in Markdown: per ogni revisore, punto citato, risposta e modifiche fatte. */
export function responseLetter(round: ReviewRound, labels: { title: string; response: string; changes: string; declined: string }, commitLabel: (sha: string) => string): string {
  const out: string[] = [`# ${esc(labels.title)}`];
  const reviewers = [...new Set(round.items.map((i) => i.reviewer))];
  for (const rv of reviewers) {
    out.push(`## ${esc(rv)}`);
    round.items
      .filter((i) => i.reviewer === rv)
      .forEach((i, k) => {
        out.push(i.text.split('\n').map((l, j) => `> ${j === 0 ? `**${k + 1}.** ` : ''}${esc(l)}`).join('\n'));
        out.push(`**${esc(labels.response)}** ${esc(i.response || (i.status === 'declined' ? labels.declined : '—'))}`);
        if (i.commits.length) out.push(`*${esc(labels.changes)}* ${i.commits.map((c) => esc(commitLabel(c))).join('; ')}`);
      });
  }
  return out.join('\n\n') + '\n';
}

export function normalizeRound(raw: unknown): ReviewRound | null {
  const r = raw as Partial<ReviewRound> | null;
  if (!r || typeof r.id !== 'string' || !Array.isArray(r.items)) return null;
  return {
    version: 1,
    id: r.id,
    name: String(r.name ?? ''),
    created: String(r.created ?? ''),
    baseSha: typeof r.baseSha === 'string' ? r.baseSha : null,
    items: r.items
      .filter((i) => i && typeof i.id === 'string')
      .map((i) => ({
        id: i.id,
        reviewer: String(i.reviewer ?? ''),
        text: String(i.text ?? ''),
        response: String(i.response ?? ''),
        status: i.status === 'done' || i.status === 'declined' ? i.status : 'todo',
        ...(i.source && typeof i.source.rel === 'string' ? { source: { rel: i.source.rel, commentId: String(i.source.commentId) } } : {}),
        commits: Array.isArray(i.commits) ? i.commits.filter((c): c is string => typeof c === 'string') : [],
      })),
  };
}
