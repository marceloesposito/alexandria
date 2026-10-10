// Divisore verticale trascinabile fra due colonne; a richiesta con il pulsante che richiude la colonna.
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Splitter({ onDrag, collapse }: { onDrag: (dx: number) => void; collapse?: { side: 'left' | 'right'; title: string; onClick: () => void } }) {
  return (
    <div
      className="splitter"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.splitter__collapse')) return;
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        let last = e.clientX;
        const move = (ev: PointerEvent) => {
          const dx = ev.clientX - last;
          last = ev.clientX;
          if (dx) onDrag(dx);
        };
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
      }}
    >
      {collapse && (
        <button className={`splitter__collapse is-${collapse.side}`} title={collapse.title} aria-label={collapse.title} onClick={collapse.onClick}>
          {collapse.side === 'left' ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      )}
    </div>
  );
}
