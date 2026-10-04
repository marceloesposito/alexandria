// Piccolo pannello ancorato a un elemento; si chiude con Esc o cliccando fuori.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  placement?: 'below' | 'above' | 'right';
  className?: string;
}

export function Popover({ anchor, open, onClose, children, placement = 'below', className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const el = ref.current;
    const w = el?.offsetWidth ?? 280;
    const h = el?.offsetHeight ?? 120;
    let left = placement === 'right' ? r.right + 8 : r.left;
    let top = placement === 'above' ? r.top - h - 6 : placement === 'right' ? r.top : r.bottom + 6;
    left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    setPos({ left, top });
  }, [open, anchor, placement]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onDown, true);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      className={`popover ${className ?? ''}`}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
