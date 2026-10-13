// Mattoni comuni agli import: testo con marcature, paragrafi ripuliti dagli spazi, note.
import type { PMMark, PMNode } from 'logos/doc/types';
import { serializeMarkdown } from 'logos/doc/serialize';

export const markKey = (marks: PMMark[] | undefined) =>
  JSON.stringify((marks ?? []).map((m) => [m.type, m.attrs ?? null]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));

export function text(t: string, marks: PMMark[]): PMNode {
  return marks.length ? { type: 'text', text: t, marks: [...marks] } : { type: 'text', text: t };
}

export function withMark(marks: PMMark[], m: PMMark): PMMark[] {
  return marks.some((x) => x.type === m.type) ? marks : [...marks, m];
}

/**
 * Contenuto in linea pronto per l'editor: testi vicini con le stesse marcature uniti, spazi doppi
 * ridotti, spazi tolti all'inizio, alla fine e intorno agli a capo, testi vuoti eliminati.
 */
export function tidyInline(nodes: PMNode[]): PMNode[] {
  const merged: PMNode[] = [];
  for (const n of nodes) {
    if (n.type === 'text') {
      if (!n.text) continue;
      const last = merged[merged.length - 1];
      if (last?.type === 'text' && markKey(last.marks) === markKey(n.marks)) {
        merged[merged.length - 1] = { ...last, text: last.text + n.text! };
        continue;
      }
    }
    merged.push({ ...n });
  }
  // spazi: uno solo fra le parole, nessuno all'inizio, alla fine o accanto a un a capo
  let prevSpace = true;
  for (let i = 0; i < merged.length; i++) {
    const n = merged[i];
    if (n.type === 'hardBreak') {
      prevSpace = true;
      const p = merged[i - 1];
      if (p?.type === 'text') p.text = p.text!.replace(/ +$/, '');
      continue;
    }
    if (n.type !== 'text') {
      prevSpace = false;
      continue;
    }
    let s = n.text!.replace(/ {2,}/g, ' ');
    if (prevSpace) s = s.replace(/^ /, '');
    n.text = s;
    if (s) prevSpace = s.endsWith(' ');
  }
  const last = [...merged].reverse().find((n) => n.type === 'text' && n.text);
  if (last) last.text = last.text!.replace(/ +$/, '');
  const out = merged.filter((n) => n.type !== 'text' || n.text);
  // a capo all'inizio o alla fine del paragrafo: non servono
  while (out[0]?.type === 'hardBreak') out.shift();
  while (out[out.length - 1]?.type === 'hardBreak') out.pop();
  return out;
}

export function paragraph(inline: PMNode[]): PMNode | null {
  const content = tidyInline(inline);
  return content.length ? { type: 'paragraph', content } : null;
}

export function heading(level: number, inline: PMNode[]): PMNode | null {
  const content = tidyInline(inline).map((n) => (n.type === 'hardBreak' ? text(' ', []) : n));
  return content.length ? { type: 'heading', attrs: { level: Math.max(1, Math.min(6, level)) }, content: tidyInline(content) } : null;
}

/** Testo di una nota a pie' di pagina (Markdown in linea, come lo scrive il parser). */
export function noteText(inline: PMNode[]): string {
  const content = tidyInline(inline.map((n) => (n.type === 'hardBreak' ? text(' ', []) : n)));
  if (!content.length) return '';
  return serializeMarkdown({ type: 'doc', content: [{ type: 'paragraph', content }] }).trim();
}

export function footnote(textMd: string): PMNode {
  return { type: 'footnote', attrs: { text: textMd } };
}

/** Celle (gia' come contenuto in linea) -> tabella dell'editor; la prima riga fa da intestazione. */
export function table(rows: PMNode[][][]): PMNode | null {
  const kept = rows.filter((r) => r.length);
  if (!kept.length) return null;
  const cols = Math.max(...kept.map((r) => r.length));
  return {
    type: 'table',
    attrs: { align: Array.from({ length: cols }, () => null) },
    content: kept.map((r, i) => ({
      type: 'tableRow',
      content: Array.from({ length: cols }, (_, c) => {
        const inline = tidyInline(r[c] ?? []);
        return { type: i === 0 ? 'tableHeader' : 'tableCell', content: [inline.length ? { type: 'paragraph', content: inline } : { type: 'paragraph' }] };
      }),
    })),
  };
}

export function doc(blocks: PMNode[]): PMNode {
  // niente interruzioni di pagina all'inizio o alla fine, ne' due di seguito
  const out: PMNode[] = [];
  for (const b of blocks) {
    if (b.type === 'pageBreak' && (!out.length || out[out.length - 1].type === 'pageBreak')) continue;
    out.push(b);
  }
  while (out[out.length - 1]?.type === 'pageBreak') out.pop();
  return { type: 'doc', content: out.length ? out : [{ type: 'paragraph' }] };
}
