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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useResources } from '../store';
import { isVisible, isLocked, colorOf, type Resource } from '../model';
import { ResourceCard } from './common';
import { removeWithConfirm } from './remove';
import { t } from '../../i18n';
import { openContextMenu } from '../../components/ContextMenu';
import { promptDialog } from '../../components/confirm';
import type { WbNote, WbFrame } from '../storage';
import { RESOURCES_MIME } from './LayersPanel';
import { DocPicker } from './DocPicker';
import { docNodeId, relOfNode, linkedDocs } from '../docLinks';
import { useWorkspace } from '../../state/workspace';
import type { DocInfo } from '../../vault/vault';

type ResNodeData = { r: Resource; color: string | null };
type NoteNodeData = { note: WbNote };
type FrameNodeData = { frame: WbFrame };
type DocNodeData = { doc: DocInfo; active: boolean; linked: number };

/** Proxy di una pergamena del Compendium: si collega come le risorse, doppio clic per aprirla. */
function DocNode({ data, selected }: NodeProps<Node<DocNodeData>>) {
  return (
    <div className={`wb-doc ${selected ? 'is-selected' : ''} ${data.active ? 'is-active' : ''}`}>
      <Handle type="target" position={Position.Left} className="wb-handle" />
      <Handle type="source" position={Position.Right} className="wb-handle" />
      <Handle type="target" position={Position.Top} id="t" className="wb-handle" />
      <Handle type="source" position={Position.Bottom} id="b" className="wb-handle" />
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

const nodeTypes = { res: ResNode, note: NoteNode, frame: FrameNode, doc: DocNode };

/** Comandi della whiteboard chiamati dal ribbon. */
export const wbApi: { addNote?: () => void; addFrame?: () => void; fit?: () => void; addActiveDoc?: () => void; pickDocs?: () => void; pan?: boolean; setPan?: (v: boolean) => void } = {};

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
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'link'; rel: string } | null>(null);

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
    // pergamene del Compendium messe sulla Tabula (solo nel Compendium, non nella Library)
    const docNodes: Node[] =
      scope === 'vault'
        ? (wb.docs ?? [])
            .map((rel) => docs.find((d) => d.rel === rel))
            .filter((d): d is DocInfo => !!d)
            .map((d, i) => ({
              id: docNodeId(d.rel),
              type: 'doc',
              position: wb.nodes[docNodeId(d.rel)] ?? { x: -320, y: i * 130 },
              data: { doc: d, active: d.rel === activeDoc, linked: linkedDocs(links, d.rel).length },
              selected: selected.includes(docNodeId(d.rel)),
            }))
        : [];
    return [...frames, ...res, ...notes, ...docNodes];
  }, [visible, wb, layers, selected, pos, resources, scope, docs, activeDoc, links]);

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
          if (n.type === 'res' || n.type === 'doc') next.nodes[n.id] = { x: n.position.x, y: n.position.y };
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
        // togliere una pergamena dalla Tabula non la cancella: sparisce solo il nodo
        const goneDocs = removed.map(relOfNode).filter(Boolean) as string[];
        st.setWhiteboard({
          ...w,
          notes: w.notes.filter((n) => !removed.includes(n.id)),
          frames: w.frames.filter((f) => !removed.includes(f.id)),
          docs: (w.docs ?? []).filter((r) => !goneDocs.includes(r)),
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

  /** Pergamene sulla Tabula, una sotto l'altra al centro della vista (quelle gia' presenti restano dove sono). */
  const addDocs = (rels: string[]) => {
    const st = useResources.getState();
    const w = st.whiteboard;
    const have = new Set(w.docs ?? []);
    const fresh = rels.filter((r) => !have.has(r));
    const p = center();
    const nodes = { ...w.nodes };
    const placed = (w.docs ?? []).map((r) => nodes[docNodeId(r)]).filter(Boolean);
    const x0 = placed.length ? Math.min(...placed.map((n) => n.x)) : p.x - 120;
    let y = placed.length ? Math.max(...placed.map((n) => n.y)) + 130 : p.y - 50;
    for (const r of fresh) {
      if (nodes[docNodeId(r)]) continue;
      nodes[docNodeId(r)] = { x: x0, y };
      y += 130;
    }
    st.setWhiteboard({ ...w, nodes, docs: [...(w.docs ?? []), ...fresh] });
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
      if (rel) addDocs([rel]);
    };
    wbApi.pickDocs = () => setPicker({ mode: 'add' });
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
              { sep: true, label: '' },
              { label: t('wb.doc.remove'), onClick: () => onNodesChange([{ type: 'remove', id: n.id }]) },
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
        <MiniMap pannable zoomable className="wb-minimap" />
        <Controls showInteractive={false} className="wb-controls" />
      </ReactFlow>
      {picker?.mode === 'add' && (
        <DocPicker title={t('wb.doc.addTitle')} action={t('wb.doc.addAction')} exclude={wb.docs ?? []} onPick={addDocs} onClose={() => setPicker(null)} />
      )}
      {picker?.mode === 'link' && (
        <DocPicker
          title={t('wb.doc.linkTitle', { name: docs.find((d) => d.rel === picker.rel)?.title ?? '' })}
          action={t('wb.doc.linkAction')}
          exclude={[picker.rel, ...linkedDocs(links, picker.rel)]}
          onPick={(rels) => {
            // le pergamene collegate compaiono anche sulla Tabula, cosi' il legame si vede
            addDocs(rels);
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
