// Palimpsestus di Folium: albero delle versioni del foglio, senza git. Ogni versione e' un nodo con un
// genitore e un ramo; "Riprendi da qui" su una versione vecchia fa nascere un ramo nuovo alla
// versione successiva. Niente unione dei rami. Funzioni pure: il testo di ogni versione sta in un
// file a parte (palimpsestus/<id>.md), qui solo la struttura.

export interface VNode {
  id: string;
  parent: string | null;
  /** istante della versione (ms) */
  at: number;
  /** ramo: 0 e' il tronco, poi 1, 2... in ordine di nascita */
  branch: number;
  /** nome dato dall'autore (versione manuale) */
  label?: string;
  /** versione automatica (pausa nella scrittura o chiusura) */
  auto: boolean;
}

export interface VersionTree {
  version: 1;
  nodes: VNode[];
  /** versione da cui discende il testo attuale */
  head: string | null;
}

export function emptyTree(): VersionTree {
  return { version: 1, nodes: [], head: null };
}

export function normalizeTree(raw: unknown): VersionTree {
  const r = raw as Partial<VersionTree> | null;
  if (!r || !Array.isArray(r.nodes)) return emptyTree();
  const nodes = r.nodes.filter((n): n is VNode => !!n && typeof n.id === 'string' && typeof n.at === 'number');
  const ids = new Set(nodes.map((n) => n.id));
  const clean = nodes.map((n) => ({
    id: n.id,
    parent: n.parent && ids.has(n.parent) ? n.parent : null,
    at: n.at,
    branch: typeof n.branch === 'number' ? n.branch : 0,
    ...(n.label ? { label: String(n.label) } : {}),
    auto: !!n.auto,
  }));
  return { version: 1, nodes: clean, head: r.head && ids.has(r.head) ? r.head : (clean[clean.length - 1]?.id ?? null) };
}

export function nodeOf(t: VersionTree, id: string | null): VNode | undefined {
  return id ? t.nodes.find((n) => n.id === id) : undefined;
}

export function childrenOf(t: VersionTree, id: string): VNode[] {
  return t.nodes.filter((n) => n.parent === id).sort((a, b) => a.at - b.at);
}

/** Un nodo con due o piu' figli: da li' partono rami diversi. */
export function isFork(t: VersionTree, id: string): boolean {
  return childrenOf(t, id).length > 1;
}

/** Ultima versione del ramo che parte da `id` (seguendo il figlio sullo stesso ramo, o il primo). */
export function tipOf(t: VersionTree, id: string): string {
  let cur = nodeOf(t, id);
  while (cur) {
    const kids = childrenOf(t, cur.id);
    if (!kids.length) return cur.id;
    cur = kids.find((k) => k.branch === cur!.branch) ?? kids[0];
  }
  return id;
}

/**
 * Aggiunge una versione figlia della testa. Se la testa ha gia' un seguito sul suo ramo (si e' fatto
 * "Riprendi da qui" su una versione vecchia), la nuova versione apre un ramo nuovo.
 */
export function record(t: VersionTree, v: { id: string; at: number; label?: string; auto: boolean }): VersionTree {
  const head = nodeOf(t, t.head);
  const continues = head && !childrenOf(t, head.id).some((k) => k.branch === head.branch);
  const branch = !head ? 0 : continues ? head.branch : Math.max(...t.nodes.map((n) => n.branch)) + 1;
  const node: VNode = { id: v.id, parent: head?.id ?? null, at: v.at, branch, ...(v.label ? { label: v.label } : {}), auto: v.auto };
  return { ...t, nodes: [...t.nodes, node], head: node.id };
}

/** Il foglio torna a questa versione: la prossima versione salvata partira' da qui. */
export function resumeFrom(t: VersionTree, id: string): VersionTree {
  return nodeOf(t, id) ? { ...t, head: id } : t;
}

export function rename(t: VersionTree, id: string, label: string): VersionTree {
  return { ...t, nodes: t.nodes.map((n) => (n.id === id ? { ...n, label: label || undefined, auto: label ? false : n.auto } : n)) };
}

/** Cosa mostrare al passaggio del mouse: il confronto fra le punte dei rami o l'anteprima. */
export type HoverTarget = { kind: 'fork'; tips: string[] } | { kind: 'preview'; id: string };

export function forkDiffTarget(t: VersionTree, id: string): HoverTarget {
  const kids = childrenOf(t, id);
  if (kids.length > 1) return { kind: 'fork', tips: kids.map((k) => tipOf(t, k.id)) };
  return { kind: 'preview', id };
}

/** Versioni da non potare mai: con un nome, biforcazioni, radici, punte dei rami e la testa. */
export function isKeeper(t: VersionTree, n: VNode): boolean {
  return !n.auto || !!n.label || n.parent === null || n.id === t.head || childrenOf(t, n.id).length !== 1;
}

/**
 * Potatura delle versioni automatiche vecchie: nelle ultime 24 ore restano tutte, fino a una
 * settimana una per ora, oltre una per giorno. Chi resta adotta i figli dei potati.
 */
export function prune(t: VersionTree, now: number): { tree: VersionTree; removed: string[] } {
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const seen = new Set<string>();
  const removed = new Set<string>();
  // dalla piu' recente: nel suo secchio resta la prima che si incontra
  for (const n of [...t.nodes].sort((a, b) => b.at - a.at)) {
    const age = now - n.at;
    if (age < DAY || isKeeper(t, n)) continue;
    const bucket = `${n.branch}:${age < 7 * DAY ? 'h' + Math.floor(n.at / HOUR) : 'd' + Math.floor(n.at / DAY)}`;
    if (seen.has(bucket)) removed.add(n.id);
    else seen.add(bucket);
  }
  if (!removed.size) return { tree: t, removed: [] };
  const parentOf = new Map(t.nodes.map((n) => [n.id, n.parent]));
  const lift = (p: string | null): string | null => {
    while (p && removed.has(p)) p = parentOf.get(p) ?? null;
    return p;
  };
  const nodes = t.nodes.filter((n) => !removed.has(n.id)).map((n) => ({ ...n, parent: lift(n.parent) }));
  return { tree: { ...t, nodes }, removed: [...removed] };
}

/** Posizione nell'albero disegnato: colonna = ramo, riga = ordine nel tempo (la piu' recente in alto). */
export interface TreeSlot {
  id: string;
  lane: number;
  row: number;
}

export function treeLayout(t: VersionTree): { slots: TreeSlot[]; lanes: number } {
  const order = [...t.nodes].sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
  // colonne compatte: i rami nell'ordine di nascita
  const branches = [...new Set([...t.nodes].sort((a, b) => a.at - b.at).map((n) => n.branch))];
  const lane = new Map(branches.map((b, i) => [b, i]));
  return { slots: order.map((n, row) => ({ id: n.id, lane: lane.get(n.branch) ?? 0, row })), lanes: branches.length };
}
