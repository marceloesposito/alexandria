// Pergamene nella Tabula: nodi "proxy" (id "doc:<percorso>") e collegamenti fra pergamene dello
// stesso Compendium. I collegamenti stanno nello stesso file dei legami fra risorse.
import type { Link, Whiteboard } from './storage';

export const DOC_PREFIX = 'doc:';

export function docNodeId(rel: string): string {
  return DOC_PREFIX + rel;
}

export function relOfNode(id: string): string | null {
  return id.startsWith(DOC_PREFIX) ? id.slice(DOC_PREFIX.length) : null;
}

/** Pergamene collegate a `rel` (in un verso o nell'altro), senza doppioni, nell'ordine dei legami. */
export function linkedDocs(links: Link[], rel: string): string[] {
  const me = docNodeId(rel);
  const out: string[] = [];
  for (const l of links) {
    const other = l.from === me ? l.to : l.to === me ? l.from : null;
    const r = other && relOfNode(other);
    if (r && r !== rel && !out.includes(r)) out.push(r);
  }
  return out;
}

/** Una pergamena rinominata: legami e Tabula seguono il nuovo percorso. */
export function renameDocRefs(links: Link[], wb: Whiteboard, from: string, to: string): { links: Link[]; whiteboard: Whiteboard } {
  const a = docNodeId(from);
  const b = docNodeId(to);
  const swap = (id: string) => (id === a ? b : id);
  const nodes = { ...wb.nodes };
  if (nodes[a]) {
    nodes[b] = nodes[a];
    delete nodes[a];
  }
  return {
    links: links.map((l) => ({ ...l, from: swap(l.from), to: swap(l.to) })),
    whiteboard: { ...wb, nodes, docs: (wb.docs ?? []).map((r) => (r === from ? to : r)) },
  };
}

/** Una pergamena eliminata: spariscono i suoi legami e il suo nodo. */
export function dropDocRefs(links: Link[], wb: Whiteboard, rel: string): { links: Link[]; whiteboard: Whiteboard } {
  const id = docNodeId(rel);
  const nodes = { ...wb.nodes };
  delete nodes[id];
  return {
    links: links.filter((l) => l.from !== id && l.to !== id),
    whiteboard: { ...wb, nodes, docs: (wb.docs ?? []).filter((r) => r !== rel) },
  };
}
