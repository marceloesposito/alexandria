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

  it('un gruppo tolto nel cestino si puo rimettere', () => {
    const defaults = cfg();
    const c = removeGroup(cfg(), 'b');
    expect(removedGroups(c, defaults, 'home').map((g) => g.id)).toEqual(['b']);
    const back = restoreGroup(c, 'home', removedGroups(c, defaults, 'home')[0]);
    expect(order(back)).toBe('acb');
    expect(removedGroups(back, defaults, 'home')).toEqual([]);
  });
});
