// Scrittura minimale: solo il testo, senza menu, barre e colonne, a schermo intero.
// Non si salva nello stato dell'app: si riparte sempre dall'interfaccia completa.
import { create } from 'zustand';
import { platform } from '../platform';
import { ws } from './workspace';

interface Zen {
  on: boolean;
  enter(): Promise<void>;
  exit(): Promise<void>;
  toggle(): Promise<void>;
}

async function setFullscreen(full: boolean) {
  try {
    if (platform.kind === 'tauri') {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setFullscreen(full);
    } else if (full && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    else if (!full && document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* il browser puo' rifiutare lo schermo intero senza un gesto dell'utente */
  }
}

export const useZen = create<Zen>((set, get) => ({
  on: false,
  async enter() {
    if (get().on) return;
    ws().setView('editor');
    set({ on: true });
    await setFullscreen(true);
  },
  async exit() {
    if (!get().on) return;
    set({ on: false });
    await setFullscreen(false);
  },
  toggle() {
    return get().on ? get().exit() : get().enter();
  },
}));
