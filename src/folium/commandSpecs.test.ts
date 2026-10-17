import { describe, expect, it } from 'vitest';
import { COMMANDS, L0 } from './commandSpecs';

describe("un'azione, un controllo", () => {
  it('ogni comando ha un id unico e una sola casa', () => {
    const ids = COMMANDS.map((c) => c.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('nessun id compare in due superfici L0', () => {
    const seen = new Map<string, string>();
    for (const [surface, groups] of Object.entries(L0))
      for (const g of groups)
        for (const id of g) {
          expect(seen.has(id), `${id} in ${seen.get(id)} e ${surface}`).toBe(false);
          seen.set(id, surface);
          expect(COMMANDS.find((c) => c.id === id)?.home, id).toBe(surface);
        }
  });

  it('i comandi L0 di ogni superficie sono tutti disegnati', () => {
    for (const surface of Object.keys(L0) as (keyof typeof L0)[]) {
      const drawn = new Set(L0[surface].flat());
      // nella barretta e nella barra in alto i popover (L1) fanno parte dello stesso controllo
      const expected = COMMANDS.filter((c) => c.home === surface).map((c) => c.id);
      expect(expected.filter((id) => !drawn.has(id))).toEqual([]);
    }
  });

  it('ogni comando e raggiungibile da una superficie o per nome', () => {
    for (const c of COMMANDS) expect(c.home !== 'none' || c.palette !== false || !!c.shortcut, c.id).toBe(true);
  });

  it('al massimo 10 controlli sempre visibili per superficie', () => {
    for (const [surface, groups] of Object.entries(L0)) expect(groups.length, surface).toBeLessThanOrEqual(10);
    // e in tutto lo schermo (cima, strisce, barretta) non piu' di 10
    expect(L0.header.length + L0.edgeTab.length + L0.bar.length).toBeLessThanOrEqual(10);
    // in cima solo timer, parole ed export
    expect(L0.header.map((g) => g[0])).toEqual(['timer.toggle', 'counts.open', 'export.menu']);
  });
});
