import { describe, it, expect } from 'vitest';
import { MAX_RECENT, withRecent, type SheetEntry } from './sheets';

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
