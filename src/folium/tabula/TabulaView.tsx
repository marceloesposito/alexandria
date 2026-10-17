// Armarium del foglio: la Tabula "gravitazionale". I blocchi trovano da soli il loro posto in un
// flusso dall'alto in basso (flowLayout) e ci arrivano con una fisica morbida (gravity); trascinati,
// gli altri si scansano; lasciati poco sotto un altro blocco ci si attaccano, come in Scratch.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Handle, Position, Background, BackgroundVariant, useReactFlow, type Node, type Edge, type NodeChange, type NodeProps, type Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { create } from 'zustand';
import { GripVertical, Image as ImageIcon, Link2, StickyNote, Quote, ExternalLink, Plus, Search, Minus, Maximize2, ChevronDown } from 'lucide-react';
import { useFolium, mediaUrl } from '../store';
import { useUi } from '../ui';
import { attach, detach, newId, parentOf, removeBlocks, BLOCK_W, type Block, type BlockKind, type Tabula } from './model';
import { attachRule, flowLayout, type FlowItem } from './flowLayout';
import { createGravity, retarget, settle, type Body } from './gravity';
import { EXCERPT_MIME, BLOCK_MIME } from './dnd';
import { blocksAtCursor, scrollToExcerpt, type ExcerptData } from './bridge';
import { FloatingBar, BarSep, CmdButton } from '../FloatingBar';
import { Popover } from '../../components/Popover';
import { openContextMenu } from '../../components/ContextMenu';
import { promptDialog } from '../../components/confirm';
import { getEditor, useEditorRef } from '../editor/editorRef';
import { platform } from '../../platform';
import type { Simulation } from 'd3-force';
import { t, useLang } from '../../i18n';

type BlockData = { block: Block; lit: boolean; found: boolean };

/** Il blocco in scrittura (al piu' uno): fuori dalla scrittura un clic seleziona e trascina. */
const useEditing = create<{ id: string | null }>(() => ({ id: null }));

function tabula(): Tabula {
  return useFolium.getState().sheet!.tabula;
}

function setTabula(next: Tabula) {
  useFolium.getState().setTabula(next);
}

function updateBlock(id: string, patch: Partial<Block>) {
  const tb = tabula();
  setTabula({ ...tb, blocks: tb.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
}

function deleteBlocks(ids: string[]) {
  setTabula(removeBlocks(tabula(), ids));
}

async function editLinkBlock(b: Block) {
  const url = await promptDialog(t('tabula.linkUrl'), b.url ?? '');
  if (url === null || !url.trim()) return;
  const title = await promptDialog(t('tabula.linkTitle'), b.text || url.trim());
  updateBlock(b.id, { url: url.trim(), text: (title ?? '').trim() });
}

const ICON: Record<BlockKind, typeof StickyNote> = { note: StickyNote, excerpt: Quote, image: ImageIcon, link: Link2 };

function BlockNode({ data, selected }: NodeProps<Node<BlockData>>) {
  const b = data.block;
  const editing = useEditing((s) => s.id === b.id);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!editing || !el) return;
    let tries = 0;
    let raf = 0;
    const focus = () => {
      el.focus();
      if (document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length);
      else if (tries++ < 20) raf = requestAnimationFrame(focus);
    };
    focus();
    return () => cancelAnimationFrame(raf);
  }, [editing]);
  const Icon = ICON[b.kind];
  const onDouble = () => {
    if (b.kind === 'note') useEditing.setState({ id: b.id });
    else if (b.kind === 'excerpt' && b.anchor) {
      const e = getEditor();
      if (e) scrollToExcerpt(e, b.anchor);
    } else if (b.kind === 'link') void editLinkBlock(b);
    else if (b.kind === 'image') useEditing.setState({ id: b.id });
  };
  return (
    <div className={`fx-block-node fx-block-node--${b.kind} ${selected ? 'is-selected' : ''} ${editing ? 'is-editing' : ''} ${data.lit ? 'is-lit' : ''} ${data.found ? 'is-found' : ''}`} onDoubleClick={onDouble}>
      <Handle type="target" position={Position.Top} className="fx-handle" />
      <div className="fx-block-node__head">
        <Icon size={13} />
        <span className="fx-block-node__kind">{t(`tabula.kind.${b.kind}`)}</span>
        <span
          className="fx-block-node__grip nodrag"
          draggable
          title={t('tabula.dragToText')}
          onDragStart={(e) => {
            e.dataTransfer.setData(BLOCK_MIME, JSON.stringify(b));
            e.dataTransfer.setData('text/plain', b.url ?? b.text);
            e.dataTransfer.effectAllowed = 'copy';
          }}
        >
          <GripVertical size={13} />
        </span>
      </div>
      {b.kind === 'image' && b.src && <img className="fx-block-node__img" src={mediaUrl(b.src)} alt={b.text} draggable={false} />}
      {b.kind === 'link' ? (
        <div className="fx-block-node__link">
          <strong>{b.text || b.url}</strong>
          <button className="fx-icon nodrag" title={t('tabula.openLink')} aria-label={t('tabula.openLink')} onClick={() => b.url && void platform.openExternal(b.url)}>
            <ExternalLink size={13} />
          </button>
          <span className="fx-muted">{b.url}</span>
        </div>
      ) : b.kind === 'excerpt' ? (
        <blockquote className="fx-block-node__quote">{b.anchor?.quote ?? b.text}</blockquote>
      ) : (
        <textarea
          ref={ref}
          className={`fx-block-node__text ${editing ? 'nodrag nowheel' : ''}`}
          readOnly={!editing}
          tabIndex={editing ? 0 : -1}
          defaultValue={b.text}
          placeholder={b.kind === 'image' ? t('tabula.caption') : t('tabula.notePlaceholder')}
          rows={b.kind === 'image' ? 1 : 3}
          onBlur={(e) => {
            if (e.target.value !== b.text) updateBlock(b.id, { text: e.target.value });
            if (useEditing.getState().id === b.id) useEditing.setState({ id: null });
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') e.currentTarget.blur();
            else if (e.key === 'Backspace' && !e.currentTarget.value && b.kind === 'note') {
              e.preventDefault();
              useEditing.setState({ id: null });
              deleteBlocks([b.id]);
            }
          }}
        />
      )}
      <Handle type="source" position={Position.Bottom} className="fx-handle" />
    </div>
  );
}

const nodeTypes = { block: BlockNode };

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function Board({ narrow }: { narrow: boolean }) {
  useLang();
  const tb = useFolium((s) => s.sheet?.tabula);
  const sheetId = useFolium((s) => s.sheet?.meta.id);
  const flow = useReactFlow();
  const wrap = useRef<HTMLDivElement>(null);
  const popover = useUi((s) => s.popover);
  const addRef = useRef<HTMLButtonElement>(null);
  const findRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  const [zoom, setZoom] = useState(1);
  const sim = useRef<{ sim: Simulation<Body, undefined>; bodies: Map<string, Body> } | null>(null);
  const raf = useRef(0);
  const dragging = useRef<string | null>(null);
  const edTick = useEditorRef((s) => s.tick);

  const blocks = tb?.blocks ?? [];
  const links = tb?.links ?? [];

  const sizeOf = useCallback((b: Block) => ({ w: sizes[b.id]?.width ?? b.w, h: sizes[b.id]?.height ?? b.h }), [sizes]);

  /** Posti d'equilibrio con le posizioni attuali (l'ordine dei fratelli viene da li'). */
  const targets = useCallback(
    (override?: Record<string, { x: number; y: number }>) => {
      const width = Math.max(BLOCK_W + 40, ((wrap.current?.clientWidth ?? 800) - 64) / (flow.getZoom() || 1));
      const items: FlowItem[] = tabula().blocks.map((b) => ({ id: b.id, ...(override?.[b.id] ?? pos[b.id] ?? { x: b.x, y: b.y }), ...sizeOf(b) }));
      return flowLayout(items, tabula().links, { maxWidth: narrow ? Math.min(width, BLOCK_W * 2 + 60) : width });
    },
    [flow, pos, sizeOf, narrow],
  );

  const persist = useCallback(() => {
    const s = sim.current;
    if (!s) return;
    const cur = tabula();
    let changed = false;
    const blocksNext = cur.blocks.map((b) => {
      const body = s.bodies.get(b.id);
      if (!body) return b;
      const x = Math.round(body.tx);
      const y = Math.round(body.ty);
      const { w, h } = sizeOf(b);
      if (b.x === x && b.y === y && b.w === Math.round(w) && b.h === Math.round(h)) return b;
      changed = true;
      return { ...b, x, y, w: Math.round(w), h: Math.round(h) };
    });
    if (changed) setTabula({ ...cur, blocks: blocksNext });
  }, [sizeOf]);

  const animate = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const step = () => {
      const s = sim.current;
      if (!s) return;
      s.sim.tick();
      const next: Record<string, { x: number; y: number }> = {};
      for (const b of s.sim.nodes()) next[b.id] = { x: b.x, y: b.y };
      setPos(next);
      if (s.sim.alpha() > s.sim.alphaMin() || dragging.current) raf.current = requestAnimationFrame(step);
      else persist();
    };
    raf.current = requestAnimationFrame(step);
  }, [persist]);

  // struttura cambiata (blocchi, collegamenti, misure): nuovi posti e la fisica li raggiunge
  const structure = `${sheetId}|${blocks.map((b) => b.id).join(',')}|${links.map((l) => `${l.from}>${l.to}`).join(',')}|${Object.entries(sizes)
    .map(([k, v]) => `${k}:${Math.round(v.width)}x${Math.round(v.height)}`)
    .join(',')}|${narrow}`;
  useEffect(() => {
    if (!tb) return;
    const tg = targets();
    const prev = sim.current?.bodies;
    const bodies = new Map<string, Body>();
    for (const b of tb.blocks) {
      const { w, h } = sizeOf(b);
      const old = prev?.get(b.id);
      const t0 = tg.get(b.id)!;
      bodies.set(b.id, { id: b.id, w, h, tx: t0.x, ty: t0.y, x: old?.x ?? b.x, y: old?.y ?? b.y });
    }
    sim.current?.sim.stop();
    const g = createGravity([...bodies.values()]);
    sim.current = { sim: g, bodies };
    if (reducedMotion() || !prev) {
      settle(g);
      const next: Record<string, { x: number; y: number }> = {};
      for (const b of g.nodes()) next[b.id] = { x: b.x, y: b.y };
      setPos(next);
      persist();
    } else {
      g.alpha(1);
      animate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // con "Entrambi" i blocchi ancorati al paragrafo del cursore si illuminano
  const lit = useMemo(() => {
    const e = getEditor();
    return e && blocks.length ? blocksAtCursor(e, blocks) : new Set<string>();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edTick, blocks]);

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return new Set<string>();
    return new Set(blocks.filter((b) => `${b.text} ${b.url ?? ''} ${b.anchor?.quote ?? ''}`.toLowerCase().includes(q)).map((b) => b.id));
  }, [query, blocks]);

  const nodes: Node<BlockData>[] = blocks.map((b) => ({
    id: b.id,
    type: 'block',
    position: pos[b.id] ?? { x: b.x, y: b.y },
    data: { block: b, lit: lit.has(b.id), found: found.has(b.id) },
    selected: selected.has(b.id),
    style: { width: b.kind === 'image' ? Math.max(BLOCK_W, b.w) : BLOCK_W },
    // le misure prese da React Flow tornano nei nodi: senza, il nodo resta nascosto
    ...(sizes[b.id] ? { measured: sizes[b.id] } : {}),
  }));

  const edges: Edge[] = links.map((l) => ({ id: l.id, source: l.from, target: l.to, type: 'default', className: 'fx-edge' }));

  const onNodesChange = (changes: NodeChange<Node<BlockData>>[]) => {
    const s = sim.current;
    const dims = changes.filter((c) => c.type === 'dimensions' && c.dimensions);
    if (dims.length)
      setSizes((prev) => {
        let next = prev;
        for (const c of dims) {
          if (c.type !== 'dimensions' || !c.dimensions) continue;
          const o = prev[c.id];
          if (o && Math.abs(o.width - c.dimensions.width) < 1 && Math.abs(o.height - c.dimensions.height) < 1) continue;
          if (next === prev) next = { ...prev };
          next[c.id] = c.dimensions;
        }
        return next;
      });
    const sel = changes.filter((c) => c.type === 'select');
    if (sel.length)
      setSelected((prev) => {
        const next = new Set(prev);
        for (const c of sel) if (c.type === 'select') (c.selected ? next.add(c.id) : next.delete(c.id));
        return next;
      });
    for (const c of changes) {
      if (c.type !== 'position' || !s) continue;
      const body = s.bodies.get(c.id);
      if (!body) continue;
      if (c.dragging && c.position) {
        // il blocco segue il mouse, gli altri si scansano
        if (!dragging.current) {
          dragging.current = c.id;
          s.sim.alphaTarget(0.3).restart().stop();
          animate();
        }
        body.fx = c.position.x;
        body.fy = c.position.y;
        body.x = c.position.x;
        body.y = c.position.y;
      } else if (!c.dragging && dragging.current === c.id) {
        dragging.current = null;
        drop(c.id, body);
      }
    }
    const removed = changes.filter((c) => c.type === 'remove').map((c) => (c as { id: string }).id);
    if (removed.length) deleteBlocks(removed);
  };

  /** Rilascio: collega o stacca, poi tutti cadono verso i nuovi posti. */
  const drop = (id: string, body: Body) => {
    const s = sim.current!;
    const cur = tabula();
    const others: FlowItem[] = cur.blocks.filter((b) => b.id !== id).map((b) => ({ id: b.id, x: s.bodies.get(b.id)?.x ?? b.x, y: s.bodies.get(b.id)?.y ?? b.y, ...sizeOf(b) }));
    const parent = parentOf(cur, id);
    const rule = attachRule({ id, x: body.x, y: body.y, w: body.w, h: body.h }, others, { parent, home: { x: body.tx, y: body.ty } });
    body.fx = null;
    body.fy = null;
    s.sim.alphaTarget(0);
    let next = cur;
    if (rule && 'attach' in rule) next = attach(cur, rule.attach, id);
    else if (rule && 'detach' in rule) next = detach(cur, id);
    const override: Record<string, { x: number; y: number }> = {};
    for (const b of s.sim.nodes()) override[b.id] = { x: b.x, y: b.y };
    if (next !== cur) setTabula(next);
    // posti nuovi anche senza cambi di collegamento: l'ordine dei fratelli segue la posizione
    const tg = flowLayout(
      next.blocks.map((b) => ({ id: b.id, ...override[b.id], ...sizeOf(b) })),
      next.links,
      { maxWidth: narrow ? BLOCK_W * 2 + 60 : Math.max(BLOCK_W + 40, ((wrap.current?.clientWidth ?? 800) - 64) / (flow.getZoom() || 1)) },
    );
    retarget(s.sim, tg);
    s.sim.alpha(0.8);
    if (reducedMotion()) {
      settle(s.sim);
      const p: Record<string, { x: number; y: number }> = {};
      for (const b of s.sim.nodes()) p[b.id] = { x: b.x, y: b.y };
      setPos(p);
      persist();
    } else animate();
  };

  const onConnect = (c: Connection) => {
    if (c.source && c.target) setTabula(attach(tabula(), c.source, c.target));
  };

  /** Blocco nuovo in fondo alla Tabula (il flusso gli trova il posto). */
  const addBlock = (kind: BlockKind, patch: Partial<Block> = {}) => {
    const cur = tabula();
    const bottom = Math.max(0, ...cur.blocks.map((b) => (pos[b.id]?.y ?? b.y) + b.h));
    const b: Block = { id: newId('b'), kind, text: '', x: 0, y: bottom + 40, w: BLOCK_W, h: kind === 'image' ? 180 : 90, ...patch };
    setTabula({ ...cur, blocks: [...cur.blocks, b] });
    if (kind === 'note') useEditing.setState({ id: b.id });
    return b;
  };

  const addImage = async () => {
    const paths = await platform.pickFiles(t('insert.pickImage'), ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
    for (const p of paths) {
      const src = useFolium.getState().addMedia(p.slice(p.lastIndexOf('/') + 1), await platform.readBytes(p));
      addBlock('image', { src });
    }
  };

  const addLink = async () => {
    const url = await promptDialog(t('tabula.linkUrl'), 'https://');
    if (url === null || !url.trim() || url.trim() === 'https://') return;
    const title = await promptDialog(t('tabula.linkTitle'), '');
    addBlock('link', { url: url.trim(), text: (title ?? '').trim() });
  };

  // la barretta della Tabula comanda lo zoom
  useEffect(() => {
    useUi.setState({
      tabula: {
        zoomIn: () => void flow.zoomIn({ duration: 200 }),
        zoomOut: () => void flow.zoomOut({ duration: 200 }),
        fit: () => void flow.fitView({ padding: 0.15, duration: 300, maxZoom: 1.2 }),
        zoom: () => flow.getZoom(),
      },
    });
    return () => useUi.setState({ tabula: null });
  }, [flow]);

  useEffect(() => {
    if (found.size) void flow.fitView({ nodes: [...found].map((id) => ({ id })), padding: 0.4, duration: 300, maxZoom: 1.2 });
  }, [found, flow]);

  const close = () => useUi.getState().close();

  if (!tb) return null;
  return (
    <div
      className="fx-tabula"
      ref={wrap}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(EXCERPT_MIME) || e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(EXCERPT_MIME);
        const at = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        if (raw) {
          e.preventDefault();
          const ex = JSON.parse(raw) as ExcerptData;
          addBlock('excerpt', { text: ex.text, anchor: ex.anchor, x: at.x, y: at.y });
          return;
        }
        const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
        if (!files.length) return;
        e.preventDefault();
        void (async () => {
          for (const f of files) addBlock('image', { src: useFolium.getState().addMedia(f.name, new Uint8Array(await f.arrayBuffer())), x: at.x, y: at.y });
        })();
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={(changes) => {
          const gone = changes.filter((c) => c.type === 'remove').map((c) => (c as { id: string }).id);
          if (gone.length) setTabula({ ...tabula(), links: tabula().links.filter((l) => !gone.includes(l.id)) });
        }}
        onConnect={onConnect}
        onMove={(_, vp) => setZoom(vp.zoom)}
        onNodeContextMenu={(e, n) => {
          e.preventDefault();
          const b = (n.data as BlockData).block;
          openContextMenu(e as React.MouseEvent, [
            ...(b.kind === 'note' || b.kind === 'image' ? [{ label: t('cmd.block.edit'), onClick: () => useEditing.setState({ id: b.id }) }] : []),
            ...(b.kind === 'link' ? [{ label: t('cmd.block.edit'), onClick: () => void editLinkBlock(b) }] : []),
            { label: t('cmd.block.delete'), danger: true, onClick: () => deleteBlocks([b.id]) },
          ]);
        }}
        onPaneContextMenu={(e) => e.preventDefault()}
        deleteKeyCode={['Delete', 'Backspace']}
        minZoom={0.2}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} />
      </ReactFlow>
      {!blocks.length && <div className="fx-tabula__empty">{t('tabula.empty')}</div>}
      <FloatingBar label={t('bar.tabula')}>
        <CmdButton id="tabula.add" ref={addRef} className="fx-btn--text" pressed={popover === 'tabulaAdd'}>
          <Plus size={15} />
          <span className="fx-btn__label">{t('tabula.block')}</span>
          <ChevronDown size={12} />
        </CmdButton>
        <BarSep />
        <CmdButton id="tabula.find" ref={findRef} pressed={popover === 'tabulaFind' || !!query}>
          <Search size={15} />
        </CmdButton>
        <BarSep />
        <CmdButton id="tabula.zoomOut">
          <Minus size={15} />
        </CmdButton>
        <span className="fx-fbar__value fx-mono">{Math.round(zoom * 100)}%</span>
        <CmdButton id="tabula.zoomIn">
          <Plus size={15} />
        </CmdButton>
        <CmdButton id="tabula.fit">
          <Maximize2 size={14} />
        </CmdButton>
      </FloatingBar>
      <Popover anchor={addRef.current} open={popover === 'tabulaAdd'} onClose={close} placement="above">
        <div className="fx-menu" role="menu">
          <button className="fx-menu__item" role="menuitem" onClick={() => (close(), addBlock('note'))}>
            <StickyNote size={15} /> <span>{t('tabula.kind.note')}</span>
          </button>
          <button className="fx-menu__item" role="menuitem" onClick={() => (close(), void addImage())}>
            <ImageIcon size={15} /> <span>{t('tabula.kind.image')}</span>
          </button>
          <button className="fx-menu__item" role="menuitem" onClick={() => (close(), void addLink())}>
            <Link2 size={15} /> <span>{t('tabula.kind.link')}</span>
          </button>
          <div className="fx-menu__hint">{t('tabula.excerptHint')}</div>
        </div>
      </Popover>
      <Popover anchor={findRef.current} open={popover === 'tabulaFind'} onClose={close} placement="above">
        <div className="fx-menu">
          <input className="fx-input" autoFocus value={query} placeholder={t('tabula.findPlaceholder')} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && (setQuery(''), close())} />
          {query && <div className="fx-menu__hint">{t('tabula.found', { n: found.size })}</div>}
        </div>
      </Popover>
    </div>
  );
}

export function TabulaView({ narrow = false }: { narrow?: boolean }) {
  return (
    <ReactFlowProvider>
      <Board narrow={narrow} />
    </ReactFlowProvider>
  );
}
