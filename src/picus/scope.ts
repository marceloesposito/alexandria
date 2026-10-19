// Picus: che cosa si guarda quando lo si interroga. Con una selezione: quel tratto, con le varianti
// di ogni locuzione; con il solo cursore: il suo paragrafo, piu' le varianti della locuzione su cui
// sta il cursore; "tutta la pergamena": ogni blocco, solo i problemi (niente varianti).
import type { Block } from './blocks';
import type { Finding } from './analyze';
import type { Live } from './plugin';

export interface Asked {
  from: number;
  to: number;
  empty: boolean;
}

export function pickBlocks(blocks: Block[], sel: Asked, whole: boolean): Block[] {
  if (whole) return blocks;
  if (!sel.empty) return blocks.filter((b) => b.to > sel.from && b.from < sel.to);
  return blocks.filter((b) => sel.from >= b.from && sel.from <= b.to);
}

/** Rilievi del blocco nelle posizioni del documento, filtrati secondo la domanda. */
export function placeFindings(b: Block, fs: Finding[], sel: Asked, whole: boolean): Live[] {
  const out: Live[] = [];
  for (const f of fs) {
    const from = b.map[f.start];
    const to = b.map[f.end - 1] + 1;
    if (whole) {
      if (f.kind !== 'variation') out.push({ from, to, f });
      continue;
    }
    if (!sel.empty) {
      if (to > sel.from && from < sel.to) out.push({ from, to, f });
      continue;
    }
    // senza selezione le varianti solo per la locuzione sotto il cursore
    if (f.kind !== 'variation' || (sel.from >= from && sel.from <= to)) out.push({ from, to, f });
  }
  return out;
}
