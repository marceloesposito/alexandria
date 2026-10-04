// Disposizione della timeline: una colonna per commit (dal piu' vecchio a sinistra),
// una riga (corsia) per branch; i branch partono dal punto di divergenza.
import type { GitCommit, GitLog } from '../platform/types';

export interface GraphNode {
  sha: string;
  col: number;
  lane: number;
  commit: GitCommit;
  checkpoint: boolean;
}

export interface GraphEdge {
  from: string; // genitore
  to: string; // figlio
  merge: boolean; // secondo genitore di un merge
}

export interface Lane {
  lane: number;
  branch: string | null;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  lanes: Lane[];
  bySha: Map<string, GraphNode>;
}

export function isCheckpoint(c: GitCommit): boolean {
  return c.message.startsWith('checkpoint:');
}

export function layoutGraph(log: GitLog): Graph {
  const commits = [...log.commits].reverse(); // dal piu' vecchio
  const index = new Map(commits.map((c, i) => [c.sha, i]));
  const bySha = new Map(commits.map((c) => [c.sha, c]));
  const lane = new Map<string, number>();
  const lanes: Lane[] = [];

  const order = [...log.branches].sort((a, b) => {
    const rank = (n: string) => (n === log.branch ? 0 : n === 'main' || n === 'master' ? 1 : 2);
    return rank(a.name) - rank(b.name) || (index.get(a.sha) ?? 0) - (index.get(b.sha) ?? 0);
  });
  // il branch principale (main) occupa la prima corsia, poi gli altri
  order.sort((a, b) => ((a.name === 'main' || a.name === 'master') ? -1 : 0) - ((b.name === 'main' || b.name === 'master') ? -1 : 0));

  const walk = (tip: string, branch: string | null) => {
    if (lane.has(tip)) return;
    const l = lanes.length;
    lanes.push({ lane: l, branch });
    let cur: string | undefined = tip;
    while (cur && !lane.has(cur) && bySha.has(cur)) {
      lane.set(cur, l);
      cur = bySha.get(cur)!.parents[0];
    }
  };
  for (const b of order) walk(b.sha, b.name);
  // commit raggiungibili solo come secondi genitori (branch gia' cancellati)
  for (const c of [...commits].reverse()) {
    if (!lane.has(c.sha)) walk(c.sha, null);
  }

  const nodes: GraphNode[] = commits.map((c, i) => ({
    sha: c.sha,
    col: i,
    lane: lane.get(c.sha) ?? 0,
    commit: c,
    checkpoint: isCheckpoint(c),
  }));
  const edges: GraphEdge[] = [];
  for (const c of commits) {
    c.parents.forEach((p, i) => {
      if (bySha.has(p)) edges.push({ from: p, to: c.sha, merge: i > 0 });
    });
  }
  return { nodes, edges, lanes, bySha: new Map(nodes.map((n) => [n.sha, n])) };
}
