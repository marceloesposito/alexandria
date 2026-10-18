import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMER, clock, idle, logPhase, nextPhase, normalizeSettings, pause, remaining, reset, skip, start, tick, toggle, type TimerSettings } from './model';

const S: TimerSettings = { ...DEFAULT_TIMER, work: 25, short: 5, long: 15, cycles: 2 };
const MIN = 60_000;

describe('timer', () => {
  it('conta dai timestamp e si mette in pausa', () => {
    let st = start(idle(), 0, 100);
    expect(remaining(st, S, 10 * MIN)).toBe(15 * MIN);
    st = pause(st, 10 * MIN);
    // in pausa il tempo non passa
    expect(remaining(st, S, 60 * MIN)).toBe(15 * MIN);
    st = toggle(st, 60 * MIN, 150);
    expect(remaining(st, S, 65 * MIN)).toBe(10 * MIN);
    // la ripresa non sposta l'inizio del conteggio delle parole
    expect(st.wordsAtStart).toBe(100);
  });

  it('alla fine della fase passa alla successiva e conta le parole', () => {
    const st = start(idle(), 0, 100);
    expect(tick(st, S, 24 * MIN, 120).ended).toBeNull();
    const r = tick(st, S, 25 * MIN + 500, 180);
    expect(r.ended).toEqual({ phase: 'work', words: 80, completed: true });
    expect(r.state.phase).toBe('short');
    expect(r.state.since).toBeNull();
  });

  it("con l'avvio automatico la fase nuova parte da quando e' finita la precedente", () => {
    const auto = { ...S, autoStart: true };
    const r = tick(start(idle(), 0, 0), auto, 26 * MIN, 0);
    expect(r.state.since).toBe(25 * MIN);
    expect(remaining(r.state, auto, 26 * MIN)).toBe(4 * MIN);
  });

  it('dopo i cicli arriva la pausa lunga, poi il giro ricomincia', () => {
    expect(nextPhase('work', 0, S)).toEqual({ phase: 'short', done: 1 });
    expect(nextPhase('work', 1, S)).toEqual({ phase: 'long', done: 2 });
    expect(nextPhase('long', 2, S)).toEqual({ phase: 'work', done: 0 });
    expect(nextPhase('short', 1, S)).toEqual({ phase: 'work', done: 1 });
  });

  it('salta e azzera', () => {
    const r = skip(start(idle(), 0, 10), S, MIN, 30);
    expect(r.ended.completed).toBe(false);
    expect(r.state.phase).toBe('short');
    expect(reset(30)).toEqual(idle(30));
  });

  it('lo storico del giorno conta solo il lavoro concluso', () => {
    const now = new Date(2026, 9, 17, 10).getTime();
    let log = logPhase(null, { phase: 'work', words: 200, completed: true }, now);
    log = logPhase(log, { phase: 'short', words: 0, completed: true }, now);
    log = logPhase(log, { phase: 'work', words: 50, completed: false }, now);
    expect(log).toEqual({ date: '2026-10-17', pomodoros: 1, words: 250 });
    expect(logPhase(log, { phase: 'work', words: 1, completed: true }, now + 86_400_000).pomodoros).toBe(1);
  });

  it('impostazioni ripulite e orologio', () => {
    expect(normalizeSettings({ work: -3, cycles: 99, sound: 'no' })).toEqual({ ...DEFAULT_TIMER, work: 0.05, cycles: 12 });
    expect(clock(25 * MIN)).toBe('25:00');
    expect(clock(61_500)).toBe('01:02');
    expect(clock(2 * 3600_000)).toBe('2:00:00');
  });
});
