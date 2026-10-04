// Stato transitorio dell'interfaccia dei commenti (riga sotto il puntatore, collegamento in corso).
import { create } from 'zustand';
import type { VisualLine } from '../editor/lines';

export interface Linking {
  id: string;
  x0: number;
  y0: number;
  x: number;
  y: number;
}

interface UiState {
  hoverLine: VisualLine | null;
  linking: Linking | null;
  /** aumenta per forzare il ridisegno dei connettori (scroll, trascinamenti) */
  tick: number;
  setHoverLine(l: VisualLine | null): void;
  setLinking(l: Linking | null): void;
  bump(): void;
}

export const useCommentUi = create<UiState>((set, get) => ({
  hoverLine: null,
  linking: null,
  tick: 0,
  setHoverLine(l) {
    const cur = get().hoverLine;
    if (cur?.n === l?.n && cur?.top === l?.top) return;
    set({ hoverLine: l });
  },
  setLinking(l) {
    set({ linking: l });
  },
  bump() {
    set({ tick: get().tick + 1 });
  },
}));
