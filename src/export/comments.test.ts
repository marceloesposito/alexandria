import { describe, it, expect } from 'vitest';
import { injectCommentMarks } from './comments';
import { parseMarkdown } from '../doc/parse';

describe('commenti nell\'export Word', () => {
  it('segna il testo coperto dal commento, anche a cavallo di formattazioni', () => {
    // doc: <p>Alfa **beta** gamma</p> -> posizioni: p apre a 0, testo da 1
    const doc = parseMarkdown('Alfa **beta** gamma');
    const out = injectCommentMarks(doc, [{ id: 1, from: 4, to: 11, author: 'A', date: '', text: 'nota', replies: [] }]);
    const parts = out.content![0].content!.map((n) => [n.text, (n.marks ?? []).map((m) => m.type).join('+')]);
    expect(parts).toEqual([
      ['Alf', ''],
      ['a ', 'comment'],
      ['beta', 'bold+comment'],
      [' ', 'comment'],
      ['gamma', ''],
    ]);
  });
  it('il secondo paragrafo parte dopo la chiusura del primo', () => {
    const doc = parseMarkdown('Uno\n\nDue');
    // "Uno" = 1..4, chiusura 4->5, secondo paragrafo apre a 5, "Due" = 6..9
    const out = injectCommentMarks(doc, [{ id: 2, from: 6, to: 9, author: 'A', date: '', text: '', replies: [] }]);
    expect(out.content![1].content![0].marks?.[0]).toEqual({ type: 'comment', attrs: { id: 2 } });
    expect(out.content![0].content![0].marks).toBeUndefined();
  });
});
