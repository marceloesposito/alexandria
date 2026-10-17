import { describe, expect, it } from 'vitest';
import { DEFAULT_BAR, MAGNET, clampBar, fromBarPos, normalizeBar, popoverSide, shouldDock, toBarPos } from './barPosition';

const W = 1200;
const H = 800;
const HEADER = 40;

describe('barretta flottante', () => {
  it('di partenza sta in basso al centro', () => {
    expect(fromBarPos(DEFAULT_BAR, 400, 36, W, H, HEADER)).toEqual({ left: 400, top: 800 - 36 - 16 });
  });

  it('magnetica vicino alla barra in alto', () => {
    expect(shouldDock(HEADER + MAGNET, HEADER)).toBe(true);
    expect(shouldDock(HEADER + MAGNET + 1, HEADER)).toBe(false);
    expect(shouldDock(10, HEADER)).toBe(true);
  });

  it('resta dentro la finestra e sotto la barra in alto', () => {
    expect(clampBar(-50, 5, 400, 36, W, H, HEADER)).toEqual({ left: 8, top: 48 });
    expect(clampBar(2000, 2000, 400, 36, W, H, HEADER)).toEqual({ left: 792, top: 756 });
  });

  it('andata e ritorno in frazioni', () => {
    const p = toBarPos(300, 400, 400, W, H);
    expect(p).toEqual({ docked: false, x: 0.4166666666666667, y: 0.5 });
    expect(fromBarPos(p, 400, 36, W, H, HEADER)).toEqual({ left: 300, top: 400 });
  });

  it('i menu si aprono verso il centro', () => {
    expect(popoverSide(DEFAULT_BAR)).toBe('above');
    expect(popoverSide({ docked: true, x: null, y: null })).toBe('below');
    expect(popoverSide({ docked: false, x: 0.5, y: 0.2 })).toBe('below');
    expect(popoverSide({ docked: false, x: 0.5, y: 0.8 })).toBe('above');
  });

  it('valori strani ripuliti', () => {
    expect(normalizeBar({ docked: 'si', x: 3, y: 'no' })).toEqual({ docked: false, x: 1, y: null });
    expect(normalizeBar(null)).toEqual(DEFAULT_BAR);
  });
});
