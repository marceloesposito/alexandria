// Menu contestuale generico (tasto destro).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { Check } from 'lucide-react';

export interface CtxItem {
  label: string;
  onClick?: () => void;
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
  sep?: boolean;
  hint?: string;
}

const useCtx = create<{ x: number; y: number; items: CtxItem[] | null }>(() => ({ x: 0, y: 0, items: null }));

export function openContextMenu(e: { clientX: number; clientY: number; preventDefault?: () => void }, items: CtxItem[]) {
  e.preventDefault?.();
  useCtx.setState({ x: e.clientX, y: e.clientY, items });
}

export function closeContextMenu() {
  useCtx.setState({ items: null });
}

export function ContextMenuHost() {
  const { x, y, items } = useCtx();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos({
      x: Math.min(x, window.innerWidth - el.offsetWidth - 6),
      y: Math.min(y, window.innerHeight - el.offsetHeight - 6),
    });
  }, [x, y, items]);
  useEffect(() => {
    if (!items) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.type === 'mousedown' && ref.current?.contains(e.target as Node)) return;
      closeContextMenu();
    };
    window.addEventListener('mousedown', close, true);
    window.addEventListener('keydown', close, true);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('mousedown', close, true);
      window.removeEventListener('keydown', close, true);
      window.removeEventListener('blur', close);
    };
  }, [items]);
  if (!items) return null;
  return createPortal(
    <div ref={ref} className="menu-dropdown context-menu" style={{ left: pos.x, top: pos.y }} role="menu">
      {items.map((it, i) =>
        it.sep ? (
          <div key={i} className="menu-sep" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={`menu-item ${it.danger ? 'is-danger' : ''}`}
            disabled={it.disabled}
            onClick={() => {
              closeContextMenu();
              it.onClick?.();
            }}
          >
            <span className="menu-item__check">{it.checked ? <Check size={14} /> : null}</span>
            <span className="menu-item__label">{it.label}</span>
            {it.hint && <span className="menu-item__hint">{it.hint}</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
