import { describe, it, expect } from 'vitest';
import { makeAnchor, reanchor, wordAt, layoutBubbles, indexOfPos, normalizeCommentsFile, type FlatText } from './model';

/** Testo piatto con posizioni "ProseMirror" finte: ogni blocco inizia 2 posizioni dopo la fine del precedente. */
function flat(blocks: string[]): FlatText {
  let text = '';
  const map: number[] = [];
  let pos = 1;
  blocks.forEach((b, bi) => {
    if (bi > 0) {
      text += '\n';
      map.push(pos);
      pos += 1;
    }
    for (let i = 0; i < b.length; i++) map.push(pos + i);
    text += b;
    pos += b.length + 1;
  });
  return { text, map };
}

describe('ancore dei commenti', () => {
  const before = flat(['Il gatto dorme sul divano.', 'Il cane abbaia al gatto.']);
  const i = before.text.indexOf('gatto');
  const anchor = makeAnchor(before, before.map[i], before.map[i] + 5, 'text');

  it('crea citazione e contesto', () => {
    expect(anchor.quote).toBe('gatto');
    expect(anchor.prefix).toBe('Il ');
    expect(anchor.suffix.startsWith(' dorme')).toBe(true);
  });

  it('ritrova la citazione dopo un inserimento prima', () => {
    const after = flat(['Oggi, il gatto dorme sul divano.', 'Il cane abbaia al gatto.']);
    const r = reanchor(after, anchor)!;
    const a = indexOfPos(after, r.from);
    expect(after.text.slice(a, a + 5)).toBe('gatto');
    expect(a).toBe(after.text.indexOf('gatto')); // la prima, per il contesto " dorme"
  });

  it('fra due occorrenze sceglie quella con il contesto giusto', () => {
    const j = before.text.lastIndexOf('gatto');
    const second = makeAnchor(before, before.map[j], before.map[j] + 5, 'text');
    const after = flat(['Il gatto dorme sul divano.', 'Poi il cane abbaia al gatto.']);
    const r = reanchor(after, second)!;
    expect(indexOfPos(after, r.from)).toBe(after.text.lastIndexOf('gatto'));
  });

  it('testo citato modificato: ritrovato fra prefisso e suffisso', () => {
    const src = flat(['Una frase con la parola importante dentro e altro testo.']);
    const k = src.text.indexOf('importante');
    const a = makeAnchor(src, src.map[k], src.map[k] + 10, 'text');
    const after = flat(['Una frase con la parola fondamentale dentro e altro testo.']);
    const r = reanchor(after, a)!;
    const s = indexOfPos(after, r.from);
    const e = indexOfPos(after, r.to);
    expect(after.text.slice(s, e)).toBe('fondamentale');
  });

  it('testo cancellato: commento orfano', () => {
    const after = flat(['Tutt\'altro discorso.']);
    expect(reanchor(after, anchor)).toBeNull();
  });
});

describe('parola sotto il puntatore', () => {
  it('trova la parola', () => {
    const t = "L'acqua è fresca";
    expect(wordAt(t, 3)).toEqual({ start: 0, end: 7 });
    expect(wordAt(t, 8)).toEqual({ start: 8, end: 9 });
    expect(wordAt(t, 7)).toEqual({ start: 0, end: 7 }); // subito dopo la parola
    expect(wordAt('a  b', 2)).toBeNull();
  });
});

describe('disposizione delle bolle', () => {
  it('le bolle libere non si sovrappongono', () => {
    const pos = layoutBubbles([
      { id: 'a', y: 100, height: 50, pinned: false },
      { id: 'b', y: 110, height: 30, pinned: false },
      { id: 'c', y: 400, height: 30, pinned: false },
    ]);
    expect(pos.get('a')).toBe(100);
    expect(pos.get('b')).toBe(158);
    expect(pos.get('c')).toBe(400);
  });

  it('le bolle spostate a mano restano ferme e le altre le aggirano', () => {
    const pos = layoutBubbles([
      { id: 'fixed', y: 100, height: 60, pinned: true },
      { id: 'free', y: 120, height: 20, pinned: false },
    ]);
    expect(pos.get('fixed')).toBe(100);
    expect(pos.get('free')).toBe(168);
  });
});

describe('file dei commenti', () => {
  it('normalizza dati vecchi o sporchi', () => {
    expect(normalizeCommentsFile(null)).toEqual({ version: 1, comments: [] });
    const f = normalizeCommentsFile({ comments: [{ id: 'x', body: 'ciao' }, { nope: 1 }] });
    expect(f.comments).toHaveLength(1);
    expect(f.comments[0]).toMatchObject({ id: 'x', body: 'ciao', resolved: false, replies: [], anchor: null });
  });
});
