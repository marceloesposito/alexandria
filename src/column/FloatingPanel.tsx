// Finestre flottanti di Column: la Tabula sul bordo sinistro, il Palimpsestus sul destro. Ognuna e'
// un'unica finestra sopra il testo che non si apre e non si chiude, si sposta: riposta, scorre oltre
// il suo bordo e ne resta fuori una striscia alta quasi quanto la finestra; afferrandola la si tira
// dentro, spingendola oltre il bordo la si ripone. Si sposta dalla sua barra e si ridimensiona dagli
// orli; vicino ai bordi, se ci si ferma un attimo, propone l'aggancio a meta' o a un quadrante
// (tabula/snap.ts), come le finestre di Windows.
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useColumn } from './store';
import { useUi } from './ui';
import { togglePanelWin } from './commands';
import { commandTitle } from './FloatingBar';
import { NO_SNAP, clampFrame, dragClamp, parkedFrame, shouldPark, trackSnap, unsnap, zoneFrame, type Frame, type Side, type SnapState } from './tabula/snap';
import type { PanelId, PanelWin } from './sheets';
import { t, useLang } from '../i18n';

/** Larghezza della striscia che resta fuori dal bordo (px). */
const SLIVER = 18;

type Drag =
  | { kind: 'move'; start: { x: number; y: number }; frame: Frame; detached: boolean; fromRail: boolean }
  | { kind: 'resize'; edge: 'e' | 's' | 'se' | 'w' | 'sw'; start: { x: number; y: number }; frame: Frame };

/** Px -> frazioni dello spazio di lavoro. */
function rel(area: DOMRect, x: number, y: number) {
  return { x: (x - area.left) / area.width, y: (y - area.top) / area.height };
}

interface Props {
  id: PanelId;
  side: Side;
  title: string;
  icon: ComponentType<{ size?: number }>;
  /** comando che la richiama o la ripone */
  cmd: string;
  children: ReactNode;
}

export function FloatingPanel({ id, side, title, icon: Icon, cmd, children }: Props) {
  useLang();
  const win = useColumn((s) => s.app[id]);
  const front = useUi((s) => s.front === id);
  const area = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [live, setLive] = useState<Frame | null>(null);
  const [snap, setSnap] = useState<SnapState>(NO_SNAP);
  const drag = useRef<Drag | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const snapRef = useRef<SnapState>(NO_SNAP);
  const sliver = SLIVER / width;
  const parked = !win.open && !live;
  const frame = live ?? (win.open ? win.frame : parkedFrame(win.frame, sliver, side));

  const save = (p: Partial<PanelWin>) => useColumn.getState().setApp({ [id]: { ...useColumn.getState().app[id], ...p } });
  const toFront = () => useUi.setState({ front: id });

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 1200));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // il puntatore fermo vicino al bordo arma l'aggancio anche senza muoversi
  useEffect(() => {
    const iv = setInterval(() => {
      const d = drag.current;
      const p = pointer.current;
      const a = area.current?.getBoundingClientRect();
      if (!d || d.kind !== 'move' || !d.detached || !p || !a) return;
      const next = trackSnap(snapRef.current, p.x - a.left, p.y - a.top, a.width, a.height, Date.now());
      if (next.armed !== snapRef.current.armed || next.zone !== snapRef.current.zone) setSnap(next);
      snapRef.current = next;
    }, 50);
    return () => clearInterval(iv);
  }, []);

  const begin = (e: React.PointerEvent, d: Drag) => {
    if (e.button !== 0) return;
    e.preventDefault();
    toFront();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = d;
    pointer.current = { x: e.clientX, y: e.clientY };
    snapRef.current = NO_SNAP;
    setSnap(NO_SNAP);
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    const a = area.current?.getBoundingClientRect();
    if (!d || !a) return;
    pointer.current = { x: e.clientX, y: e.clientY };
    const p = rel(a, e.clientX, e.clientY);
    const s = rel(a, d.start.x, d.start.y);
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    if (d.kind === 'move') {
      if (!d.detached && Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) > 4) {
        d.detached = true;
        // una finestra agganciata si stacca al primo vero spostamento e torna alle sue misure
        if (win.open && win.snap) d.frame = unsnap(win.free, d.frame, s.x, s.y);
      }
      if (!d.detached) return;
      // la stessa finestra segue il puntatore, anche oltre il suo bordo
      setLive(dragClamp({ ...d.frame, x: d.frame.x + dx, y: d.frame.y + dy }, sliver, side));
      const next = trackSnap(snapRef.current, e.clientX - a.left, e.clientY - a.top, a.width, a.height, Date.now());
      snapRef.current = next;
      setSnap(next);
    } else {
      const f = { ...d.frame };
      if (d.edge.includes('e')) f.w = d.frame.w + dx;
      if (d.edge.includes('s')) f.h = d.frame.h + dy;
      if (d.edge.includes('w')) {
        f.x = d.frame.x + dx;
        f.w = d.frame.w - dx;
      }
      setLive(clampFrame(f));
    }
  };

  const end = () => {
    const d = drag.current;
    drag.current = null;
    pointer.current = null;
    const s = snapRef.current;
    snapRef.current = NO_SNAP;
    setSnap(NO_SNAP);
    if (!d) return;
    if (d.kind === 'move' && !d.detached) {
      // un clic sulla striscia tira dentro la finestra al suo posto
      if (d.fromRail) togglePanelWin(id, true);
      setLive(null);
      return;
    }
    // gia' piu' fuori che dentro: riporla vince sull'aggancio al bordo
    const park = !!live && d.kind === 'move' && shouldPark(live);
    if (d.kind === 'move' && s.armed && s.zone && !park) {
      // aggancio: le misure libere restano per quando la si stacca
      save({ open: true, frame: zoneFrame(s.zone), free: win.snap ? win.free : clampFrame(live ?? win.frame), snap: s.zone });
    } else if (live && park) {
      // spinta oltre il bordo: si ripone, e tornera' dove stava
      save({ open: false });
    } else if (live) {
      const f = clampFrame(live);
      save({ open: true, frame: f, free: f, snap: null });
    }
    setLive(null);
  };

  const preview = snap.armed && snap.zone && !(live && shouldPark(live)) ? zoneFrame(snap.zone) : null;
  const pct = (f: Frame) => ({ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` });
  const startMove = (e: React.PointerEvent, fromRail: boolean) => begin(e, { kind: 'move', start: { x: e.clientX, y: e.clientY }, frame, detached: false, fromRail });
  const Away = side === 'left' ? ChevronsLeft : ChevronsRight;

  return (
    <div className={`fx-desk ${front ? 'is-front' : ''}`} ref={area}>
      {preview && <div className="fx-snap-preview" style={pct(preview)} aria-hidden />}
      <section
        className={`fx-float fx-float--${side} ${live ? 'is-dragging' : ''} ${parked ? 'is-parked' : ''} ${win.snap && win.open && !live ? 'is-snapped' : ''}`}
        style={pct(frame)}
        aria-label={title}
        onPointerDownCapture={toFront}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <header
          className="fx-float__bar"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            startMove(e, false);
          }}
          onDoubleClick={() => (win.snap ? save({ frame: win.free, snap: null }) : save({ frame: zoneFrame('top'), free: win.frame, snap: 'top' }))}
        >
          <Icon size={13} />
          <span className="fx-float__title">{title}</span>
          <button className="fx-icon" title={commandTitle(cmd)} aria-label={t('panel.putAway', { name: title })} onClick={() => togglePanelWin(id, false)}>
            <Away size={15} />
          </button>
        </header>
        <div className="fx-float__body" inert={parked || undefined}>
          {children}
        </div>
        {/* la striscia che resta fuori dal bordo: si afferra per tirare dentro la finestra */}
        <div
          className="fx-float__rail"
          role="button"
          tabIndex={parked ? 0 : -1}
          data-cmd={cmd}
          title={commandTitle(cmd)}
          aria-label={t(`cmd.${cmd}`)}
          onPointerDown={(e) => startMove(e, true)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && togglePanelWin(id, true)}
        >
          <Icon size={13} />
          <span>{title}</span>
        </div>
        {!parked &&
          (['e', 's', 'se', 'w', 'sw'] as const).map((edge) => (
            <div key={edge} className={`fx-float__edge fx-float__edge--${edge}`} onPointerDown={(e) => begin(e, { kind: 'resize', edge, start: { x: e.clientX, y: e.clientY }, frame: win.frame })} />
          ))}
      </section>
    </div>
  );
}
