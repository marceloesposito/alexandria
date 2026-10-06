// Impostazioni del documento aperto, caricate e salvate accanto al .md.
import { create } from 'zustand';
import { type DocSettings, defaultDocSettings, normalizeDocSettings, retargetLanguage } from './model';
import { readJson, writeJson } from '../vault/vault';
import { abs, docSettingsFile } from '../vault/paths';
import { useWorkspace } from '../state/workspace';
import { getWritingLang, type WritingLang } from '../i18n/writing';

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
  settings: defaultDocSettings(getWritingLang()),
  async load(root, rel) {
    const raw = await readJson<unknown>(abs(root, docSettingsFile(rel)), null);
    set({ rel, settings: normalizeDocSettings(raw, getWritingLang()) });
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

/** Dopo il cambio di lingua del Compendium: le pergamene con i predefiniti della vecchia lingua passano alla nuova. */
export async function retargetDocsLanguage(from: WritingLang, to: WritingLang): Promise<void> {
  const { vaultRoot, docs } = useWorkspace.getState();
  if (!vaultRoot || from === to) return;
  const open = useDocSettings.getState();
  for (const d of docs) {
    if (d.rel === open.rel) continue;
    const path = abs(vaultRoot, docSettingsFile(d.rel));
    const raw = await readJson<unknown>(path, null);
    if (!raw) continue; // senza file: prende gia' i predefiniti della lingua nuova
    const cur = normalizeDocSettings(raw, from);
    const next = retargetLanguage(cur, from, to);
    if (next.citationLocale !== cur.citationLocale || next.bibliographyTitle !== cur.bibliographyTitle) await writeJson(path, next);
  }
  if (open.rel) open.replace(retargetLanguage(open.settings, from, to));
}
