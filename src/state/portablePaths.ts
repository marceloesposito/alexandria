// Modalita' portable: i percorsi dentro la cartella dati della chiavetta si salvano relativi
// ("portable:<percorso>"), cosi' restano validi se cambia la lettera dell'unita' o il volume.
import type { AppState } from './prefs';

const PREFIX = 'portable:';

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

export function toStored(path: string, root: string | null): string {
  if (!root) return path;
  const p = norm(path);
  const r = norm(root);
  if (p === r) return PREFIX;
  return p.toLowerCase().startsWith(r.toLowerCase() + '/') ? PREFIX + p.slice(r.length + 1) : path;
}

export function fromStored(path: string, root: string | null): string {
  if (!path.startsWith(PREFIX)) return path;
  // senza chiavetta (app avviata altrove) il percorso non si puo' risolvere: resta com'e'
  if (!root) return path;
  const rel = path.slice(PREFIX.length);
  return rel ? `${norm(root)}/${rel}` : norm(root);
}

/** Applica una trasformazione a tutti i percorsi assoluti dello stato dell'app. */
export function mapPaths(app: AppState, f: (p: string) => string): AppState {
  const cursors: AppState['cursors'] = {};
  for (const [k, v] of Object.entries(app.cursors)) {
    const i = k.lastIndexOf('|');
    cursors[i < 0 ? k : `${f(k.slice(0, i))}${k.slice(i)}`] = v;
  }
  return {
    ...app,
    lastVault: app.lastVault && f(app.lastVault),
    recentVaults: app.recentVaults.map(f),
    recentDocs: app.recentDocs.map((d) => ({ ...d, vault: f(d.vault) })),
    cursors,
    prefs: { ...app.prefs, libraryPath: app.prefs.libraryPath && f(app.prefs.libraryPath) },
  };
}
