// Tipi di riquadro creati nel Compendium aperto: .alexandria/callouts.json (senza file, nessuno).
import { create } from 'zustand';
import { type CalloutType, normalizeCalloutTypes } from 'logos/doc/callouts';
import { readJson, writeJson } from '../vault/vault';
import { joinPath } from '../platform';
import { CALLOUTS_FILE } from '../vault/paths';
import { useWorkspace } from '../state/workspace';

interface S {
  types: CalloutType[];
  load(root: string): Promise<void>;
  save(types: CalloutType[]): Promise<void>;
}

export const useCalloutTypes = create<S>((set) => ({
  types: [],
  async load(root) {
    set({ types: normalizeCalloutTypes(await readJson<unknown>(joinPath(root, CALLOUTS_FILE), null)) });
  },
  async save(types) {
    set({ types });
    const root = useWorkspace.getState().vaultRoot;
    if (root) await writeJson(joinPath(root, CALLOUTS_FILE), { version: 1, types });
  },
}));

useWorkspace.subscribe((s, p) => {
  if (s.vaultRoot && (s.vaultRoot !== p.vaultRoot || s.reloadToken !== p.reloadToken)) void useCalloutTypes.getState().load(s.vaultRoot);
});
