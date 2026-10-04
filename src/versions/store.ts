// Stato del version control: log, stato del merge, aggiornamento dopo ogni operazione.
import { create } from 'zustand';
import { platform, type GitLog, type MergeResult } from '../platform';
import { useWorkspace } from '../state/workspace';

interface VersionsState {
  log: GitLog | null;
  dirty: boolean;
  merging: MergeResult | null;
  selected: string | null; // sha selezionato nella timeline
  compareWith: string | null;
  refresh(): Promise<void>;
  select(sha: string | null): void;
  setCompare(sha: string | null): void;
  setMerging(m: MergeResult | null): void;
}

export const useVersions = create<VersionsState>((set) => ({
  log: null,
  dirty: false,
  merging: null,
  selected: null,
  compareWith: null,
  async refresh() {
    const root = useWorkspace.getState().vaultRoot;
    if (!root) return;
    try {
      const [log, status] = await Promise.all([platform.gitLog(root), platform.gitStatus(root)]);
      set({ log, dirty: status.dirty });
    } catch {
      set({ log: null });
    }
  },
  select(sha) {
    set({ selected: sha });
  },
  setCompare(sha) {
    set({ compareWith: sha });
  },
  setMerging(m) {
    set({ merging: m });
  },
}));

// il log segue il vault aperto
useWorkspace.subscribe((s, p) => {
  if (s.vaultRoot !== p.vaultRoot) {
    useVersions.setState({ log: null, selected: null, compareWith: null, merging: null });
    void useVersions.getState().refresh();
  }
});
