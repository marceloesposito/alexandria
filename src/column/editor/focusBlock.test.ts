import { describe, it, expect } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { topLevelBlockAt } from './focusBlock';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    heading: { group: 'block', content: 'text*', attrs: { level: { default: 1 } } },
    blockquote: { group: 'block', content: 'block+' },
    text: {},
  },
});

describe('modalita\' focus', () => {
  // <h1>Titolo</h1><blockquote><p>dentro</p></blockquote><p>fine</p>
  const doc = schema.node('doc', null, [
    schema.node('heading', { level: 1 }, [schema.text('Titolo')]),
    schema.node('blockquote', null, [schema.node('paragraph', null, [schema.text('dentro')])]),
    schema.node('paragraph', null, [schema.text('fine')]),
  ]);

  it('trova il blocco di primo livello del cursore, anche dentro una citazione', () => {
    expect(topLevelBlockAt(doc, 3)).toEqual({ from: 0, to: 8 }); // nel titolo
    const quote = topLevelBlockAt(doc, 11)!; // dentro il paragrafo della citazione
    expect(doc.nodeAt(quote.from)!.type.name).toBe('blockquote');
    const last = topLevelBlockAt(doc, doc.content.size - 2)!;
    expect(doc.nodeAt(last.from)!.textContent).toBe('fine');
  });

  it('posizioni fuori dai limiti non rompono', () => {
    expect(topLevelBlockAt(doc, -5)).toEqual({ from: 0, to: 8 });
    expect(topLevelBlockAt(doc, 10_000)).toBeNull();
  });
});
