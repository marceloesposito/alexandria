import { describe, it, expect, vi } from 'vitest';
import { platform } from '../platform';
import { newSheet } from './format';
import { MAX_RECENT, readSheetFile, withRecent, writeSheetFile, type SheetEntry } from './sheets';

const e = (id: string): SheetEntry => ({ id, name: id, updated: '', preview: '' });

describe('pezzi recenti', () => {
  it("il pezzo aperto o salvato va in cima, senza doppioni", () => {
    expect(withRecent([e('/a.clmn'), e('/b.clmn')], e('/b.clmn')).map((x) => x.id)).toEqual(['/b.clmn', '/a.clmn']);
  });

  it('al massimo MAX_RECENT', () => {
    const many = Array.from({ length: MAX_RECENT }, (_, i) => e(`/${i}.clmn`));
    const out = withRecent(many, e('/nuovo.clmn'));
    expect(out).toHaveLength(MAX_RECENT);
    expect(out[0].id).toBe('/nuovo.clmn');
  });
});

describe('salvataggio del pezzo', () => {
  it('due salvataggi insieme dello stesso file passano uno alla volta e vince il piu\' recente', async () => {
    const path = '/prove/pezzo.clmn';
    const write = platform.writeBytes.bind(platform);
    let inFlight = 0;
    let most = 0;
    const spy = vi.spyOn(platform, 'writeBytes').mockImplementation(async (p, d) => {
      most = Math.max(most, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      await write(p, d);
      inFlight--;
    });
    const a = { ...newSheet('f1', new Date()), markdown: 'prima' };
    const b = { ...a, markdown: 'dopo' };
    await Promise.all([writeSheetFile(path, a), writeSheetFile(path, b)]);
    spy.mockRestore();
    expect(most).toBe(1);
    expect((await readSheetFile(path)).markdown).toBe('dopo');
  });
});
