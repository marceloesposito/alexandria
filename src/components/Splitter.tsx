// Divisore verticale trascinabile fra due colonne.
export function Splitter({ onDrag }: { onDrag: (dx: number) => void }) {
  return (
    <div
      className="splitter"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={(e) => {
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
    />
  );
}
