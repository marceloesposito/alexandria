// Confronto leggibile fra due versioni di una pergamena: non righe di Markdown ma blocchi del
// documento (titoli, paragrafi, elenchi...), allineati in due colonne.
import { diffArrays } from 'diff';
import { parseMarkdown } from '../doc/parse';
import { serializeMarkdown } from '../doc/serialize';
import { plainText } from '../doc/counts';
import type { PMNode } from '../doc/types';

export type BlockKind = 'h1' | 'h2' | 'h3' | 'p' | 'quote' | 'list' | 'code' | 'math' | 'figure' | 'embed' | 'table' | 'hr' | 'other';

export interface DocBlock {
  kind: BlockKind;
  /** testo da mostrare (le voci di un elenco una per riga) */
  text: string;
  /** chiave di confronto: il Markdown del blocco */
  key: string;
}

export interface DiffRow {
  kind: 'same' | 'add' | 'del' | 'mod';
  before?: DocBlock;
  after?: DocBlock;
}

function kindOf(n: PMNode): BlockKind {
  switch (n.type) {
    case 'heading': {
      const l = Number(n.attrs?.level ?? 1);
      return l <= 1 ? 'h1' : l === 2 ? 'h2' : 'h3';
    }
    case 'paragraph':
      return 'p';
    case 'blockquote':
      return 'quote';
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return 'list';
    case 'codeBlock':
      return 'code';
    case 'mathBlock':
      return 'math';
    case 'figure':
      return 'figure';
    case 'embed':
      return 'embed';
    case 'table':
      return 'table';
    case 'horizontalRule':
    case 'pageBreak':
      return 'hr';
    default:
      return 'other';
  }
}

function textOf(n: PMNode, kind: BlockKind): string {
  if (kind === 'list') return (n.content ?? []).map((item) => `• ${plainText(item).trim()}`).join('\n');
  if (kind === 'math') return String(n.attrs?.latex ?? '');
  if (kind === 'figure') return String(n.attrs?.caption || n.attrs?.src || '');
  if (kind === 'embed') return String(n.attrs?.title || n.attrs?.url || '');
  if (kind === 'table') return (n.content ?? []).map((r) => (r.content ?? []).map((c) => plainText(c).trim()).join(' · ')).join('\n');
  return plainText(n).trim();
}

/** Blocchi di primo livello del documento, senza quelli vuoti. */
export function docBlocks(md: string): DocBlock[] {
  const doc = parseMarkdown(md);
  return (doc.content ?? [])
    .map((n) => {
      const kind = kindOf(n);
      return { kind, text: textOf(n, kind), key: serializeMarkdown({ type: 'doc', content: [n] }).trim() };
    })
    .filter((b) => b.kind === 'hr' || b.text.trim() !== '');
}

/**
 * Righe allineate fra la versione `before` e quella `after`: blocchi uguali, aggiunti, tolti,
 * e modificati (un blocco tolto seguito da uno aggiunto dello stesso tipo).
 */
export function docDiff(beforeMd: string, afterMd: string): DiffRow[] {
  const a = docBlocks(beforeMd);
  const b = docBlocks(afterMd);
  const parts = diffArrays(
    a.map((x) => x.key),
    b.map((x) => x.key),
  );
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    const n = p.count ?? p.value.length;
    if (!p.added && !p.removed) {
      for (let x = 0; x < n; x++) rows.push({ kind: 'same', before: a[i++], after: b[j++] });
      continue;
    }
    if (p.removed && parts[k + 1]?.added) {
      const m = parts[k + 1].count ?? parts[k + 1].value.length;
      const del = a.slice(i, i + n);
      const add = b.slice(j, j + m);
      i += n;
      j += m;
      k++;
      // a coppie: stesso tipo di blocco = modificato, altrimenti tolto e aggiunto
      const len = Math.max(del.length, add.length);
      for (let x = 0; x < len; x++) {
        const d = del[x];
        const ad = add[x];
        if (d && ad && d.kind === ad.kind) rows.push({ kind: 'mod', before: d, after: ad });
        else {
          if (d) rows.push({ kind: 'del', before: d });
          if (ad) rows.push({ kind: 'add', after: ad });
        }
      }
      continue;
    }
    if (p.removed) for (let x = 0; x < n; x++) rows.push({ kind: 'del', before: a[i++] });
    else for (let x = 0; x < n; x++) rows.push({ kind: 'add', after: b[j++] });
  }
  return rows;
}

/** Quanti blocchi cambiano (per l'intestazione del confronto). */
export function diffCounts(rows: DiffRow[]): { added: number; removed: number; changed: number } {
  return {
    added: rows.filter((r) => r.kind === 'add').length,
    removed: rows.filter((r) => r.kind === 'del').length,
    changed: rows.filter((r) => r.kind === 'mod').length,
  };
}
