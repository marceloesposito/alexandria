// Marginalia nell'export Word: gli intervalli dei commenti diventano segni "comment" sul testo
// (posizioni ProseMirror), che toDocx trasforma in commenti nativi di Word. Funzione pura.
import type { PMNode, PMMark } from '../doc/types';

export interface ExportComment {
  id: number;
  from: number;
  to: number;
  author: string;
  date: string;
  text: string;
  replies: { author: string; date: string; text: string }[];
}

function size(n: PMNode): number {
  if (n.type === 'text') return (n.text ?? '').length;
  if (!n.content?.length) return isLeafBlock(n) ? 2 : 1;
  return 2 + n.content.reduce((s, c) => s + size(c), 0);
}

/** Blocchi senza contenuto (paragrafo vuoto) contano 2; gli atomi in linea (citazioni, formule) 1. */
function isLeafBlock(n: PMNode): boolean {
  return ['paragraph', 'heading', 'blockquote', 'listItem', 'bulletList', 'orderedList', 'codeBlock', 'tableCell', 'tableHeader', 'tableRow', 'table'].includes(n.type);
}

/** Aggiunge i segni dei commenti ai pezzi di testo che cadono nei loro intervalli. */
export function injectCommentMarks(doc: PMNode, comments: ExportComment[]): PMNode {
  if (!comments.length) return doc;
  const visit = (n: PMNode, start: number): PMNode => {
    if (n.type === 'text') {
      const text = n.text ?? '';
      const end = start + text.length;
      // punti di taglio: inizi e fini dei commenti che cadono dentro questo testo
      const cuts = new Set<number>([0, text.length]);
      for (const c of comments) {
        if (c.from > start && c.from < end) cuts.add(c.from - start);
        if (c.to > start && c.to < end) cuts.add(c.to - start);
      }
      const points = [...cuts].sort((a, b) => a - b);
      const pieces: PMNode[] = [];
      for (let i = 0; i + 1 < points.length; i++) {
        const a = start + points[i];
        const b = start + points[i + 1];
        const ids = comments.filter((c) => c.from < b && c.to > a).map((c) => c.id);
        const marks: PMMark[] = [...(n.marks ?? []), ...ids.map((id) => ({ type: 'comment', attrs: { id } }) as unknown as PMMark)];
        pieces.push({ ...n, text: text.slice(points[i], points[i + 1]), ...(marks.length ? { marks } : {}) });
      }
      return pieces.length === 1 ? pieces[0] : ({ type: '__split', content: pieces } as PMNode);
    }
    if (!n.content) return n;
    let p = n.type === 'doc' ? 0 : start + 1;
    const content: PMNode[] = [];
    for (const c of n.content) {
      const v = visit(c, p);
      if (v.type === '__split') content.push(...(v.content ?? []));
      else content.push(v);
      p += size(c);
    }
    return { ...n, content };
  };
  return visit(doc, 0);
}
