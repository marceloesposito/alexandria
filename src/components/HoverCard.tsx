// Anteprima al passaggio del mouse: compare dopo un breve ritardo accanto all'elemento e resta
// aperta finché il puntatore è sull'elemento o sulla scheda stessa.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const OPEN_DELAY = 350;
const CLOSE_DELAY = 180;

/** Collega un elemento qualsiasi a una scheda di anteprima. */
export function useHoverCard() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const openTimer = useRef<number>(0);
  const closeTimer = useRef<number>(0);
  const clear = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };
  useEffect(() => clear, []);
  const onMouseEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    clear();
    openTimer.current = window.setTimeout(() => setAnchor(el), OPEN_DELAY);
  }, []);
  const onMouseLeave = useCallback(() => {
    clear();
    closeTimer.current = window.setTimeout(() => setAnchor(null), CLOSE_DELAY);
  }, []);
  const keep = useCallback(() => clear(), []);
  const close = useCallback(() => {
    clear();
    setAnchor(null);
  }, []);
  return { anchor, triggerProps: { onMouseEnter, onMouseLeave }, cardProps: { onMouseEnter: keep, onMouseLeave }, close };
}

export function HoverCard({
  anchor,
  cardProps,
  children,
  placement = 'below',
}: {
  anchor: HTMLElement | null;
  placement?: 'below' | 'right';
  cardProps: { onMouseEnter: () => void; onMouseLeave: () => void };
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!anchor) return setPos(null);
    const r = anchor.getBoundingClientRect();
    const w = ref.current?.offsetWidth ?? 360;
    const h = ref.current?.offsetHeight ?? 240;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, placement === 'right' ? r.right + 8 : r.left));
    let top = placement === 'right' ? r.top : r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, placement === 'right' ? window.innerHeight - h - 8 : r.top - h - 6);
    setPos({ left, top });
  }, [anchor, placement]);
  useEffect(() => {
    if (!anchor) return;
    const close = () => cardProps.onMouseLeave();
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [anchor, cardProps]);
  if (!anchor) return null;
  return createPortal(
    <div ref={ref} className="hovercard" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }} {...cardProps}>
      {children}
    </div>,
    document.body,
  );
}
