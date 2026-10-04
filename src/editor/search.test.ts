import { describe, it, expect } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { findMatches, buildRegex, replacement } from './search';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    text: { group: 'inline' },
    atom: { group: 'inline', inline: true, atom: true },
  },
});

const doc = schema.node('doc', null, [
  schema.node('paragraph', null, [schema.text('Il gatto e il Gattino.')]),
  schema.node('paragraph', null, [schema.text('gat'), schema.node('atom'), schema.text('to')]),
]);

describe('ricerca', () => {
  it('trova senza distinguere maiuscole', () => {
    const m = findMatches(doc, { query: 'gatt', regex: false, caseSensitive: false, wholeWord: false });
    expect(m.length).toBe(2);
    expect(doc.textBetween(m[0].from, m[0].to)).toBe('gatt');
    expect(doc.textBetween(m[1].from, m[1].to)).toBe('Gatt');
  });

  it('parola intera e maiuscole', () => {
    expect(findMatches(doc, { query: 'gatto', regex: false, caseSensitive: true, wholeWord: true }).length).toBe(1);
    expect(findMatches(doc, { query: 'il', regex: false, caseSensitive: false, wholeWord: true }).length).toBe(2);
  });

  it('un nodo atomico interrompe la parola', () => {
    expect(findMatches(doc, { query: 'gatto', regex: false, caseSensitive: false, wholeWord: false }).length).toBe(1);
  });

  it('regex non valida: nessun risultato', () => {
    expect(buildRegex({ query: '(', regex: true, caseSensitive: false, wholeWord: false })).toBeNull();
  });

  it('sostituzione con gruppi', () => {
    const o = { query: '(\\w+)@(\\w+)', regex: true, caseSensitive: false, wholeWord: false };
    expect(replacement(o, 'mario@rossi', '$2, $1')).toBe('rossi, mario');
    expect(replacement({ ...o, regex: false }, 'x', '$1')).toBe('$1');
  });
});
