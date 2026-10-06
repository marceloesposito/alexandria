import { describe, expect, it } from 'vitest';
import { placeGroup, setGroupCompact, removeGroup, removedGroups, restoreGroup, reconcile, type RibbonConfig } from './ribbonModel';

const cfg = (): RibbonConfig => ({
  version: 1,
  tabs: [
    {
      id: 'home',
      view: 'editor',
      label: 'Home',
      groups: [
        { id: 'a', label: 'A', items: ['x'] },
        { id: 'b', label: 'B', items: ['y'] },
        { id: 'c', label: 'C', items: ['z'] },
      ],
    },
  ],
});

const order = (c: RibbonConfig) => c.tabs[0].groups.map((g) => g.id).join('');

describe('gruppi del ribbon', () => {
  it('trascinamento: la posizione e quella fra i gruppi a schermo', () => {
    expect(order(placeGroup(cfg(), 'a', 3))).toBe('bca'); // in fondo
    expect(order(placeGroup(cfg(), 'a', 2))).toBe('bac'); // fra b e c
    expect(order(placeGroup(cfg(), 'c', 0))).toBe('cab'); // in testa
    expect(order(placeGroup(cfg(), 'b', 1))).toBe('abc'); // davanti a se stesso: fermo
    expect(order(placeGroup(cfg(), 'b', 2))).toBe('abc'); // subito dopo se stesso: fermo
  });

  it('esteso o compatto, e la scelta sopravvive alla riconciliazione', () => {
    const c = setGroupCompact(cfg(), 'b', true);
    expect(c.tabs[0].groups[1].compact).toBe(true);
    const r = reconcile(c, cfg(), new Set(['x', 'y', 'z']));
    expect(r.tabs[0].groups[1].compact).toBe(true);
  });

  it('un gruppo predefinito nuovo compare anche nelle barre salvate, una volta sola', () => {
    const v2: RibbonConfig = { ...cfg(), rev: 2 };
    v2.tabs[0] = { ...v2.tabs[0], groups: [...v2.tabs[0].groups] };
    v2.tabs[0].groups.splice(1, 0, { id: 'n', label: 'n', items: ['x'], since: 2 });
    const old = removeGroup(cfg(), 'c'); // barra salvata prima della revisione 2
    const r = reconcile(old, v2, new Set(['x', 'y', 'z']));
    expect(order(r)).toBe('anb'); // al suo posto; il gruppo tolto prima resta tolto
    expect(r.rev).toBe(2);
    // l'utente lo toglie: alla riconciliazione successiva non torna
    expect(order(reconcile(removeGroup(r, 'n'), v2, new Set(['x', 'y', 'z'])))).toBe('ab');
  });

  it('un gruppo tolto nel cestino si puo rimettere', () => {
    const defaults = cfg();
    const c = removeGroup(cfg(), 'b');
    expect(removedGroups(c, defaults, 'home').map((g) => g.id)).toEqual(['b']);
    const back = restoreGroup(c, 'home', removedGroups(c, defaults, 'home')[0]);
    expect(order(back)).toBe('acb');
    expect(removedGroups(back, defaults, 'home')).toEqual([]);
  });
});
