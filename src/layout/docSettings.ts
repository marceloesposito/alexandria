// Impostazioni del documento aperto, caricate e salvate accanto al .md.
import { create } from 'zustand';
import { type DocSettings, defaultDocSettings, normalizeDocSettings } from './model';
import { readJson, writeJson } from '../vault/vault';
import { abs, docSettingsFile } from '../vault/paths';
import { useWorkspace } from '../state/workspace';
import { getLang } from '../i18n';

export { pageMetrics } from './model';

interface S {
  rel: string | null;
  settings: DocSettings;
  load(root: string, rel: string): Promise<void>;
  update(patch: Partial<DocSettings>): void;
  updateLayout(patch: Partial<DocSettings['layout']>): void;
  replace(s: DocSettings): void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

function save(rel: string, s: DocSettings) {
  const root = useWorkspace.getState().vaultRoot;
  if (!root) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void writeJson(abs(root, docSettingsFile(rel)), s), 400);
}

export const useDocSettings = create<S>((set, get) => ({
  rel: null,
  settings: defaultDocSettings(getLang()),
  async load(root, rel) {
    const raw = await readJson<unknown>(abs(root, docSettingsFile(rel)), null);
    set({ rel, settings: normalizeDocSettings(raw, getLang()) });
  },
  update(patch) {
    const s = { ...get().settings, ...patch };
    set({ settings: s });
    if (get().rel) save(get().rel!, s);
  },
  updateLayout(patch) {
    get().update({ layout: { ...get().settings.layout, ...patch } });
  },
  replace(s) {
    set({ settings: s });
    if (get().rel) save(get().rel!, s);
  },
}));

// segue il documento attivo
useWorkspace.subscribe((st, prev) => {
  if ((st.activeDoc !== prev.activeDoc || st.reloadToken !== prev.reloadToken) && st.vaultRoot && st.activeDoc) {
    void useDocSettings.getState().load(st.vaultRoot, st.activeDoc);
  }
});
