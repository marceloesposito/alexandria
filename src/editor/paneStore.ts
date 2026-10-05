// Riquadri accanto all'editor: schede con altre pergamene (in lettura), un Codex o risorse in anteprima.
// Stato della sessione; la larghezza è nelle preferenze.
import { create } from 'zustand';

export type PaneTab = { kind: 'doc'; rel: string } | { kind: 'codex'; root: string } | { kind: 'resource'; id: string };

const same = (a: PaneTab, b: PaneTab) =>
  a.kind === b.kind && (a.kind === 'doc' ? a.rel === (b as typeof a).rel : a.kind === 'codex' ? a.root === (b as typeof a).root : a.id === (b as { id: string }).id);

interface S {
  tabs: PaneTab[];
  active: number;
  /** seconda scheda mostrata sotto la prima (riquadro diviso), o null */
  second: number | null;
  open(tab: PaneTab): void;
  close(i: number): void;
  setActive(i: number): void;
  toggleSplit(): void;
  closeAll(): void;
}

export const useSidePane = create<S>((set, get) => ({
  tabs: [],
  active: 0,
  second: null,
  open(tab) {
    const { tabs } = get();
    const i = tabs.findIndex((x) => same(x, tab));
    if (i >= 0) return set({ active: i });
    set({ tabs: [...tabs, tab], active: tabs.length });
  },
  close(i) {
    const tabs = get().tabs.filter((_, k) => k !== i);
    const fix = (x: number | null) => (x === null ? null : x === i ? null : x > i ? x - 1 : x);
    const active = Math.max(0, Math.min(tabs.length - 1, fix(get().active) ?? get().active - 1));
    const second = fix(get().second);
    set({ tabs, active, second: second === active ? null : second });
  },
  setActive(i) {
    set({ active: i, second: get().second === i ? null : get().second });
  },
  toggleSplit() {
    const { tabs, active, second } = get();
    if (second !== null) return set({ second: null });
    const other = tabs.findIndex((_, k) => k !== active);
    if (other >= 0) set({ second: other });
  },
  closeAll() {
    set({ tabs: [], active: 0, second: null });
  },
}));
