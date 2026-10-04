// Grafo della conoscenza: documenti e risorse come nodi; archi da collegamenti disegnati,
// citazioni nei documenti, [[wikilink]] fra documenti, link web e tag condivisi.
import type { Resource } from './model';
import type { Link } from './storage';

export interface GNode {
  id: string;
  kind: 'doc' | 'res' | 'tag';
  label: string;
  resKind?: Resource['kind'];
  degree: number;
}

export interface GEdge {
  source: string;
  target: string;
  kind: 'link' | 'cite' | 'wiki' | 'url' | 'tag';
}

export interface DocText {
  rel: string;
  title: string;
  md: string;
}

const CITE_KEY = /-?@([\p{L}\p{N}_][\p{L}\p{N}_:.#$%&+?<>~/-]*)/gu;
const WIKI = /\[\[([^\[\]|]+)(?:\|[^\[\]]+)?\]\]/g;
const URL_RE = /https?:\/\/[^\s)>\]"']+/g;

export function citedKeys(md: string): Set<string> {
  const out = new Set<string>();
  for (const block of md.match(/\[[^\[\]]*@[^\[\]]*\]/g) ?? []) for (const m of block.matchAll(CITE_KEY)) out.add(m[1].replace(/[.,;:]+$/, ''));
  return out;
}

export function buildGraph(docs: DocText[], resources: Resource[], links: Link[], opts: { tags: boolean } = { tags: false }) {
  const nodes = new Map<string, GNode>();
  const edges: GEdge[] = [];
  const seen = new Set<string>();
  const add = (source: string, target: string, kind: GEdge['kind']) => {
    if (source === target || !nodes.has(source) || !nodes.has(target)) return;
    const key = [source, target].sort().join('|') + kind;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, kind });
  };
  for (const d of docs) nodes.set(`doc:${d.rel}`, { id: `doc:${d.rel}`, kind: 'doc', label: d.title, degree: 0 });
  for (const r of resources) nodes.set(r.id, { id: r.id, kind: 'res', label: r.title, resKind: r.kind, degree: 0 });
  if (opts.tags) {
    for (const r of resources)
      for (const tag of r.tags) {
        const id = `tag:${tag.toLowerCase()}`;
        if (!nodes.has(id)) nodes.set(id, { id, kind: 'tag', label: `#${tag}`, degree: 0 });
        add(r.id, id, 'tag');
      }
  }
  const byKey = new Map(resources.filter((r) => r.citeKey).map((r) => [r.citeKey!, r.id]));
  const byTitle = new Map(docs.map((d) => [d.title.toLowerCase(), `doc:${d.rel}`]));
  const byUrl = new Map(resources.filter((r) => r.url).map((r) => [r.url!.replace(/\/$/, ''), r.id]));
  for (const d of docs) {
    const id = `doc:${d.rel}`;
    for (const k of citedKeys(d.md)) {
      const r = byKey.get(k);
      if (r) add(id, r, 'cite');
    }
    for (const m of d.md.matchAll(WIKI)) {
      const target = byTitle.get(m[1].trim().toLowerCase());
      if (target) add(id, target, 'wiki');
    }
    for (const m of d.md.matchAll(URL_RE)) {
      const r = byUrl.get(m[0].replace(/[.,;]+$/, '').replace(/\/$/, ''));
      if (r) add(id, r, 'url');
    }
  }
  for (const l of links) add(l.from, l.to, 'link');
  for (const e of edges) {
    nodes.get(e.source)!.degree++;
    nodes.get(e.target)!.degree++;
  }
  return { nodes: [...nodes.values()], edges };
}
