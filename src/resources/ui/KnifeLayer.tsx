// Coltello della Tabula: tenendo premuto Ctrl il cursore diventa un coltello; trascinando si traccia
// una scia e al rilascio si tagliano i collegamenti che attraversa (un clic su un collegamento taglia
// quello). Uno strato sopra React Flow raccoglie il puntatore solo mentre Ctrl e' premuto, cosi'
// nodi e vista non reagiscono. La geometria sta in knife.ts.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { edgesToCut, type EdgeLine, type Pt } from './knife';

/** Tracciati dei collegamenti disegnati, campionati in coordinate dello schermo. */
function sampleEdges(root: HTMLElement): EdgeLine[] {
  const out: EdgeLine[] = [];
  for (const g of Array.from(root.querySelectorAll<SVGGElement>('.react-flow__edge'))) {
    const id = g.dataset.id;
    const path = g.querySelector<SVGPathElement>('path.react-flow__edge-path');
    const ctm = path?.getScreenCTM();
    if (!id || !path || !ctm) continue;
    const total = path.getTotalLength();
    const n = Math.max(8, Math.min(64, Math.round(total / 12)));
    const points: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const p = path.getPointAtLength((total * i) / n);
      const s = new DOMPoint(p.x, p.y).matrixTransform(ctm);
      points.push({ x: s.x, y: s.y });
    }
    out.push({ id, points });
  }
  return out;
}

const editing = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
};

export function KnifeLayer({ container, onCut, label }: { container: RefObject<HTMLElement | null>; onCut: (ids: string[]) => void; label: string }) {
  const [armed, setArmed] = useState(false);
  const [trail, setTrail] = useState<Pt[]>([]);
  const cutting = useRef<Pt[] | null>(null);

  // Ctrl premuto (ma non mentre si scrive in una nota)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Control' && !editing()) setArmed(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Control' && !cutting.current) setArmed(false);
    };
    const off = () => {
      if (!cutting.current) setArmed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', off);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', off);
    };
  }, []);

  useEffect(() => {
    container.current?.classList.toggle('is-knife', armed);
  }, [armed, container]);

  if (!armed) return null;
  const box = container.current?.getBoundingClientRect();
  const local = (p: Pt) => `${p.x - (box?.left ?? 0)},${p.y - (box?.top ?? 0)}`;
  return (
    <div
      className="knife-layer"
      aria-label={label}
      title={label}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        cutting.current = [{ x: e.clientX, y: e.clientY }];
        setTrail(cutting.current);
      }}
      onPointerMove={(e) => {
        const c = cutting.current;
        if (!c) {
          // Ctrl rilasciato fuori dalla finestra: il coltello si ritira
          if (!e.ctrlKey) setArmed(false);
          return;
        }
        const last = c[c.length - 1];
        if (Math.hypot(e.clientX - last.x, e.clientY - last.y) < 3) return;
        cutting.current = [...c, { x: e.clientX, y: e.clientY }];
        setTrail(cutting.current);
      }}
      onPointerUp={(e) => {
        const c = cutting.current;
        cutting.current = null;
        setTrail([]);
        if (!e.ctrlKey) setArmed(false);
        if (!c || !container.current) return;
        const ids = edgesToCut(c, sampleEdges(container.current));
        if (ids.length) onCut(ids);
      }}
    >
      {trail.length > 1 && (
        <svg className="knife-layer__trail" aria-hidden>
          <polyline points={trail.map(local).join(' ')} />
        </svg>
      )}
    </div>
  );
}
