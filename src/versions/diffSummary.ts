// Riassunti deterministici delle modifiche fra due versioni: righe aggiunte/rimosse/modificate,
// estratto breve e messaggio di commit suggerito.
import { diffLines } from 'diff';
import type { FileChange } from '../platform/types';
import { t, tn } from '../i18n';
import { docsDir, resDir, isDocPath } from '../vault/paths';

export interface LineStats {
  added: number;
  removed: number;
  modified: number;
  /** prime righe aggiunte o modificate (testo leggibile) */
  samples: string[];
}

/** Toglie la sintassi Markdown piu' visibile per gli estratti. */
export function plainLine(s: string): string {
  return s
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '')
    .replace(/^>\s?/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)(\{[^}]*\})?/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|~~|`)/g, '')
    .replace(/<!--.*?-->/g, '')
    .replace(/<\/?(u|mark|sub|sup)>/g, '')
    .replace(/\\(.)/g, '$1')
    .trim();
}

/** Righe non vuote: i paragrafi del Markdown sono una riga ciascuno. */
export function lineStats(before: string | null, after: string | null): LineStats {
  const parts = diffLines(before ?? '', after ?? '');
  const out: LineStats = { added: 0, removed: 0, modified: 0, samples: [] };
  const count = (v: string) => v.split('\n').filter((l) => l.trim()).length;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.removed && parts[i + 1]?.added) {
      const r = count(p.value);
      const a = count(parts[i + 1].value);
      const m = Math.min(r, a);
      out.modified += m;
      out.removed += r - m;
      out.added += a - m;
      pushSamples(out, parts[i + 1].value);
      i++;
    } else if (p.added) {
      out.added += count(p.value);
      pushSamples(out, p.value);
    } else if (p.removed) {
      out.removed += count(p.value);
    }
  }
  return out;
}

function pushSamples(out: LineStats, value: string) {
  for (const l of value.split('\n')) {
    if (out.samples.length >= 3) return;
    const p = plainLine(l);
    if (p) out.samples.push(p);
  }
}

export interface DocSummary {
  path: string;
  title: string;
  status: FileChange['status'];
  stats: LineStats;
  citationsDelta: number;
}

export interface ChangeSummary {
  docs: DocSummary[];
  added: number;
  removed: number;
  modified: number;
  commentsDelta: number;
  resourcesAdded: number;
  resourcesRemoved: number;
  otherFiles: number;
  excerpt: string;
}

const CITE_RE = /\[[^\]]*@[\p{L}\p{N}_]/gu;

function countMatches(s: string | null, re: RegExp): number {
  return s ? (s.match(re)?.length ?? 0) : 0;
}

function commentsCount(s: string | null): number {
  if (!s) return 0;
  try {
    const j = JSON.parse(s) as { comments?: unknown[] };
    return Array.isArray(j.comments) ? j.comments.length : 0;
  } catch {
    return 0;
  }
}

export function docTitle(path: string): string {
  const prefix = docsDir() + '/';
  return (path.startsWith(prefix) ? path.slice(prefix.length) : path).replace(/\.md$/i, '');
}

export function summarize(changes: FileChange[]): ChangeSummary {
  const s: ChangeSummary = {
    docs: [],
    added: 0,
    removed: 0,
    modified: 0,
    commentsDelta: 0,
    resourcesAdded: 0,
    resourcesRemoved: 0,
    otherFiles: 0,
    excerpt: '',
  };
  for (const c of changes) {
    const res = resDir() + '/';
    if (isDocPath(c.path) && !c.binary) {
      const stats = lineStats(c.before, c.after);
      s.docs.push({
        path: c.path,
        title: docTitle(c.path),
        status: c.status,
        stats,
        citationsDelta: countMatches(c.after, CITE_RE) - countMatches(c.before, CITE_RE),
      });
      s.added += stats.added;
      s.removed += stats.removed;
      s.modified += stats.modified;
      if (!s.excerpt && stats.samples.length) s.excerpt = stats.samples[0];
    } else if (/^\.alexandria\/comments\//.test(c.path)) {
      s.commentsDelta += commentsCount(c.after) - commentsCount(c.before);
    } else if (c.path.startsWith(res) && /^[^/]+\/meta\.json$/.test(c.path.slice(res.length))) {
      if (c.status === 'added') s.resourcesAdded++;
      else if (c.status === 'deleted') s.resourcesRemoved++;
    } else if (!c.path.startsWith(res)) {
      s.otherFiles++;
    }
  }
  if (s.excerpt.length > 90) s.excerpt = s.excerpt.slice(0, 89).trimEnd() + '…';
  return s;
}

/** "3 righe aggiunte, 1 modificata, 2 rimosse: «estratto…»" */
export function describeSummary(s: ChangeSummary): string {
  const parts: string[] = [];
  if (s.added) parts.push(tn('vc.sum.added', s.added));
  if (s.modified) parts.push(tn('vc.sum.modified', s.modified));
  if (s.removed) parts.push(tn('vc.sum.removed', s.removed));
  if (s.commentsDelta > 0) parts.push(tn('vc.sum.commentsAdded', s.commentsDelta));
  if (s.commentsDelta < 0) parts.push(tn('vc.sum.commentsRemoved', -s.commentsDelta));
  if (s.resourcesAdded) parts.push(tn('vc.sum.resourcesAdded', s.resourcesAdded));
  if (!parts.length) return t('vc.sum.none');
  return parts.join(', ') + (s.excerpt ? `: «${s.excerpt}»` : '');
}

/** Messaggio di commit proposto: documento per documento, poi commenti e risorse. */
export function suggestCommitMessage(s: ChangeSummary): string {
  const bits: string[] = [];
  for (const d of s.docs.slice(0, 3)) {
    if (d.status === 'added') bits.push(t('vc.msg.newDoc', { title: d.title }));
    else if (d.status === 'deleted') bits.push(t('vc.msg.deletedDoc', { title: d.title }));
    else {
      const p: string[] = [];
      if (d.stats.added) p.push(`+${tn('vc.msg.paragraphs', d.stats.added)}`);
      if (d.stats.modified) p.push(tn('vc.msg.modified', d.stats.modified));
      if (d.stats.removed) p.push(`−${tn('vc.msg.paragraphs', d.stats.removed)}`);
      if (d.citationsDelta > 0) p.push(`+${tn('vc.msg.citations', d.citationsDelta)}`);
      if (p.length) bits.push(`${d.title}: ${p.join(', ')}`);
    }
  }
  if (s.docs.length > 3) bits.push(t('vc.msg.moreDocs', { n: s.docs.length - 3 }));
  if (s.commentsDelta > 0) bits.push(`+${tn('vc.msg.comments', s.commentsDelta)}`);
  if (s.resourcesAdded) bits.push(`+${tn('vc.msg.resources', s.resourcesAdded)}`);
  return bits.join('; ') || t('vc.msg.generic');
}
