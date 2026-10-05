import { describe, expect, it } from 'vitest';
import { toStored, fromStored, mapPaths } from './portablePaths';
import { defaultAppState } from './prefs';

describe('percorsi in modalita portable', () => {
  const root = 'E:/Alexandria-data';

  it('dentro la chiavetta diventano relativi, fuori restano assoluti', () => {
    expect(toStored('E:/Alexandria-data/Alexandria/Tesi', root)).toBe('portable:Alexandria/Tesi');
    expect(toStored('E:\\Alexandria-data\\Alexandria\\Tesi', root)).toBe('portable:Alexandria/Tesi');
    expect(toStored('C:/Users/m/Documenti/Altro', root)).toBe('C:/Users/m/Documenti/Altro');
    expect(toStored('E:/Alexandria-data-vecchia/x', root)).toBe('E:/Alexandria-data-vecchia/x');
    expect(toStored('/qualsiasi', null)).toBe('/qualsiasi');
  });

  it('si risolvono sulla chiavetta anche se cambia lettera o volume', () => {
    expect(fromStored('portable:Alexandria/Tesi', 'F:/Alexandria-data')).toBe('F:/Alexandria-data/Alexandria/Tesi');
    expect(fromStored('portable:Alexandria/Tesi', '/Volumes/USB 1/Alexandria-data')).toBe('/Volumes/USB 1/Alexandria-data/Alexandria/Tesi');
    expect(fromStored('C:/assoluto', 'F:/Alexandria-data')).toBe('C:/assoluto');
  });

  it('andata e ritorno su tutto lo stato, chiavi dei cursori comprese', () => {
    const app = defaultAppState();
    app.lastVault = 'E:/Alexandria-data/Alexandria/Tesi';
    app.recentVaults = [app.lastVault, 'C:/altro'];
    app.recentDocs = [{ vault: app.lastVault, doc: 'documents/a.md' }];
    app.cursors = { [`${app.lastVault}|documents/a.md`]: { pos: 3, scroll: 0 } };
    const stored = mapPaths(app, (p) => toStored(p, root));
    expect(stored.lastVault).toBe('portable:Alexandria/Tesi');
    expect(Object.keys(stored.cursors)).toEqual(['portable:Alexandria/Tesi|documents/a.md']);
    const back = mapPaths(stored, (p) => fromStored(p, 'G:/Alexandria-data'));
    expect(back.recentVaults).toEqual(['G:/Alexandria-data/Alexandria/Tesi', 'C:/altro']);
    expect(back.recentDocs[0].vault).toBe('G:/Alexandria-data/Alexandria/Tesi');
  });
});
