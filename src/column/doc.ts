// Testo del foglio: Markdown <-> albero del documento (logos), con le revisioni tracciate accettate.
// Column non gestisce le revisioni: quelle che arrivano da un .md di Alexandria si accettano
// all'apertura (le aggiunte restano, le cancellazioni spariscono).
import { parseMarkdown } from 'logos/doc/parse';
import { serializeMarkdown } from 'logos/doc/serialize';
import type { PMNode } from 'logos/doc/types';

export function acceptRevisions(n: PMNode): PMNode {
  if (!n.content) return n;
  const content: PMNode[] = [];
  for (const c of n.content) {
    if (c.type === 'text' && c.marks?.some((m) => m.type === 'deletion')) continue;
    const x = acceptRevisions(c);
    const marks = x.marks?.filter((m) => m.type !== 'insertion' && m.type !== 'deletion');
    if (x.marks && marks!.length !== x.marks.length) {
      const { marks: _drop, ...rest } = x;
      content.push(marks!.length ? { ...rest, marks } : rest);
    } else content.push(x);
  }
  return { ...n, content };
}

export function markdownToDoc(md: string): PMNode {
  const doc = acceptRevisions(parseMarkdown(md));
  return doc.content?.length ? doc : { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function docToMarkdown(doc: PMNode): string {
  return serializeMarkdown(doc);
}
