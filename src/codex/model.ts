// Codex: pergamene collegate da legami direzionali (A -> B), lette di seguito nell'ordine dei legami.
// Le pergamene restano file separati; il Codex è solo la catena dei legami. Funzioni pure.
import type { Link } from '../resources/storage';
import { DOC_PREFIX, relOfNode, docNodeId } from '../resources/docLinks';

/** Legami pergamena -> pergamena, nell'ordine in cui sono stati creati. */
export function docEdges(links: Link[]): { from: string; to: string; id: string }[] {
  const out: { from: string; to: string; id: string }[] = [];
  for (const l of links) {
    const a = relOfNode(l.from);
    const b = relOfNode(l.to);
    if (a && b && a !== b) out.push({ from: a, to: b, id: l.id });
  }
  return out;
}

/** Ordine di lettura da una radice: in profondità, figli nell'ordine dei legami, senza ripetizioni. */
export function codexOrder(links: Link[], root: string): string[] {
  const edges = docEdges(links);
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (rel: string) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    out.push(rel);
    for (const e of edges) if (e.from === rel) visit(e.to);
  };
  visit(root);
  return out;
}

/** Radice del Codex di una pergamena: si risale lungo il primo legame in entrata (cicli compresi). */
export function codexRoot(links: Link[], rel: string): string {
  const edges = docEdges(links);
  let cur = rel;
  const seen = new Set<string>([rel]);
  for (;;) {
    const parent = edges.find((e) => e.to === cur)?.from;
    if (!parent || seen.has(parent)) return cur;
    seen.add(parent);
    cur = parent;
  }
}

export interface CodexInfo {
  root: string;
  members: string[];
}

/** Tutti i Codex del Compendium: catene di almeno due pergamene, nell'ordine delle radici. */
export function allCodices(links: Link[], existing?: Set<string>): CodexInfo[] {
  const edges = docEdges(links).filter((e) => !existing || (existing.has(e.from) && existing.has(e.to)));
  const clean = links.filter((l) => edges.some((e) => e.id === l.id));
  const covered = new Set<string>();
  const out: CodexInfo[] = [];
  for (const e of edges) {
    if (covered.has(e.from)) continue;
    const root = codexRoot(clean, e.from);
    if (covered.has(root)) continue;
    const members = codexOrder(clean, root);
    members.forEach((m) => covered.add(m));
    if (members.length > 1) out.push({ root, members });
  }
  return out;
}

/** Precedente e successiva nella lettura del Codex. */
export function neighbours(links: Link[], rel: string): { prev: string | null; next: string | null; root: string; members: string[] } {
  const root = codexRoot(links, rel);
  const members = codexOrder(links, root);
  const i = members.indexOf(rel);
  return { prev: i > 0 ? members[i - 1] : null, next: i >= 0 && i < members.length - 1 ? members[i + 1] : null, root, members };
}

/**
 * Nuovo ordine per un Codex: i legami interni diventano una catena semplice a1 -> a2 -> ... -> an.
 * I legami verso pergamene fuori dal Codex e quelli delle risorse restano come sono.
 */
export function relinkAsChain(links: Link[], order: string[], newId: () => string): Link[] {
  const inside = new Set(order);
  const kept = links.filter((l) => {
    const a = relOfNode(l.from);
    const b = relOfNode(l.to);
    return !(a && b && inside.has(a) && inside.has(b));
  });
  const chain: Link[] = [];
  for (let i = 0; i + 1 < order.length; i++) chain.push({ id: newId(), from: docNodeId(order[i]), to: docNodeId(order[i + 1]) });
  return [...kept, ...chain];
}

/** Toglie una pergamena dal Codex ricucendo la catena (chi la precedeva punta a chi la seguiva). */
export function removeFromCodex(links: Link[], order: string[], rel: string, newId: () => string): Link[] {
  // via tutti i legami interni (anche quelli della pergamena tolta), poi la catena senza di lei
  const inside = new Set(order);
  const kept = links.filter((l) => {
    const a = relOfNode(l.from);
    const b = relOfNode(l.to);
    return !(a && b && inside.has(a) && inside.has(b));
  });
  return relinkAsChain(kept, order.filter((r) => r !== rel), newId);
}

export const isDocNode = (id: string) => id.startsWith(DOC_PREFIX);

// ---------------------------------------------------------------- impostazioni del Codex

export interface CodexSettings {
  version: 1;
  name: string;
  /** fra una pergamena e l'altra: niente, salto pagina */
  separator: 'none' | 'pagebreak';
  /** il titolo di ogni pergamena come titolo di capitolo (H1) */
  titlesAsHeadings: boolean;
}

export function normalizeCodexSettings(raw: unknown, fallbackName: string): CodexSettings {
  const r = (raw ?? {}) as Partial<CodexSettings>;
  return {
    version: 1,
    name: typeof r.name === 'string' && r.name.trim() ? r.name : fallbackName,
    separator: r.separator === 'none' ? 'none' : 'pagebreak',
    titlesAsHeadings: typeof r.titlesAsHeadings === 'boolean' ? r.titlesAsHeadings : false,
  };
}
