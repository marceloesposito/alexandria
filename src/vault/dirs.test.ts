import { describe, it, expect, beforeEach } from 'vitest';
import { platform, joinPath } from '../platform';
import { ensureVault, listDocuments, createDocument, dirsOf } from './vault';
import { namedDirs, LEGACY_DIRS, setVaultDirs, docKey, isDocPath, commentsFile } from './paths';
import { setLang } from '../i18n';

describe('cartelle del Compendium', () => {
  beforeEach(() => setVaultDirs(LEGACY_DIRS));

  it('nomi dell\'app, nella lingua dell\'interfaccia', () => {
    expect(namedDirs('it')).toEqual({ docs: 'Pergamene', res: 'Armarium' });
    expect(namedDirs('en')).toEqual({ docs: 'Scrolls', res: 'Armarium' });
  });

  it('un Compendium nuovo ha Pergamene e Armarium, e li usa', async () => {
    setLang('it');
    const root = `/prova-dirs-${Date.now()}`;
    const cfg = await ensureVault(root);
    expect(dirsOf(cfg)).toEqual({ docs: 'Pergamene', res: 'Armarium' });
    expect(await platform.exists(joinPath(root, 'Pergamene'))).toBe(true);
    expect(await platform.exists(joinPath(root, 'Armarium'))).toBe(true);
    expect(await platform.exists(joinPath(root, 'documents'))).toBe(false);
    const rel = await createDocument(root, [], 'Capitolo');
    expect(rel).toBe('Pergamene/Capitolo.md');
    expect((await listDocuments(root, cfg)).map((d) => d.rel)).toEqual(['Pergamene/Capitolo.md']);
    expect(docKey(rel)).toBe('Capitolo');
    expect(commentsFile('Pergamene/a/b.md')).toBe('.alexandria/comments/a~b.json');
    expect(isDocPath('Pergamene/x.md')).toBe(true);
    expect(isDocPath('Armarium/r1/meta.json')).toBe(false);
  });

  it('una cartella che ha gia\' documents/ resta com\'era', async () => {
    const root = `/prova-legacy-${Date.now()}`;
    await platform.mkdir(joinPath(root, 'documents'));
    await platform.writeText(joinPath(root, 'documents', 'Vecchia.md'), 'testo');
    const cfg = await ensureVault(root);
    expect(dirsOf(cfg)).toEqual(LEGACY_DIRS);
    expect((await listDocuments(root, cfg)).map((d) => d.rel)).toEqual(['documents/Vecchia.md']);
    expect(await platform.exists(joinPath(root, 'Pergamene'))).toBe(false);
  });

  it('un vault.json di prima, senza cartelle, vale come documents/ e resources/', () => {
    expect(dirsOf({ version: 1, name: 'x', created: '', order: [] })).toEqual(LEGACY_DIRS);
  });
});
