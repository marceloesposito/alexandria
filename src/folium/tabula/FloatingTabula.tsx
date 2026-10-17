// Tabula flottante: una linguetta sul bordo sinistro che si tira fuori trascinandola (o con un clic) e
// diventa una finestra sopra il testo. La finestra si sposta dalla sua barra e si ridimensiona dagli
// orli; vicino ai bordi, se ci si ferma un attimo, propone l'aggancio a meta' o a un quadrante
// (snap.ts), come le finestre di Windows. Staccandola torna alle misure di prima.
import { useEffect, useRef, useState } from 'react';
import { Shapes, X } from 'lucide-react';
import { useFolium } from '../store';
import { TabulaView } from './TabulaView';
import { toggleTabula } from '../commands';
import { commandTitle } from '../FloatingBar';
import { NO_SNAP, clampFrame, trackSnap, unsnap, zoneFrame, type Frame, type SnapState } from './snap';
import { t, useLang } from '../../i18n';

type Drag =
  | {
      kind: 'move';
      start: { x: number; y: number };
      frame: Frame;
      detached: boolean;
    }
  | {
      kind: 'resize';
      edge: 'e' | 's' | 'se' | 'w' | 'sw';
      start: { x: number; y: number };
      frame: Frame;
    };

/** Px -> frazioni dello spazio di lavoro. */
function rel(area: DOMRect, x: number, y: number) {
  return { x: (x - area.left) / area.width, y: (y - area.top) / area.height };
}

export function FloatingTabula() {
  useLang();
  const win = useFolium((s) => s.app.tabula);
  const area = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<Frame | null>(null);
  const [snap, setSnap] = useState<SnapState>(NO_SNAP);
  const drag = useRef<Drag | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const snapRef = useRef<SnapState>(NO_SNAP);
  const frame = live ?? win.frame;

  const save = (p: Partial<typeof win>) => useFolium.getState().setApp({ tabula: { ...useFolium.getState().app.tabula, ...p } });

  // il puntatore fermo vicino al bordo arma l'aggancio anche senza muoversi
  useEffect(() => {
    const id = setInterval(() => {
      const d = drag.current;
      const p = pointer.current;
      const a = area.current?.getBoundingClientRect();
      if (!d || d.kind !== 'move' || !p || !a) return;
      const next = trackSnap(snapRef.current, p.x - a.left, p.y - a.top, a.width, a.height, Date.now());
      if (next.armed !== snapRef.current.armed || next.zone !== snapRef.current.zone) setSnap(next);
      snapRef.current = next;
    }, 50);
    return () => clearInterval(id);
  }, []);

  const begin = (e: React.PointerEvent, d: Drag) => {
    if (e.button !== 0) return;
    e.preventDefault();
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
      let base = d.frame;
      // una finestra agganciata si stacca al primo vero spostamento e torna alle sue misure
      if (!d.detached && Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) > 4) {
        d.detached = true;
        if (win.snap) {
          base = unsnap(win.free, d.frame, s.x, s.y);
          d.frame = base;
        }
      }
      if (!d.detached) return;
      setLive(clampFrame({ ...base, x: base.x + dx, y: base.y + dy }));
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
    if (!d) return;
    const s = snapRef.current;
    snapRef.current = NO_SNAP;
    setSnap(NO_SNAP);
    if (d.kind === 'move' && s.armed && s.zone) {
      // aggancio: le misure libere restano per quando la si stacca
      save({
        frame: zoneFrame(s.zone),
        free: win.snap ? win.free : (live ?? win.frame),
        snap: s.zone,
      });
    } else if (live) save({ frame: live, free: live, snap: null });
    setLive(null);
  };

  // la linguetta: un clic apre, trascinarla verso destra tira fuori la Tabula sotto il puntatore
  const tabDrag = useRef<{ x: number; y: number; pulled: boolean } | null>(null);
  // mentre la si tira fuori la linguetta resta montata: tiene il puntatore fino al rilascio
  const [pulling, setPulling] = useState(false);
  const tabDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    tabDrag.current = { x: e.clientX, y: e.clientY, pulled: false };
  };
  const tabMove = (e: React.PointerEvent) => {
    const td = tabDrag.current;
    const a = area.current?.getBoundingClientRect();
    if (!td || !a) return;
    if (!td.pulled && e.clientX - td.x > 12) {
      td.pulled = true;
      setPulling(true);
      // la finestra esce dal bordo con la barra sotto il puntatore
      const p = rel(a, e.clientX, e.clientY);
      const f = clampFrame({ ...win.free, x: p.x - 0.02, y: p.y - 0.02 });
      save({ open: true, frame: f, snap: null });
      setLive(f);
      drag.current = {
        kind: 'move',
        start: { x: e.clientX, y: e.clientY },
        frame: f,
        detached: true,
      };
      pointer.current = { x: e.clientX, y: e.clientY };
    }
    if (td.pulled) move(e);
  };
  const tabUp = () => {
    const td = tabDrag.current;
    tabDrag.current = null;
    setPulling(false);
    if (!td) return;
    if (td.pulled) end();
    else toggleTabula(true);
  };

  const preview = snap.armed && snap.zone ? zoneFrame(snap.zone) : null;
  const pct = (f: Frame) => ({
    left: `${f.x * 100}%`,
    top: `${f.y * 100}%`,
    width: `${f.w * 100}%`,
    height: `${f.h * 100}%`,
  });

  return (
    <div className="fx-desk" ref={area}>
      {(!win.open || pulling) && (
        <button
          className={`fx-edge-tab ${pulling ? 'is-pulling' : ''}`}
          data-cmd="tabula.toggle"
          title={commandTitle('tabula.toggle')}
          aria-label={t('cmd.tabula.toggle')}
          onPointerDown={tabDown}
          onPointerMove={tabMove}
          onPointerUp={tabUp}
        >
          <Shapes size={14} />
          <span>Tabula</span>
        </button>
      )}
      {preview && <div className="fx-snap-preview" style={pct(preview)} aria-hidden />}
      {win.open && (
        <section
          className={`fx-float ${live ? 'is-dragging' : ''} ${win.snap && !live ? 'is-snapped' : ''}`}
          style={pct(frame)}
          aria-label="Tabula"
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <header
            className="fx-float__bar"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('button')) return;
              begin(e, {
                kind: 'move',
                start: { x: e.clientX, y: e.clientY },
                frame: win.frame,
                detached: false,
              });
            }}
            onDoubleClick={() =>
              win.snap
                ? save({ frame: win.free, snap: null })
                : save({
                    frame: zoneFrame('top'),
                    free: win.frame,
                    snap: 'top',
                  })
            }
          >
            <Shapes size={13} />
            <span className="fx-float__title">Tabula</span>
            <button className="fx-icon" title={commandTitle('tabula.toggle')} aria-label={t('tabula.close')} onClick={() => toggleTabula(false)}>
              <X size={14} />
            </button>
          </header>
          <div className="fx-float__body">
            <TabulaView />
          </div>
          {(['e', 's', 'se', 'w', 'sw'] as const).map((edge) => (
            <div
              key={edge}
              className={`fx-float__edge fx-float__edge--${edge}`}
              onPointerDown={(e) =>
                begin(e, {
                  kind: 'resize',
                  edge,
                  start: { x: e.clientX, y: e.clientY },
                  frame: win.frame,
                })
              }
            />
          ))}
        </section>
      )}
    </div>
  );
}
