// Tipi di oggetto del Compendium aperto: .alexandria/types.json (senza file, quelli di partenza).
import { create } from 'zustand';
import { type ObjectType, normalizeTypes } from './model';
import { readJson, writeJson } from '../vault/vault';
import { joinPath } from '../platform';
import { TYPES_FILE } from '../vault/paths';
import { useWorkspace } from '../state/workspace';
import { getLang } from '../i18n';

interface S {
  types: ObjectType[];
  load(root: string): Promise<void>;
  save(types: ObjectType[]): Promise<void>;
}

export const useTypes = create<S>((set) => ({
  types: normalizeTypes(null, getLang()),
  async load(root) {
    set({ types: normalizeTypes(await readJson<unknown>(joinPath(root, TYPES_FILE), null), getLang()) });
  },
  async save(types) {
    set({ types });
    const root = useWorkspace.getState().vaultRoot;
    if (root) await writeJson(joinPath(root, TYPES_FILE), { version: 1, types });
  },
}));

useWorkspace.subscribe((s, p) => {
  if (s.vaultRoot && (s.vaultRoot !== p.vaultRoot || s.reloadToken !== p.reloadToken)) void useTypes.getState().load(s.vaultRoot);
});
