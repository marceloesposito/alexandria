import { describe, it, expect } from 'vitest';
import { copyFolderName, repoSlug, remoteAllowed } from './remote';

describe('remoto su cartella', () => {
  it('nome della cartella dal nome del Compendium', () => {
    expect(repoSlug('Il mio Compendium')).toBe('Il-mio-Compendium');
    expect(repoSlug('Tesi: perché & come?')).toBe('Tesi-perche-come');
    expect(repoSlug('--.x.--')).toBe('x');
    expect(copyFolderName('Tesi di laurea')).toBe('Tesi-di-laurea.git');
    expect(copyFolderName('???')).toBe('Compendium.git');
  });
  it('nessun server git, nemmeno Codeberg', () => {
    expect(remoteAllowed('https://codeberg.org/marceloesposito/tesi.git')).toBe(false);
    expect(remoteAllowed('https://github.com/marceloesposito/tesi.git')).toBe(false);
    expect(remoteAllowed('git@github.com:x/y.git')).toBe(false);
    expect(remoteAllowed('')).toBe(false);
  });
  it('cartelle locali (chiavetta, NAS) ammesse', () => {
    expect(remoteAllowed('/Volumes/Chiavetta/tesi.git')).toBe(true);
    expect(remoteAllowed('D:\\backup\\tesi.git')).toBe(true);
    expect(remoteAllowed('\\\\nas\\condivisa\\tesi.git')).toBe(true);
    expect(remoteAllowed('file:///srv/tesi.git')).toBe(true);
  });
});
