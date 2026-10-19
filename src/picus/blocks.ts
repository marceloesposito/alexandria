// Picus: testo di ogni blocco della pergamena con la mappa offset -> posizione nel documento (come
// in editor/search.ts). Il testo cancellato in revisione non conta: diventa un separatore, cosi'
// "look [old] like" non si legge come "look like" e le parole non si fondono.
import type { Node as PMNode } from '@tiptap/pm/model';

export interface Block {
  text: string;
  /** posizione nel documento di ogni carattere di `text` */
  map: number[];
  /** inizio e fine del contenuto del blocco */
  from: number;
  to: number;
}

export function textBlocks(doc: PMNode): Block[] {
  const out: Block[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const map: number[] = [];
    node.forEach((child, offset) => {
      const p = pos + 1 + offset;
      if (child.isText) {
        const deleted = child.marks.some((m) => m.type.name === 'deletion');
        for (let i = 0; i < child.text!.length; i++) map.push(p + i);
        text += deleted ? '\u0000'.repeat(child.text!.length) : child.text;
      } else {
        map.push(p);
        text += '￼';
      }
    });
    out.push({ text, map, from: pos + 1, to: pos + 1 + node.content.size });
    return false;
  });
  return out;
}

/** Posizioni nel documento di un tratto [start, end) del testo del blocco. */
export function docRange(b: Block, start: number, end: number): [number, number] {
  return [b.map[start], b.map[end - 1] + 1];
}
