// Whiteboard: risorse come schede libere, note, cornici; i collegamenti si tracciano
// trascinando dai punti di aggancio. Posizioni e collegamenti sono salvati nel vault.
import { useCallback, useEffect, useMemo, useRef } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useResources } from '../store';
import { isVisible, isLocked, colorOf, type Resource } from '../model';
import { ResourceCard } from './common';
import { t } from '../../i18n';
import { openContextMenu } from '../../components/ContextMenu';
import { promptDialog } from '../../components/confirm';
import type { WbNote, WbFrame } from '../storage';
import { RESOURCES_MIME } from './LayersPanel';

type ResNodeData = { r: Resource; color: string | null };
type NoteNodeData = { note: WbNote };
type FrameNodeData = { frame: WbFrame };

function ResNode({ data, selected }: NodeProps<Node<ResNodeData>>) {
  return (
    <div className={`wb-node ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="wb-handle" />
      <Handle type="source" position={Position.Right} className="wb-handle" />
      <Handle type="target" position={Position.Top} id="t" className="wb-handle" />
      <Handle type="source" position={Position.Bottom} id="b" className="wb-handle" />
      <ResourceCard r={data.r} color={data.color} />
    </div>
  );
}

function NoteNode({ data, selected }: NodeProps<Node<NoteNodeData>>) {
  return (
    <div className={`wb-note ${selected ? 'is-selected' : ''}`}>
      <NodeResizer isVisible={selected} minWidth={120} minHeight={70} onResizeEnd={(_, p) => updateNote(data.note.id, { w: p.width, h: p.height, x: p.x, y: p.y })} />
      <Handle type="target" position={Position.Left} className="wb-handle" />
      <Handle type="source" position={Position.Right} className="wb-handle" />
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

const nodeTypes = { res: ResNode, note: NoteNode, frame: FrameNode };

/** Comandi della whiteboard chiamati dal ribbon. */
export const wbApi: { addNote?: () => void; addFrame?: () => void; fit?: () => void; pan?: boolean; setPan?: (v: boolean) => void } = {};

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

  const visible = useMemo(() => resources.filter((r) => isVisible(r, layers, active, resources, texts)), [resources, layers, active, texts]);

  // posizione iniziale in griglia per le risorse non ancora piazzate
  const pos = useCallback(
    (r: Resource, i: number) => wb.nodes[r.id] ?? { x: (i % 5) * 270, y: Math.floor(i / 5) * 250 },
    [wb.nodes],
  );

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
    return [...frames, ...res, ...notes];
  }, [visible, wb, layers, selected, pos, resources, scope]);

  const ids = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = links
    .filter((l) => ids.has(l.from) && ids.has(l.to))
    .map((l) => ({
      id: l.id,
      source: l.from,
      target: l.to,
      label: l.label,
      className: 'wb-edge',
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
    }));

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const st = useResources.getState();
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
          if (n.type === 'res') next.nodes[n.id] = { x: n.position.x, y: n.position.y };
          if (n.type === 'note') next.notes = next.notes.map((x) => (x.id === n.id ? { ...x, x: n.position.x, y: n.position.y } : x));
          if (n.type === 'frame') next.frames = next.frames.map((x) => (x.id === n.id ? { ...x, x: n.position.x, y: n.position.y } : x));
        }
        // durante il trascinamento si aggiorna solo lo stato, il salvataggio ha il suo ritardo
        useResources.setState({ whiteboard: next });
        if (finished.length) st.setWhiteboard(next);
      }
      const removed = changes.filter((c) => c.type === 'remove').map((c) => c.id);
      if (removed.length) {
        const w = st.whiteboard;
        st.setWhiteboard({ ...w, notes: w.notes.filter((n) => !removed.includes(n.id)), frames: w.frames.filter((f) => !removed.includes(f.id)) });
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
        onNodeClick={(_, n) => n.type === 'res' && useResources.getState().openInspector(n.id)}
        onNodeDoubleClick={(_, n) => n.type === 'res' && useResources.getState().openViewer(n.id)}
        onEdgeDoubleClick={async (_, e) => {
          const label = await promptDialog(t('wb.linkLabel'), String(e.label ?? ''));
          if (label !== null) useResources.getState().updateLink(e.id, label);
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
        <MiniMap pannable zoomable className="wb-minimap" />
        <Controls showInteractive={false} />
      </ReactFlow>
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
