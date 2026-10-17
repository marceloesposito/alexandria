// Armarium del foglio: blocchi (nota, estratto, immagine, link) e collegamenti padre -> figlio.
// Solo dati e funzioni pure; disposizione in flowLayout.ts, fisica in gravity.ts.
import type { Anchor } from 'logos/comments/model';

export type BlockKind = 'note' | 'excerpt' | 'image' | 'link';

export interface Block {
  id: string;
  kind: BlockKind;
  /** testo della nota o dell'estratto, didascalia dell'immagine, titolo del link */
  text: string;
  /** immagine: percorso dentro il foglio (media/...) */
  src?: string;
  /** link: indirizzo (nessuna richiesta di rete) */
  url?: string;
  /** estratto: punto del testo da cui viene (stesse ancore dei commenti) */
  anchor?: Anchor;
  /** posizione d'equilibrio salvata e misure */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BlockLink {
  id: string;
  from: string;
  to: string;
}

export interface Tabula {
  version: 1;
  blocks: Block[];
  links: BlockLink[];
}

export const BLOCK_W = 220;

export function emptyTabula(): Tabula {
  return { version: 1, blocks: [], links: [] };
}

const KINDS: BlockKind[] = ['note', 'excerpt', 'image', 'link'];

export function normalizeTabula(raw: unknown): Tabula {
  const r = raw as Partial<Tabula> | null;
  if (!r || !Array.isArray(r.blocks)) return emptyTabula();
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const blocks: Block[] = r.blocks
    .filter((b) => b && typeof b.id === 'string' && KINDS.includes(b.kind))
    .map((b) => ({
      id: b.id,
      kind: b.kind,
      text: String(b.text ?? ''),
      ...(b.src ? { src: String(b.src) } : {}),
      ...(b.url ? { url: String(b.url) } : {}),
      ...(b.anchor ? { anchor: b.anchor } : {}),
      x: num(b.x, 0),
      y: num(b.y, 0),
      w: num(b.w, BLOCK_W),
      h: num(b.h, 80),
    }));
  const ids = new Set(blocks.map((b) => b.id));
  const links = (Array.isArray(r.links) ? r.links : []).filter((l) => l && ids.has(l.from) && ids.has(l.to) && l.from !== l.to);
  return { version: 1, blocks, links: links.map((l) => ({ id: String(l.id), from: l.from, to: l.to })) };
}

let n = 0;
export function newId(prefix: string): string {
  n += 1;
  return `${prefix}${Date.now().toString(36)}${n.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Toglie blocchi e i collegamenti che partono o arrivano li'. */
export function removeBlocks(t: Tabula, ids: string[]): Tabula {
  const gone = new Set(ids);
  return { ...t, blocks: t.blocks.filter((b) => !gone.has(b.id)), links: t.links.filter((l) => !gone.has(l.from) && !gone.has(l.to)) };
}

/** Collega padre -> figlio; un figlio ha un solo padre e niente cicli. */
export function attach(t: Tabula, parent: string, child: string): Tabula {
  if (parent === child || isAncestor(t, child, parent)) return t;
  const links = t.links.filter((l) => l.to !== child);
  return { ...t, links: [...links, { id: newId('k'), from: parent, to: child }] };
}

export function detach(t: Tabula, child: string): Tabula {
  return t.links.some((l) => l.to === child) ? { ...t, links: t.links.filter((l) => l.to !== child) } : t;
}

export function parentOf(t: Tabula, id: string): string | null {
  return t.links.find((l) => l.to === id)?.from ?? null;
}

/** `a` e' antenato di `b`? */
export function isAncestor(t: Tabula, a: string, b: string): boolean {
  let cur = parentOf(t, b);
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    if (cur === a) return true;
    seen.add(cur);
    cur = parentOf(t, cur);
  }
  return false;
}
