import { describe, it, expect } from 'vitest';
import { repoSlug, remoteAllowed, TOKEN_PAGE } from './forge';

describe('server git', () => {
  it('nome di repository dal nome del Compendium', () => {
    expect(repoSlug('Il mio Compendium')).toBe('Il-mio-Compendium');
    expect(repoSlug('Tesi: perché & come?')).toBe('Tesi-perche-come');
    expect(repoSlug('--.x.--')).toBe('x');
  });
  it('solo Codeberg', () => {
    expect(TOKEN_PAGE).toBe('https://codeberg.org/user/settings/applications');
    expect(remoteAllowed('https://codeberg.org/marceloesposito/tesi.git')).toBe(true);
    expect(remoteAllowed('https://codeberg.org/marceloesposito/tesi')).toBe(true);
    expect(remoteAllowed('https://github.com/marceloesposito/tesi.git')).toBe(false);
    expect(remoteAllowed('https://gitlab.com/x/y.git')).toBe(false);
    expect(remoteAllowed('git@github.com:x/y.git')).toBe(false);
    expect(remoteAllowed('http://codeberg.org/x/y.git')).toBe(false);
    expect(remoteAllowed('https://codeberg.org.evil.com/x/y.git')).toBe(false);
    expect(remoteAllowed('https://codeberg.org/x')).toBe(false);
  });
  it('cartelle locali (chiavetta, NAS) ammesse', () => {
    expect(remoteAllowed('/Volumes/Chiavetta/tesi.git')).toBe(true);
    expect(remoteAllowed('D:\\backup\\tesi.git')).toBe(true);
    expect(remoteAllowed('\\\\nas\\condivisa\\tesi.git')).toBe(true);
    expect(remoteAllowed('file:///srv/tesi.git')).toBe(true);
    expect(remoteAllowed('')).toBe(false);
  });
});
