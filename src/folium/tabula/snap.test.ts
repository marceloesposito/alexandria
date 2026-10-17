import { describe, expect, it } from 'vitest';
import { NO_SNAP, SNAP, clampFrame, dragClamp, parkedFrame, shouldPark, trackSnap, unsnap, visibleShare, zoneAt, zoneFrame } from './snap';

describe('parcheggio oltre il bordo', () => {
  const f = { x: 0.3, y: 0.02, w: 0.4, h: 0.96 };
  it('parcheggiata resta fuori solo la striscia', () => {
    const p = parkedFrame(f, 0.01);
    expect(p.x + p.w).toBeCloseTo(0.01);
    expect(p.w).toBe(0.4);
    expect(p.h).toBe(0.96);
  });
  it('trascinando si puo uscire a sinistra fino alla striscia, non oltre', () => {
    expect(dragClamp({ ...f, x: -1 }, 0.01).x).toBeCloseTo(-0.39);
    expect(dragClamp({ ...f, x: 0.9 }, 0.01).x).toBeCloseTo(0.6);
  });
  it('al rilascio si parcheggia se e piu fuori che dentro', () => {
    expect(visibleShare(f)).toBeCloseTo(1);
    expect(shouldPark({ ...f, x: -0.1 })).toBe(false);
    expect(shouldPark({ ...f, x: -0.25 })).toBe(true);
  });
});

const W = 1200;
const H = 800;

describe('aggancio della Tabula', () => {
  it('zone: lati, angoli, alto', () => {
    expect(zoneAt(600, 400, W, H)).toBeNull();
    expect(zoneAt(3, 400, W, H)).toBe('left');
    expect(zoneAt(W - 2, 400, W, H)).toBe('right');
    expect(zoneAt(600, 2, W, H)).toBe('top');
    expect(zoneAt(2, 40, W, H)).toBe('top-left');
    expect(zoneAt(40, 2, W, H)).toBe('top-left');
    expect(zoneAt(W - 1, H - 30, W, H)).toBe('bottom-right');
    expect(zoneAt(30, H - 1, W, H)).toBe('bottom-left');
    // poco sensibile: a 20 px dal bordo non succede nulla
    expect(zoneAt(20, 400, W, H)).toBeNull();
  });

  it('riquadri delle zone', () => {
    expect(zoneFrame('left')).toEqual({ x: 0, y: 0, w: 0.5, h: 1 });
    expect(zoneFrame('bottom-right')).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
    expect(zoneFrame('top')).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('si arma solo restando fermi vicino al bordo', () => {
    let s = trackSnap(NO_SNAP, 3, 400, W, H, 0);
    expect(s).toMatchObject({ zone: 'left', armed: false });
    s = trackSnap(s, 4, 402, W, H, SNAP.dwell - 1);
    expect(s.armed).toBe(false);
    s = trackSnap(s, 4, 403, W, H, SNAP.dwell + 5);
    expect(s.armed).toBe(true);
  });

  it('passare veloce lungo il bordo non aggancia', () => {
    let s = NO_SNAP;
    for (let i = 0; i <= 10; i++) s = trackSnap(s, 3, 200 + i * 30, W, H, i * 60);
    expect(s.armed).toBe(false);
  });

  it('uscire dalla zona disarma', () => {
    let s = trackSnap(NO_SNAP, 3, 400, W, H, 0);
    s = trackSnap(s, 3, 400, W, H, 500);
    expect(s.armed).toBe(true);
    expect(trackSnap(s, 200, 400, W, H, 600)).toEqual(NO_SNAP);
  });

  it('una volta armato resta armato anche muovendosi nella stessa zona', () => {
    let s = trackSnap(NO_SNAP, 3, 400, W, H, 0);
    s = trackSnap(s, 3, 400, W, H, 400);
    s = trackSnap(s, 2, 500, W, H, 450);
    expect(s).toMatchObject({ zone: 'left', armed: true });
  });

  it('limiti e stacco da una finestra agganciata', () => {
    expect(clampFrame({ x: 0.9, y: -0.2, w: 0.5, h: 0.05 })).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.2 });
    const free = { x: 0.1, y: 0.1, w: 0.4, h: 0.6 };
    const f = unsnap(free, zoneFrame('right'), 0.75, 0.02);
    expect(f.w).toBe(0.4);
    expect(f.h).toBe(0.6);
    // il puntatore resta a meta' della barra, come prima
    expect(f.x + f.w * 0.5).toBeCloseTo(0.75);
  });
});
