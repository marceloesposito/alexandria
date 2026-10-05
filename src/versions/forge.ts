// Server git (GitHub, GitLab, Gitea/Forgejo): indirizzi e nomi. Funzioni pure.
import type { ForgeKind } from '../platform/types';

/**
 * Client ID dell'OAuth App di Alexandria su GitHub (pubblico, serve al Device Flow).
 * Vuoto = il pulsante "Accedi con GitHub" non compare e resta la via del token personale.
 */
export const GITHUB_CLIENT_ID = '';

export function defaultHost(kind: ForgeKind): string {
  return kind === 'github' ? 'github.com' : kind === 'gitlab' ? 'gitlab.com' : 'codeberg.org';
}

/** Pagina del server in cui creare un token con i permessi giusti (repo / api). */
export function tokenPage(kind: ForgeKind, host: string): string {
  if (kind === 'github') return `https://${host}/settings/tokens/new?scopes=repo&description=Alexandria`;
  if (kind === 'gitlab') return `https://${host}/-/user_settings/personal_access_tokens?name=Alexandria&scopes=api,write_repository`;
  return `https://${host}/user/settings/applications`;
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
