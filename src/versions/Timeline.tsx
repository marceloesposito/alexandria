// Linea del tempo orizzontale: un pallino per commit con data e ora, i branch come linee
// parallele che partono dal punto di divergenza. Al passaggio del mouse, il riassunto delle modifiche.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { layoutGraph, type GraphNode } from './graph';
import { useVersions } from './store';
import { platform } from '../platform';
import { useWorkspace } from '../state/workspace';
import { summarize, describeSummary, type ChangeSummary } from './diffSummary';
import { t } from '../i18n';
import { openContextMenu } from '../components/ContextMenu';
import { createBranch, restoreVersion } from './actions';
import { promptDialog, confirmDialog } from '../components/confirm';

const DX = 64;
const LANE_H = 44;
const PAD_X = 40;
const PAD_TOP = 34;

const summaryCache = new Map<string, ChangeSummary>();

async function summaryOf(root: string, sha: string): Promise<ChangeSummary> {
  const hit = summaryCache.get(sha);
  if (hit) return hit;
  const s = summarize(await platform.gitChanges(root, sha));
  summaryCache.set(sha, s);
  return s;
}

function shortDate(sec: number): { day: string; time: string } {
  const d = new Date(sec * 1000);
  return {
    day: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
}

export function laneColor(lane: number): string {
  return `var(--series-${(lane % 8) + 1})`;
}

export function Timeline() {
  const log = useVersions((s) => s.log);
  const dirty = useVersions((s) => s.dirty);
  const selected = useVersions((s) => s.selected);
  const compareWith = useVersions((s) => s.compareWith);
  const root = useWorkspace((s) => s.vaultRoot);
  const graph = useMemo(() => (log ? layoutGraph(log) : null), [log]);
  const [hover, setHover] = useState<{ node: GraphNode; x: number; y: number; summary: ChangeSummary | null } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // all'apertura si vede la fine della storia (le versioni piu' recenti)
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [graph?.nodes.length]);

  if (!graph || !log) return <div className="timeline timeline--empty">{t('vc.noHistory')}</div>;

  const cols = graph.nodes.length + (dirty ? 1 : 0);
  const width = PAD_X * 2 + Math.max(1, cols - 1) * DX;
  const height = PAD_TOP + graph.lanes.length * LANE_H + 34;
  const pos = (n: GraphNode) => ({ x: PAD_X + n.col * DX, y: PAD_TOP + n.lane * LANE_H });
  const headNode = log.head ? graph.bySha.get(log.head) : null;

  const onEnter = async (n: GraphNode, e: React.MouseEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    setHover({ node: n, x: r.left + r.width / 2, y: r.bottom, summary: summaryCache.get(n.sha) ?? null });
    if (root && !summaryCache.has(n.sha)) {
      const s = await summaryOf(root, n.sha);
      setHover((h) => (h && h.node.sha === n.sha ? { ...h, summary: s } : h));
    }
  };

  const menu = (n: GraphNode, e: React.MouseEvent) => {
    const label = n.commit.message.split('\n')[0];
    openContextMenu(e, [
      { label: t('vc.ctx.select'), onClick: () => useVersions.getState().select(n.sha) },
      { label: t('vc.ctx.compare'), onClick: () => useVersions.getState().setCompare(n.sha) },
      {
        label: t('vc.ctx.branchHere'),
        onClick: async () => {
          const name = await promptDialog(t('vc.newBranch.title'), '', t('vc.newBranch.hint'));
          if (name) await createBranch(name, n.sha, true);
        },
      },
      {
        label: t('vc.ctx.restore'),
        onClick: async () => {
          if (await confirmDialog(t('vc.restore.confirm', { label }), t('vc.restore.hint'))) await restoreVersion(n.sha, label);
        },
      },
    ]);
  };

  return (
    <div className="timeline" ref={scroller}>
      <svg width={width} height={height} className="timeline__svg" role="img" aria-label={t('vc.timeline')}>
        {/* corsie dei branch */}
        {graph.lanes.map((l) => {
          const ns = graph.nodes.filter((n) => n.lane === l.lane);
          if (!ns.length) return null;
          const first = ns[0];
          const last = ns[ns.length - 1];
          const y = PAD_TOP + l.lane * LANE_H;
          return (
            <g key={l.lane}>
              <line
                x1={pos(first).x}
                x2={pos(last).x + (dirty && headNode?.lane === l.lane && headNode.sha === last.sha ? DX : 0)}
                y1={y}
                y2={y}
                stroke={laneColor(l.lane)}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.85}
              />
              <text x={pos(last).x + 12} y={y - 10} className="timeline__branch" fill={laneColor(l.lane)}>
                {l.branch ?? t('vc.detached')}
                {l.branch === log.branch ? ` · ${t('vc.current')}` : ''}
              </text>
            </g>
          );
        })}
        {/* diramazioni e merge */}
        {graph.edges.map((e) => {
          const a = graph.bySha.get(e.from)!;
          const b = graph.bySha.get(e.to)!;
          if (a.lane === b.lane) return null;
          const p = pos(a);
          const q = pos(b);
          const mid = (p.x + q.x) / 2;
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={`M ${p.x} ${p.y} C ${mid} ${p.y}, ${mid} ${q.y}, ${q.x} ${q.y}`}
              fill="none"
              stroke={laneColor(e.merge ? a.lane : b.lane)}
              strokeWidth={2.5}
              strokeDasharray={e.merge ? '5 4' : undefined}
              opacity={0.8}
            />
          );
        })}
        {/* pallini */}
        {graph.nodes.map((n) => {
          const p = pos(n);
          const d = shortDate(n.commit.time);
          const isSel = n.sha === selected;
          const isCmp = n.sha === compareWith;
          const r = n.checkpoint ? 4 : 7;
          return (
            <g
              key={n.sha}
              className={`timeline__node ${isSel ? 'is-selected' : ''} ${n.checkpoint ? 'is-checkpoint' : ''}`}
              onMouseEnter={(e) => void onEnter(n, e)}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => {
                if (e.shiftKey) useVersions.getState().setCompare(n.sha);
                else useVersions.getState().select(n.sha);
              }}
              onContextMenu={(e) => menu(n, e)}
            >
              <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
              {(isSel || isCmp) && <circle cx={p.x} cy={p.y} r={r + 5} className={isCmp ? 'timeline__ring is-compare' : 'timeline__ring'} />}
              <circle cx={p.x} cy={p.y} r={r} fill={n.checkpoint ? 'var(--paper)' : laneColor(n.lane)} stroke={laneColor(n.lane)} strokeWidth={2} />
              {n.commit.parents.length > 1 && <circle cx={p.x} cy={p.y} r={3} fill="var(--paper)" />}
              {n.sha === log.head && <circle cx={p.x} cy={p.y} r={r + 9} className="timeline__head" />}
              {!n.checkpoint && (
                <text x={p.x} y={PAD_TOP + graph.lanes.length * LANE_H + 2} className="timeline__date" textAnchor="middle">
                  <tspan x={p.x}>{d.day}</tspan>
                  <tspan x={p.x} dy={12}>
                    {d.time}
                  </tspan>
                </text>
              )}
            </g>
          );
        })}
        {/* modifiche non ancora in un commit */}
        {dirty && headNode && (
          <g className="timeline__wip" onClick={() => useVersions.getState().select('WORKTREE')}>
            <circle cx={pos(headNode).x + DX} cy={pos(headNode).y} r={7} fill="var(--paper)" stroke={laneColor(headNode.lane)} strokeWidth={2} strokeDasharray="3 2" />
            <text x={pos(headNode).x + DX} y={pos(headNode).y + 22} textAnchor="middle" className="timeline__date">
              {t('vc.wip')}
            </text>
          </g>
        )}
      </svg>
      {hover &&
        createPortal(
          <div className="timeline-tip" style={{ left: Math.min(hover.x, window.innerWidth - 340), top: hover.y + 8 }}>
            <div className="timeline-tip__msg">{hover.node.checkpoint ? t('vc.checkpoint') : hover.node.commit.message.split('\n')[0]}</div>
            <div className="timeline-tip__meta">
              {new Date(hover.node.commit.time * 1000).toLocaleString()} · {hover.node.commit.author}
            </div>
            <div className="timeline-tip__sum">{hover.summary ? describeSummary(hover.summary) : t('vc.loading')}</div>
            {hover.summary?.docs.slice(0, 3).map((d) => (
              <div key={d.path} className="timeline-tip__doc">
                {d.title}: +{d.stats.added} ~{d.stats.modified} −{d.stats.removed}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

