import { describe, it, expect } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { textBlocks } from './blocks';
import { pickBlocks, placeFindings } from './scope';
import { createEngine, analyze } from './analyze';

const schema = new Schema({
  nodes: { doc: { content: 'block+' }, paragraph: { group: 'block', content: 'inline*' }, text: { group: 'inline' }, hard: { group: 'inline', inline: true } },
  marks: { deletion: {}, strong: {} },
});
const p = (...parts: (string | [string, string])[]) =>
  schema.node(
    'paragraph',
    null,
    parts.map((x) => (typeof x === 'string' ? schema.text(x) : schema.text(x[0], [schema.mark(x[1])]))),
  );
const EN = createEngine(readFileSync(join(__dirname, 'packs/en.picus'), 'utf8'));

describe('blocchi e tratto interrogato', () => {
  const doc = schema.node('doc', null, [p('In order to win, ', ['we', 'strong'], ' trained.'), p('It looks like rain. Therefore we stayed; thus we slept.')]);

  it('testo per blocco con la mappa verso le posizioni', () => {
    const [a, b] = textBlocks(doc);
    expect(a.text).toBe('In order to win, we trained.');
    expect(doc.textBetween(a.map[17], a.map[18] + 1)).toBe('we');
    expect(b.from).toBe(a.to + 2);
  });

  it('il testo cancellato in revisione non conta', () => {
    const d = schema.node('doc', null, [p('look ', ['old ', 'deletion'], 'like that')]);
    const [b] = textBlocks(d);
    expect(b.text).toBe('look \u0000\u0000\u0000\u0000like that');
    expect(analyze(EN, b.text, { variations: true }).map((f) => f.original)).toEqual([]);
  });

  it('cursore: il suo paragrafo, con le varianti solo sotto il cursore', () => {
    const blocks = textBlocks(doc);
    const second = blocks[1];
    const cursor = second.map[4]; // dentro "looks like"
    const sel = { from: cursor, to: cursor, empty: true };
    const picked = pickBlocks(blocks, sel, false);
    expect(picked).toEqual([second]);
    const live = placeFindings(second, analyze(EN, second.text, { variations: true }), sel, false);
    expect(live.map((l) => [l.f.kind, doc.textBetween(l.from, l.to)])).toEqual([
      ['variation', 'looks like'],
      ['repetition', 'thus'],
    ]);
  });

  it('selezione: solo il tratto selezionato; tutta la pergamena: niente varianti', () => {
    const blocks = textBlocks(doc);
    const sel = { from: blocks[1].map[20], to: blocks[1].to, empty: false };
    const live = pickBlocks(blocks, sel, false).flatMap((b) => placeFindings(b, analyze(EN, b.text, { variations: true }), sel, false));
    expect(live.map((l) => doc.textBetween(l.from, l.to))).toEqual(['Therefore', 'thus']);
    const all = pickBlocks(blocks, sel, true).flatMap((b) => placeFindings(b, analyze(EN, b.text, { variations: true }), sel, true));
    expect(all.map((l) => [l.f.kind, doc.textBetween(l.from, l.to)])).toEqual([
      ['style', 'In order to'],
      ['repetition', 'thus'],
    ]);
  });
});
