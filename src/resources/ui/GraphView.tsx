// Vista a grafo con simulazione di forze (d3-force) disegnata in SVG: zoom, trascinamento,
// evidenziazione dei vicini; clic su una risorsa apre l'ispettore, su un documento lo apre nell'editor.
import { useEffect, useMemo, useRef, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import { useResources } from '../store';
import { useWorkspace } from '../../state/workspace';
import { buildGraph, type GNode, type GEdge, type DocText } from '../graphModel';
import { isVisible } from '../model';
import { readDocument } from '../../vault/vault';
import { t } from '../../i18n';

type SimNode = GNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & { kind: GEdge['kind'] };

const EDGE_STYLE: Record<GEdge['kind'], string> = {
  link: 'var(--series-1)',
  cite: 'var(--series-2)',
  wiki: 'var(--series-3)',
  url: 'var(--series-6)',
  tag: 'var(--line-strong)',
};

export function GraphView() {
  const resources = useResources((s) => s.resources);
  const layers = useResources((s) => s.layers);
  const active = useResources((s) => s.activeLayer);
  const texts = useResources((s) => s.texts);
  const links = useResources((s) => s.links);
  const docs = useWorkspace((s) => s.docs);
  const root = useWorkspace((s) => s.vaultRoot);
  const [docTexts, setDocTexts] = useState<DocText[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [showDocs, setShowDocs] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const svg = useRef<SVGSVGElement>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);

  useEffect(() => {
    if (!root) return;
    void Promise.all(docs.map(async (d) => ({ rel: d.rel, title: d.title, md: await readDocument(root, d.rel) }))).then(setDocTexts);
  }, [root, docs]);

  const graph = useMemo(() => {
    const vis = resources.filter((r) => isVisible(r, layers, active, resources, texts));
    return buildGraph(showDocs ? docTexts : [], vis, links, { tags: showTags });
  }, [resources, layers, active, texts, docTexts, links, showTags, showDocs]);

  useEffect(() => {
    const el = svg.current;
    const w = el?.clientWidth ?? 800;
    const h = el?.clientHeight ?? 600;
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    const nodes: SimNode[] = graph.nodes.map((n) => {
      const p = prev.get(n.id);
      return { ...n, x: p?.x ?? w / 2 + (Math.random() - 0.5) * 200, y: p?.y ?? h / 2 + (Math.random() - 0.5) * 200 };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const ls: SimLink[] = graph.edges.map((e) => ({ source: byId.get(e.source)!, target: byId.get(e.target)!, kind: e.kind }));
    nodesRef.current = nodes;
    linksRef.current = ls;
    simRef.current?.stop();
    const sim = forceSimulation<SimNode>(nodes)
      .force('link', forceLink<SimNode, SimLink>(ls).distance((l) => (l.kind === 'tag' ? 50 : 90)).strength(0.6))
      .force('charge', forceManyBody().strength(-220))
      .force('center', forceCenter(w / 2, h / 2))
      .force('collide', forceCollide<SimNode>().radius((n) => 10 + Math.sqrt(n.degree) * 3))
      .alpha(prev.size ? 0.4 : 1)
      .on('tick', () => setTick((x) => x + 1));
    simRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [graph]);

  const neighbors = useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    for (const e of graph.edges) {
      if (e.source === hover) s.add(e.target);
      if (e.target === hover) s.add(e.source);
    }
    return s;
  }, [hover, graph]);

  const toWorld = (cx: number, cy: number) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
  };

  const dragNode = (n: SimNode, e: React.PointerEvent) => {
    e.stopPropagation();
    const sim = simRef.current;
    sim?.alphaTarget(0.3).restart();
    let moved = false;
    const move = (ev: PointerEvent) => {
      moved = true;
      const p = toWorld(ev.clientX, ev.clientY);
      n.fx = p.x;
      n.fy = p.y;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      sim?.alphaTarget(0);
      n.fx = null;
      n.fy = null;
      if (!moved) {
        if (n.kind === 'res') useResources.getState().openInspector(n.id);
        if (n.kind === 'doc') {
          useWorkspace.getState().openDoc(n.id.slice(4));
          useWorkspace.getState().setView('editor');
        }
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const pan = (e: React.PointerEvent) => {
    const start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    const move = (ev: PointerEvent) => setView((v) => ({ ...v, x: start.vx + ev.clientX - start.x, y: start.vy + ev.clientY - start.y }));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="graph">
      <div className="graph__bar">
        <label className="check">
          <input type="checkbox" checked={showDocs} onChange={(e) => setShowDocs(e.target.checked)} /> {t('graph.docs')}
        </label>
        <label className="check">
          <input type="checkbox" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} /> {t('graph.tags')}
        </label>
        <span className="graph__legend">
          {(['cite', 'wiki', 'link', 'url'] as const).map((k) => (
            <span key={k}>
              <i style={{ background: EDGE_STYLE[k] }} /> {t(`graph.edge.${k}`)}
            </span>
          ))}
        </span>
        <span className="grow" />
        <span className="hint">{t('graph.stats', { n: graph.nodes.length, e: graph.edges.length })}</span>
      </div>
      <svg
        ref={svg}
        className="graph__svg"
        onPointerDown={pan}
        onWheel={(e) => {
          const r = svg.current!.getBoundingClientRect();
          const k = Math.min(4, Math.max(0.2, view.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
          const mx = e.clientX - r.left;
          const my = e.clientY - r.top;
          setView({ k, x: mx - ((mx - view.x) * k) / view.k, y: my - ((my - view.y) * k) / view.k });
        }}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {linksRef.current.map((l, i) => {
            const s = l.source as SimNode;
            const tg = l.target as SimNode;
            const dim = neighbors && !(neighbors.has(s.id) && neighbors.has(tg.id));
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={tg.x}
                y2={tg.y}
                stroke={EDGE_STYLE[l.kind]}
                strokeWidth={l.kind === 'tag' ? 0.8 : 1.4}
                strokeDasharray={l.kind === 'url' ? '3 3' : undefined}
                opacity={dim ? 0.12 : 0.7}
              />
            );
          })}
          {nodesRef.current.map((n) => {
            const r = n.kind === 'tag' ? 4 : 6 + Math.sqrt(n.degree) * 2.5;
            const dim = neighbors && !neighbors.has(n.id);
            return (
              <g
                key={n.id}
                className={`graph__node is-${n.kind}`}
                transform={`translate(${n.x},${n.y})`}
                opacity={dim ? 0.2 : 1}
                onPointerDown={(e) => dragNode(n, e)}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
              >
                {n.kind === 'doc' ? <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={2} /> : <circle r={r} />}
                {(view.k > 0.6 || n.degree > 2 || hover === n.id) && (
                  <text y={r + 12} textAnchor="middle">
                    {n.label.length > 32 ? n.label.slice(0, 31) + '…' : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {!graph.nodes.length && <div className="empty-hint">{t('graph.empty')}</div>}
    </div>
  );
}
