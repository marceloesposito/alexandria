// Whiteboard: risorse come schede libere, note, cornici; i collegamenti si tracciano
// trascinando dai punti di aggancio. Posizioni e collegamenti sono salvati nel vault.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollText, Link2 } from 'lucide-react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  NodeResizer,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  BackgroundVariant,
  MarkerType,
  ConnectionMode,
  BaseEdge,
  getBezierPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
  type MiniMapNodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useResources } from '../store';
import { isVisible, isLocked, colorOf, type Resource } from '../model';
import { ResourceCard, thumbUrl } from './common';
import { removeWithConfirm } from './remove';
import { t } from '../../i18n';
import { openContextMenu } from '../../components/ContextMenu';
import { promptDialog } from '../../components/confirm';
import type { WbNote, WbFrame } from '../storage';
import { RESOURCES_MIME } from './LayersPanel';
import { DocPicker } from './DocPicker';
import { docNodeId, relOfNode, linkedDocs } from '../docLinks';
import { placeDocNodes, facingSides, type Side, type Rect } from '../tabula';
import { useWorkspace } from '../../state/workspace';
import type { DocInfo } from '../../vault/vault';

type ResNodeData = { r: Resource; color: string | null };
type NoteNodeData = { note: WbNote };
type FrameNodeData = { frame: WbFrame };
type DocNodeData = { doc: DocInfo; active: boolean; linked: number };

const POS: Record<Side, Position> = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left };

/** Punti di aggancio sui quattro lati: da ognuno parte o arriva un collegamento. */
function Handles() {
  return (
    <>
      {(Object.keys(POS) as Side[]).map((side) => (
        <Handle key={side} type="source" id={side} position={POS[side]} className={`wb-handle wb-handle--${side}`} />
      ))}
    </>
  );
}

function rectOf(n: InternalNode): Rect {
  return { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w: n.measured.width ?? 0, h: n.measured.height ?? 0 };
}

/** Freccia che si attacca ai lati che si guardano (sopra, sotto, destra, sinistra) e li segue. */
function FloatingEdge({ id, source, target, markerEnd, label, style }: EdgeProps) {
  const a = useInternalNode(source);
  const b = useInternalNode(target);
  if (!a || !b) return null;
  const f = facingSides(rectOf(a), rectOf(b));
  const [path, labelX, labelY] = getBezierPath({
    sourceX: f.start.x,
    sourceY: f.start.y,
    sourcePosition: POS[f.from],
    targetX: f.end.x,
    targetY: f.end.y,
    targetPosition: POS[f.to],
  });
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} label={label} labelX={labelX} labelY={labelY} className="wb-edge" interactionWidth={16} />;
}

const edgeTypes = { floating: FloatingEdge };

/**
 * Miniatura di un nodo nel navigatore: una schedina col colore del suo tipo (pergamena, fonte col
 * colore del gruppo, nota, cornice) e, per le fonti che ce l'hanno, l'immagine di anteprima.
 */
function MiniNode({ id, x, y, width, height, className, color, selected }: MiniMapNodeProps) {
  const r = useResources((s) => (className === 'mm-res' ? s.resources.find((x) => x.id === id) ?? s.libraryItems.find((x) => x.id === id) : undefined));
  const thumb = r ? thumbUrl(r) : null;
  const cls = `mm ${className} ${selected ? 'is-selected' : ''}`;
  if (className === 'mm-frame') return <rect className={cls} x={x} y={y} width={width} height={height} rx={8} />;
  const band = Math.min(height * 0.28, 40);
  return (
    <g className={cls}>
      <rect className="mm__card" x={x} y={y} width={width} height={height} rx={10} style={color ? { stroke: color } : undefined} />
      {thumb ? (
        <image href={thumb} x={x + 4} y={y + 4} width={width - 8} height={height * 0.62} preserveAspectRatio="xMidYMid slice" />
      ) : (
        <rect className="mm__band" x={x} y={y} width={width} height={band} rx={10} style={color ? { fill: color } : undefined} />
      )}
      {/* righe di testo stilizzate */}
      <rect className="mm__line" x={x + width * 0.12} y={y + height * 0.72} width={width * 0.7} height={Math.max(4, height * 0.06)} rx={2} />
      <rect className="mm__line" x={x + width * 0.12} y={y + height * 0.84} width={width * 0.45} height={Math.max(4, height * 0.06)} rx={2} />
    </g>
  );
}

/** Una pergamena del Compendium: nodo fisso (sempre presente), si collega come le risorse, doppio clic per aprirla. */
function DocNode({ data, selected }: NodeProps<Node<DocNodeData>>) {
  return (
    <div className={`wb-doc ${selected ? 'is-selected' : ''} ${data.active ? 'is-active' : ''}`}>
      <Handles />
      <div className="wb-doc__icon">
        <ScrollText size={20} strokeWidth={1.6} />
      </div>
      <div className="wb-doc__text">
        <span className="wb-doc__kind">{data.active ? t('wb.doc.active') : t('wb.doc.kind')}</span>
        <strong className="wb-doc__title">{data.doc.title}</strong>
        <span className="wb-doc__meta">
          <Link2 size={11} /> {t('wb.doc.links', { n: data.linked })}
        </span>
      </div>
    </div>
  );
}

function ResNode({ data, selected }: NodeProps<Node<ResNodeData>>) {
  return (
    <div className={`wb-node ${selected ? 'is-selected' : ''}`}>
      <Handles />
      <ResourceCard r={data.r} color={data.color} />
    </div>
  );
}

function NoteNode({ data, selected }: NodeProps<Node<NoteNodeData>>) {
  return (
    <div className={`wb-note ${selected ? 'is-selected' : ''}`}>
      <NodeResizer isVisible={selected} minWidth={120} minHeight={70} onResizeEnd={(_, p) => updateNote(data.note.id, { w: p.width, h: p.height, x: p.x, y: p.y })} />
      <Handles />
      <textarea
        className="wb-note__text nodrag"
        defaultValue={data.note.text}
        placeholder={t('wb.notePlaceholder')}
        onBlur={(e) => updateNote(data.note.id, { text: e.target.value })}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function FrameNode({ data, selected }: NodeProps<Node<FrameNodeData>>) {
  return (
    <div className={`wb-frame ${selected ? 'is-selected' : ''}`}>
      <NodeResizer isVisible={selected} minWidth={200} minHeight={140} onResizeEnd={(_, p) => updateFrame(data.frame.id, { w: p.width, h: p.height, x: p.x, y: p.y })} />
      <div className="wb-frame__title">{data.frame.title}</div>
    </div>
  );
}

function updateNote(id: string, patch: Partial<WbNote>) {
  const st = useResources.getState();
  st.setWhiteboard({ ...st.whiteboard, notes: st.whiteboard.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
}

function updateFrame(id: string, patch: Partial<WbFrame>) {
  const st = useResources.getState();
  st.setWhiteboard({ ...st.whiteboard, frames: st.whiteboard.frames.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
}

const nodeTypes = { res: ResNode, note: NoteNode, frame: FrameNode, doc: DocNode };

/** Comandi della whiteboard chiamati dal ribbon. */
export const wbApi: { addNote?: () => void; addFrame?: () => void; fit?: () => void; addActiveDoc?: () => void; pan?: boolean; setPan?: (v: boolean) => void } = {};

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function Board() {
  const resources = useResources((s) => (s.scope === 'vault' ? s.resources : s.libraryItems));
  const scope = useResources((s) => s.scope);
  const layers = useResources((s) => s.layers);
  const active = useResources((s) => s.activeLayer);
  const texts = useResources((s) => s.texts);
  const wb = useResources((s) => s.whiteboard);
  const links = useResources((s) => s.links);
  const selected = useResources((s) => s.selected);
  const flow = useReactFlow();
  const wrap = useRef<HTMLDivElement>(null);
  const docs = useWorkspace((s) => s.docs);
  const activeDoc = useWorkspace((s) => s.activeDoc);
  // finestra di scelta delle pergamene: da mettere sulla Tabula o da collegare a una pergamena
  const [picker, setPicker] = useState<{ mode: 'link'; rel: string } | null>(null);

  const visible = useMemo(() => resources.filter((r) => isVisible(r, layers, active, resources, texts)), [resources, layers, active, texts]);

  // posizione iniziale in griglia per le risorse non ancora piazzate
  const pos = useCallback(
    (r: Resource, i: number) => wb.nodes[r.id] ?? { x: (i % 5) * 270, y: Math.floor(i / 5) * 250 },
    [wb.nodes],
  );

  // misure dei nodi (le manda React Flow con le modifiche 'dimensions')
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  const docPos = useMemo(() => placeDocNodes(docs.map((d) => d.rel), wb.nodes), [docs, wb.nodes]);

  // le pergamene appena comparse si fissano dove sono state messe: spostarne una non fa saltare le altre
  useEffect(() => {
    if (scope !== 'vault') return;
    const missing = Object.entries(docPos).filter(([id]) => !wb.nodes[id]);
    if (!missing.length) return;
    const st = useResources.getState();
    st.setWhiteboard({ ...st.whiteboard, nodes: { ...st.whiteboard.nodes, ...Object.fromEntries(missing) } });
  }, [docPos, wb.nodes, scope]);

  const nodes: Node[] = useMemo(() => {
    const frames: Node[] = wb.frames.map((f) => ({
      id: f.id,
      type: 'frame',
      position: { x: f.x, y: f.y },
      style: { width: f.w, height: f.h },
      data: { frame: f },
      zIndex: -1,
      selected: selected.includes(f.id),
    }));
    const res: Node[] = visible.map((r, i) => ({
      id: r.id,
      type: 'res',
      position: pos(r, resources.indexOf(r) >= 0 ? resources.indexOf(r) : i),
      data: { r, color: colorOf(r, layers) },
      draggable: !isLocked(r, layers),
      selected: selected.includes(r.id),
    }));
    const notes: Node[] =
      scope === 'vault'
        ? wb.notes.map((n) => ({
            id: n.id,
            type: 'note',
            position: { x: n.x, y: n.y },
            style: { width: n.w, height: n.h },
            data: { note: n },
            selected: selected.includes(n.id),
          }))
        : [];
    // tutte le pergamene del Compendium sono nodi fissi: sempre presenti, si spostano ma non si tolgono
    // (solo nel Compendium, non nella Library)
    const docNodes: Node[] =
      scope === 'vault'
        ? docs.map((d) => ({
            id: docNodeId(d.rel),
            type: 'doc',
            position: docPos[docNodeId(d.rel)],
            data: { doc: d, active: d.rel === activeDoc, linked: linkedDocs(links, d.rel).length },
            deletable: false,
            selected: selected.includes(docNodeId(d.rel)),
          }))
        : [];
    // le misure prese da React Flow tornano nei nodi: senza, il navigatore non sa disegnarli
    return [...frames, ...res, ...notes, ...docNodes].map((n) => (sizes[n.id] ? { ...n, measured: sizes[n.id] } : n));
  }, [visible, wb, layers, selected, pos, resources, scope, docs, activeDoc, links, docPos, sizes]);

  const ids = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = links
    .filter((l) => ids.has(l.from) && ids.has(l.to))
    .map((l) => ({
      id: l.id,
      type: 'floating',
      source: l.from,
      target: l.to,
      label: l.label,
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
    }));

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const st = useResources.getState();
      const dims = changes.filter((c) => c.type === 'dimensions' && c.dimensions);
      if (dims.length)
        setSizes((prev) => {
          let next = prev;
          for (const c of dims) {
            if (c.type !== 'dimensions' || !c.dimensions) continue;
            const old = prev[c.id];
            if (old && old.width === c.dimensions.width && old.height === c.dimensions.height) continue;
            if (next === prev) next = { ...prev };
            next[c.id] = c.dimensions;
          }
          return next;
        });
      const sel = changes.filter((c) => c.type === 'select');
      if (sel.length) {
        const cur = new Set(st.selected);
        for (const c of sel) if (c.type === 'select') (c.selected ? cur.add(c.id) : cur.delete(c.id));
        st.select([...cur]);
      }
      const moved = applyNodeChanges(
        changes.filter((c) => c.type === 'position'),
        nodes,
      );
      const finished = changes.filter((c) => c.type === 'position' && !c.dragging);
      if (changes.some((c) => c.type === 'position')) {
        const w = st.whiteboard;
        const next = { ...w, nodes: { ...w.nodes }, notes: [...w.notes], frames: [...w.frames] };
        for (const n of moved) {
          if (n.type === 'res' || n.type === 'doc') next.nodes[n.id] = { x: n.position.x, y: n.position.y };
          if (n.type === 'note') next.notes = next.notes.map((x) => (x.id === n.id ? { ...x, x: n.position.x, y: n.position.y } : x));
          if (n.type === 'frame') next.frames = next.frames.map((x) => (x.id === n.id ? { ...x, x: n.position.x, y: n.position.y } : x));
        }
        // durante il trascinamento si aggiorna solo lo stato, il salvataggio ha il suo ritardo
        useResources.setState({ whiteboard: next });
        if (finished.length) st.setWhiteboard(next);
      }
      // le pergamene sono nodi fissi: non si tolgono dalla Tabula
      const removed = changes.filter((c) => c.type === 'remove' && !relOfNode(c.id)).map((c) => (c as { id: string }).id);
      if (removed.length) {
        const w = st.whiteboard;
        st.setWhiteboard({
          ...w,
          notes: w.notes.filter((n) => !removed.includes(n.id)),
          frames: w.frames.filter((f) => !removed.includes(f.id)),
        });
      }
    },
    [nodes],
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const c of changes) if (c.type === 'remove') useResources.getState().removeLink(c.id);
  }, []);

  const onConnect = useCallback((c: Connection) => {
    if (c.source && c.target) useResources.getState().addLink(c.source, c.target);
  }, []);

  /** Porta in vista il nodo di una pergamena. */
  const focusDoc = (rel: string) => {
    const id = docNodeId(rel);
    useResources.getState().select([id]);
    void flow.fitView({ nodes: [{ id }], padding: 0.6, maxZoom: 1, duration: 300 });
  };

  const center = () => {
    const r = wrap.current?.getBoundingClientRect();
    return flow.screenToFlowPosition({ x: (r?.left ?? 0) + (r?.width ?? 800) / 2, y: (r?.top ?? 0) + (r?.height ?? 600) / 2 });
  };

  useEffect(() => {
    wbApi.addNote = () => {
      const st = useResources.getState();
      const p = center();
      st.setWhiteboard({ ...st.whiteboard, notes: [...st.whiteboard.notes, { id: uid('n'), x: p.x - 90, y: p.y - 50, w: 200, h: 120, text: '' }] });
    };
    wbApi.addFrame = async () => {
      const title = await promptDialog(t('wb.frameTitle'), t('wb.frameDefault'));
      if (title === null) return;
      const st = useResources.getState();
      const p = center();
      st.setWhiteboard({ ...st.whiteboard, frames: [...st.whiteboard.frames, { id: uid('f'), x: p.x - 300, y: p.y - 200, w: 600, h: 400, title }] });
    };
    wbApi.fit = () => flow.fitView({ padding: 0.15, duration: 300 });
    wbApi.addActiveDoc = () => {
      const rel = useWorkspace.getState().activeDoc;
      if (rel) focusDoc(rel);
    };
  });

  return (
    <div
      className="whiteboard"
      ref={wrap}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(RESOURCES_MIME)) e.preventDefault();
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={36}
        onNodeClick={(_, n) => {
          if (n.type === 'res') useResources.getState().openInspector(n.id);
        }}
        onNodeDoubleClick={(_, n) => {
          if (n.type === 'res') useResources.getState().openViewer(n.id);
          const rel = relOfNode(n.id);
          if (n.type === 'doc' && rel) {
            useWorkspace.getState().openDoc(rel);
            useWorkspace.getState().setView('editor');
          }
        }}
        onEdgeDoubleClick={async (_, e) => {
          const label = await promptDialog(t('wb.linkLabel'), String(e.label ?? ''));
          if (label !== null) useResources.getState().updateLink(e.id, label);
        }}
        onNodeContextMenu={(e, n) => {
          const rel = relOfNode(n.id);
          if (n.type === 'doc' && rel) {
            e.preventDefault();
            openContextMenu(e as React.MouseEvent, [
              { label: t('wb.doc.open'), onClick: () => (useWorkspace.getState().openDoc(rel), useWorkspace.getState().setView('editor')) },
              { label: t('wb.doc.linkTo'), onClick: () => setPicker({ mode: 'link', rel }) },
            ]);
            return;
          }
          if (n.type !== 'res') return;
          e.preventDefault();
          openContextMenu(e as React.MouseEvent, [
            { label: t('embed.open'), onClick: () => useResources.getState().openViewer(n.id) },
            { label: t('cmd.res.remove'), danger: true, onClick: () => void removeWithConfirm([n.id]) },
          ]);
        }}
        onPaneContextMenu={(e) =>
          openContextMenu(e as React.MouseEvent, [
            { label: t('cmd.wb.note'), onClick: () => wbApi.addNote?.() },
            { label: t('cmd.wb.frame'), onClick: () => void wbApi.addFrame?.() },
            { label: t('cmd.wb.fit'), onClick: () => wbApi.fit?.() },
          ])
        }
        onMoveEnd={(_, vp) => {
          const st = useResources.getState();
          st.setWhiteboard({ ...st.whiteboard, viewport: vp });
        }}
        defaultViewport={wb.viewport ?? { x: 40, y: 40, zoom: 0.9 }}
        minZoom={0.1}
        maxZoom={2.5}
        deleteKeyCode={['Delete', 'Backspace']}
        selectionOnDrag={!wbApi.pan}
        panOnDrag={wbApi.pan ? true : [1, 2]}
        fitView={!wb.viewport}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} />
        <MiniMap
          pannable
          zoomable
          className="wb-minimap"
          style={{ width: 240, height: 170 }}
          nodeComponent={MiniNode}
          nodeClassName={(n) => `mm-${n.type ?? 'res'}`}
          nodeColor={(n) => (n.type === 'res' ? ((n.data as ResNodeData).color ?? '') : '')}
        />
        <Controls showInteractive={false} className="wb-controls" />
      </ReactFlow>
      {picker?.mode === 'link' && (
        <DocPicker
          title={t('wb.doc.linkTitle', { name: docs.find((d) => d.rel === picker.rel)?.title ?? '' })}
          action={t('wb.doc.linkAction')}
          exclude={[picker.rel, ...linkedDocs(links, picker.rel)]}
          onPick={(rels) => {
            for (const r of rels) useResources.getState().addLink(docNodeId(picker.rel), docNodeId(r));
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

export function Whiteboard() {
  return (
    <ReactFlowProvider>
      <Board />
    </ReactFlowProvider>
  );
}
