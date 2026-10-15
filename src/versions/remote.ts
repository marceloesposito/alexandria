// Remoto del Compendium: solo una cartella (chiavetta, NAS, cartella sincronizzata con Nextcloud o
// Syncthing). Nessun server git di terzi: i termini dei servizi gratuiti, Codeberg compreso, non
// ammettono testi personali privati e possono rimuoverli. Funzioni pure.

/** Indirizzo remoto ammesso: un percorso locale assoluto (Unix, Windows, UNC) o file://. */
export function remoteAllowed(url: string): boolean {
  return /^(\/|[A-Za-z]:[\\/]|\\\\|file:\/\/)/.test(url.trim());
}

/** Nome di cartella valido a partire dal nome del Compendium. */
export function repoSlug(s: string, trim = true): string {
  const x = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-');
  return trim ? x.replace(/^[-.]+|[-.]+$/g, '').slice(0, 100) : x.slice(0, 100);
}

/** Cartella della copia dentro quella scelta: "<cartella>/<Nome>.git". */
export const copyFolderName = (vaultName: string) => `${repoSlug(vaultName) || 'Compendium'}.git`;
