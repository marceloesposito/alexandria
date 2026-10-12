// Server git remoto: solo Codeberg (Forgejo, no-profit tedesco). Scelta del committente: dentro
// l'app nessun servizio americano (niente GitHub o GitLab). Funzioni pure.

export const FORGE_HOST = 'codeberg.org';

/** Pagina di Codeberg in cui creare un token d'accesso (permessi: repository in lettura e scrittura). */
export const TOKEN_PAGE = `https://${FORGE_HOST}/user/settings/applications`;

/**
 * Indirizzo remoto ammesso: un repository su Codeberg (https) oppure una cartella locale
 * (chiavetta, NAS, cartella sincronizzata), che non e' un servizio di terzi.
 */
export function remoteAllowed(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (/^https:\/\/codeberg\.org\/[^/\s]+\/[^/\s]+?(\.git)?\/?$/i.test(u)) return true;
  // percorsi locali: assoluti (Unix, Windows, UNC) o file://
  return /^(\/|[A-Za-z]:[\\/]|\\\\|file:\/\/)/.test(u);
}

/** Nome di repository valido a partire dal nome del Compendium. */
export function repoSlug(s: string, trim = true): string {
  const x = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-');
  return trim ? x.replace(/^[-.]+|[-.]+$/g, '').slice(0, 100) : x.slice(0, 100);
}
