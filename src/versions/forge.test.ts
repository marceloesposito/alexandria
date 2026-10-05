import { describe, it, expect } from 'vitest';
import { repoSlug, tokenPage, defaultHost } from './forge';

describe('server git', () => {
  it('nome di repository dal nome del Compendium', () => {
    expect(repoSlug('Il mio Compendium')).toBe('Il-mio-Compendium');
    expect(repoSlug('Tesi: perché & come?')).toBe('Tesi-perche-come');
    expect(repoSlug('--.x.--')).toBe('x');
  });
  it('pagine dei token e host predefiniti', () => {
    expect(tokenPage('github', 'github.com')).toContain('scopes=repo');
    expect(tokenPage('gitea', 'codeberg.org')).toBe('https://codeberg.org/user/settings/applications');
    expect(defaultHost('gitlab')).toBe('gitlab.com');
  });
});
