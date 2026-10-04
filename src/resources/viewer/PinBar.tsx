// Pulsante "Pin" che compare accanto alla selezione di testo nel visualizzatore.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pin } from 'lucide-react';
import { t } from '../../i18n';

export interface SelectionInfo {
  text: string;
  rect: DOMRect;
  anchor: Node | null;
}

/** Segue la selezione dentro `root` e restituisce testo e posizione. */
export function useSelectionIn(root: HTMLElement | null): SelectionInfo | null {
  const [sel, setSel] = useState<SelectionInfo | null>(null);
  useEffect(() => {
    const h = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed || !root || !s.anchorNode || !root.contains(s.anchorNode)) {
        setSel(null);
        return;
      }
      const text = s.toString().replace(/\s+/g, ' ').trim();
      if (text.length < 2) {
        setSel(null);
        return;
      }
      setSel({ text, rect: s.getRangeAt(0).getBoundingClientRect(), anchor: s.anchorNode });
    };
    document.addEventListener('selectionchange', h);
    return () => document.removeEventListener('selectionchange', h);
  }, [root]);
  return sel;
}

export function PinButton({ sel, onPin }: { sel: SelectionInfo | null; onPin: (s: SelectionInfo) => void }) {
  if (!sel) return null;
  return createPortal(
    <button
      className="pin-float"
      style={{ left: Math.min(window.innerWidth - 120, sel.rect.right - 20), top: Math.max(8, sel.rect.top - 38) }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPin(sel)}
    >
      <Pin size={14} /> {t('viewer.pin')}
    </button>,
    document.body,
  );
}

export function shortLabel(text: string, n = 60): string {
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}
