// Stato del gestore risorse: risorse del vault e della Library, layer, collegamenti, whiteboard.
import { create } from 'zustand';
import { useWorkspace } from '../state/workspace';
import { makeCiteKey } from '../doc/citeSyntax';
import {
  type Resource,
  type Layer,
  type Pin,
  type CslItem,
  firstAuthorFamily,
  yearOf,
  newLayerId,
  newPinId,
  LAYER_COLORS,
} from './model';
import {
  type Scope,
  type Link,
  type Whiteboard,
  listResources,
  saveResource,
  removeResource,
  loadLayers,
  saveLayers,
  loadLinks,
  saveLinks,
  loadWhiteboard,
  saveWhiteboard,
  readText,
  defaultLibraryRoot,
  itemDir,
} from './storage';
import { platform, joinPath } from '../platform';

export type ResView = 'whiteboard' | 'graph' | 'layers';

interface ResState {
  vault: Scope | null;
  library: Scope | null;
  resources: Resource[];
  libraryItems: Resource[];
  layers: Layer[];
  dismissed: string[];
  links: Link[];
  whiteboard: Whiteboard;
  texts: Map<string, string>;
  view: ResView;
  scope: 'vault' | 'library';
  activeLayer: string | null;
  selected: string[];
  inspector: string | null;
  viewer: { id: string; pin?: string } | null;
  busy: { label: string; done: number; total: number } | null;

  load(root: string): Promise<void>;
  loadLibrary(): Promise<void>;
  setView(v: ResView): void;
  setScope(s: 'vault' | 'library'): void;
  select(ids: string[]): void;
  openInspector(id: string | null): void;
  openViewer(id: string | null, pin?: string): void;
  setBusy(b: ResState['busy']): void;

  upsert(r: Resource, scope?: 'vault' | 'library'): Promise<void>;
  update(id: string, patch: Partial<Resource>): Promise<void>;
  remove(ids: string[]): Promise<void>;
  setSource(id: string, on: boolean): Promise<void>;
  setTags(id: string, tags: string[]): Promise<void>;
  setCsl(id: string, csl: CslItem): Promise<void>;
  addPin(id: string, pin: Omit<Pin, 'id' | 'created'>): Promise<Pin | null>;
  removePin(id: string, pinId: string): Promise<void>;
  updatePin(id: string, pinId: string, patch: Partial<Pin>): Promise<void>;

  addLayer(p: Partial<Layer> & { name: string }): Layer;
  updateLayer(id: string, patch: Partial<Layer>): void;
  removeLayer(id: string): void;
  setActiveLayer(id: string | null): void;
  assignLayer(resIds: string[], layerId: string, on: boolean): Promise<void>;
  dismissSuggestion(key: string): void;

  addLink(from: string, to: string, label?: string): void;
  removeLink(id: string): void;
  updateLink(id: string, label: string): void;
  setWhiteboard(w: Whiteboard): void;

  textOf(id: string): Promise<string>;
  get(id: string): Resource | undefined;
  sources(): Resource[];
}

let wbTimer: ReturnType<typeof setTimeout> | null = null;
let layerTimer: ReturnType<typeof setTimeout> | null = null;

function scopeOf(st: ResState, id: string): Scope | null {
  if (st.resources.some((r) => r.id === id)) return st.vault;
  if (st.libraryItems.some((r) => r.id === id)) return st.library;
  return st.vault;
}

export const useResources = create<ResState>((set, get) => {
  const persistLayers = () => {
    const root = get().vault?.root;
    if (!root) return;
    if (layerTimer) clearTimeout(layerTimer);
    layerTimer = setTimeout(() => void saveLayers(root, { version: 1, layers: get().layers, dismissed: get().dismissed }), 300);
  };
  const replace = (r: Resource) => {
    const inVault = get().resources.some((x) => x.id === r.id);
    if (inVault) set({ resources: get().resources.map((x) => (x.id === r.id ? r : x)) });
    else set({ libraryItems: get().libraryItems.map((x) => (x.id === r.id ? r : x)) });
  };
  return {
    vault: null,
    library: null,
    resources: [],
    libraryItems: [],
    layers: [],
    dismissed: [],
    links: [],
    whiteboard: { version: 1, nodes: {}, notes: [], frames: [] },
    texts: new Map(),
    view: 'whiteboard',
    scope: 'vault',
    activeLayer: null,
    selected: [],
    inspector: null,
    viewer: null,
    busy: null,

    async load(root) {
      const vault: Scope = { kind: 'vault', root };
      const [resources, layersFile, links, whiteboard] = await Promise.all([
        listResources(vault),
        loadLayers(root),
        loadLinks(root),
        loadWhiteboard(root),
      ]);
      set({
        vault,
        resources,
        layers: layersFile.layers,
        dismissed: layersFile.dismissed,
        links,
        whiteboard,
        texts: new Map(),
        activeLayer: null,
        selected: [],
        inspector: null,
        viewer: null,
      });
      await get().loadLibrary();
    },

    async loadLibrary() {
      const root = useWorkspace.getState().app.prefs.libraryPath ?? (await defaultLibraryRoot());
      const library: Scope = { kind: 'library', root };
      try {
        await platform.mkdir(joinPath(root, 'items'));
        set({ library, libraryItems: await listResources(library) });
      } catch {
        set({ library, libraryItems: [] });
      }
    },

    setView(v) {
      set({ view: v });
    },
    setScope(s) {
      set({ scope: s, selected: [], activeLayer: null });
    },
    select(ids) {
      set({ selected: ids });
    },
    openInspector(id) {
      set({ inspector: id });
    },
    openViewer(id, pin) {
      set({ viewer: id ? { id, pin } : null });
    },
    setBusy(b) {
      set({ busy: b });
    },

    async upsert(r, scope = 'vault') {
      const s = scope === 'vault' ? get().vault : get().library;
      if (!s) return;
      await saveResource(s, r);
      if (scope === 'vault') {
        const exists = get().resources.some((x) => x.id === r.id);
        set({ resources: exists ? get().resources.map((x) => (x.id === r.id ? r : x)) : [...get().resources, r] });
      } else {
        const exists = get().libraryItems.some((x) => x.id === r.id);
        set({ libraryItems: exists ? get().libraryItems.map((x) => (x.id === r.id ? r : x)) : [...get().libraryItems, r] });
      }
    },

    async update(id, patch) {
      const cur = get().get(id);
      const s = scopeOf(get(), id);
      if (!cur || !s) return;
      const next = { ...cur, ...patch };
      replace(next);
      await saveResource(s, next);
    },

    async remove(ids) {
      for (const id of ids) {
        const s = scopeOf(get(), id);
        if (s) await removeResource(s, id);
      }
      const gone = new Set(ids);
      const nodes = { ...get().whiteboard.nodes };
      ids.forEach((id) => delete nodes[id]);
      set({
        resources: get().resources.filter((r) => !gone.has(r.id)),
        libraryItems: get().libraryItems.filter((r) => !gone.has(r.id)),
        links: get().links.filter((l) => !gone.has(l.from) && !gone.has(l.to)),
        selected: get().selected.filter((x) => !gone.has(x)),
        inspector: gone.has(get().inspector ?? '') ? null : get().inspector,
      });
      get().setWhiteboard({ ...get().whiteboard, nodes });
      if (get().vault) await saveLinks(get().vault!.root, get().links);
    },

    async setSource(id, on) {
      const r = get().get(id);
      if (!r) return;
      let citeKey = r.citeKey;
      if (on && !citeKey) {
        const taken = new Set([...get().resources, ...get().libraryItems].map((x) => x.citeKey).filter(Boolean) as string[]);
        const name = firstAuthorFamily(r) || r.title.split(/\s+/).find((w) => w.length > 3) || 'fonte';
        citeKey = makeCiteKey(name, yearOf(r) ?? undefined, taken);
      }
      await get().update(id, { isSource: on, citeKey });
    },

    async setTags(id, tags) {
      const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
      await get().update(id, { tags: clean });
    },

    async setCsl(id, csl) {
      const r = get().get(id);
      if (!r) return;
      await get().update(id, { csl, title: csl.title || r.title });
    },

    async addPin(id, pin) {
      const r = get().get(id);
      if (!r) return null;
      const p: Pin = { ...pin, id: newPinId(), created: new Date().toISOString() };
      await get().update(id, { pins: [...r.pins, p] });
      // un pin si cita: la risorsa diventa una fonte
      if (!r.isSource) await get().setSource(id, true);
      return p;
    },

    async removePin(id, pinId) {
      const r = get().get(id);
      if (r) await get().update(id, { pins: r.pins.filter((p) => p.id !== pinId) });
    },

    async updatePin(id, pinId, patch) {
      const r = get().get(id);
      if (r) await get().update(id, { pins: r.pins.map((p) => (p.id === pinId ? { ...p, ...patch } : p)) });
    },

    addLayer(p) {
      const layer: Layer = {
        id: newLayerId(),
        parent: null,
        color: LAYER_COLORS[get().layers.length % LAYER_COLORS.length],
        visible: true,
        locked: false,
        kind: 'group',
        ...p,
      };
      set({ layers: [...get().layers, layer] });
      persistLayers();
      return layer;
    },

    updateLayer(id, patch) {
      set({ layers: get().layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
      persistLayers();
    },

    removeLayer(id) {
      const l = get().layers.find((x) => x.id === id);
      // i figli salgono di un livello
      set({
        layers: get()
          .layers.filter((x) => x.id !== id)
          .map((x) => (x.parent === id ? { ...x, parent: l?.parent ?? null } : x)),
        activeLayer: get().activeLayer === id ? null : get().activeLayer,
      });
      persistLayers();
      for (const r of get().resources.filter((r) => r.layers.includes(id))) void get().update(r.id, { layers: r.layers.filter((x) => x !== id) });
    },

    setActiveLayer(id) {
      set({ activeLayer: get().activeLayer === id ? null : id });
    },

    async assignLayer(resIds, layerId, on) {
      for (const id of resIds) {
        const r = get().get(id);
        if (!r) continue;
        const layers = on ? [...new Set([...r.layers, layerId])] : r.layers.filter((x) => x !== layerId);
        await get().update(id, { layers });
      }
    },

    dismissSuggestion(key) {
      set({ dismissed: [...get().dismissed, key] });
      persistLayers();
    },

    addLink(from, to, label) {
      if (from === to || get().links.some((l) => (l.from === from && l.to === to) || (l.from === to && l.to === from))) return;
      const links = [...get().links, { id: `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, from, to, label }];
      set({ links });
      if (get().vault) void saveLinks(get().vault!.root, links);
    },
    removeLink(id) {
      const links = get().links.filter((l) => l.id !== id);
      set({ links });
      if (get().vault) void saveLinks(get().vault!.root, links);
    },
    updateLink(id, label) {
      const links = get().links.map((l) => (l.id === id ? { ...l, label } : l));
      set({ links });
      if (get().vault) void saveLinks(get().vault!.root, links);
    },

    setWhiteboard(w) {
      set({ whiteboard: w });
      const root = get().vault?.root;
      if (!root) return;
      if (wbTimer) clearTimeout(wbTimer);
      wbTimer = setTimeout(() => void saveWhiteboard(root, get().whiteboard), 400);
    },

    async textOf(id) {
      const cached = get().texts.get(id);
      if (cached !== undefined) return cached;
      const s = scopeOf(get(), id);
      const t = s ? ((await readText(s, id)) ?? '') : '';
      const texts = new Map(get().texts);
      texts.set(id, t);
      set({ texts });
      return t;
    },

    get(id) {
      return get().resources.find((r) => r.id === id) ?? get().libraryItems.find((r) => r.id === id);
    },

    sources() {
      return get().resources.filter((r) => r.isSource && r.citeKey);
    },
  };
});

/** Cartella di una risorsa (per i file accanto: miniatura, pagina archiviata). */
export function dirOf(r: Resource): string | null {
  const st = useResources.getState();
  if (r.library && st.library) return itemDir(st.library, r.library);
  const s = st.resources.some((x) => x.id === r.id) ? st.vault : st.library;
  return s ? itemDir(s, r.id) : null;
}

export function fileOf(r: Resource, name = r.file): string | null {
  const d = dirOf(r);
  return d && name ? joinPath(d, name) : null;
}

// segue il vault aperto
useWorkspace.subscribe((s, p) => {
  if (s.vaultRoot && s.vaultRoot !== p.vaultRoot) void useResources.getState().load(s.vaultRoot);
  if (s.app.prefs.libraryPath !== p.app.prefs.libraryPath) void useResources.getState().loadLibrary();
  if (s.reloadToken !== p.reloadToken && s.vaultRoot) void useResources.getState().load(s.vaultRoot);
});
