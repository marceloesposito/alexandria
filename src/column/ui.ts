// Stato dell'interfaccia: quale popover e' aperto (uno solo alla volta), finestre, ⌘K, la Tabula
// visibile e la versione selezionata nel Palimpsestus.
import { create } from 'zustand';

export type PopoverId = 'export' | 'style' | 'color' | 'insert' | 'timer' | 'counts' | 'tabulaAdd' | 'tabulaFind';
export type DialogId = 'prefs' | 'help' | 'about';

export interface TabulaApi {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  zoom(): number;
}

interface UiState {
  popover: PopoverId | null;
  dialog: DialogId | null;
  palette: boolean;
  tabula: TabulaApi | null;
  /** versione selezionata nell'albero */
  selectedVersion: string | null;
  /** finestra flottante davanti all'altra */
  front: 'tabula' | 'versions';
  toggle(p: PopoverId): void;
  close(): void;
  setDialog(d: DialogId | null): void;
  setPalette(on: boolean): void;
}

export const useUi = create<UiState>((set, get) => ({
  popover: null,
  dialog: null,
  palette: false,
  tabula: null,
  selectedVersion: null,
  front: 'tabula',
  toggle(p) {
    set({ popover: get().popover === p ? null : p });
  },
  close() {
    set({ popover: null });
  },
  setDialog(d) {
    set({ dialog: d, popover: null });
  },
  setPalette(on) {
    set({ palette: on, popover: null });
  },
}));
