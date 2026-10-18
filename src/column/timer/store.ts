// Timer di scrittura: stato e battito. Impostazioni nelle preferenze dell'app, storico del giorno
// (pomodori e parole) nello stato dell'app. A fine fase un breve suono (WebAudio) e un avviso.
import { create } from 'zustand';
import { DEFAULT_TIMER, idle, logPhase, normalizeSettings, reset, skip, tick, toggle, type DayLog, type PhaseEnd, type TimerSettings, type TimerState } from './model';
import { useColumn } from '../store';
import { wordsNow } from '../editor/counts';
import { t } from '../../i18n';

interface TimerStore {
  settings: TimerSettings;
  state: TimerState;
  log: DayLog | null;
  /** battito per ridisegnare l'orologio */
  now: number;
  load(): void;
  setSettings(p: Partial<TimerSettings>): void;
  toggle(): void;
  skip(): void;
  reset(): void;
}

function beep() {
  try {
    const ctx = new AudioContext();
    const play = (freq: number, at: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.4);
    };
    play(660, 0);
    play(880, 0.18);
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    /* audio non disponibile */
  }
}

let beat: ReturnType<typeof setInterval> | null = null;

export const useTimer = create<TimerStore>((set, get) => {
  const persist = () => useColumn.getState().setApp({ timer: get().settings, timerLog: get().log });

  const ended = (e: PhaseEnd) => {
    const log = logPhase(get().log, e, Date.now());
    set({ log });
    persist();
    if (get().settings.sound) beep();
    const next = get().state.phase;
    useColumn.getState().toast(t(e.phase === 'work' ? 'timer.workDone' : 'timer.breakDone', { words: e.words }), 'ok');
    // Silentium al via della fase di lavoro
    if (next === 'work' && get().state.since !== null && get().settings.silentium) useColumn.getState().setSilentium(true);
    if (next !== 'work' && get().settings.silentium) useColumn.getState().setSilentium(false);
  };

  const ensureBeat = () => {
    if (beat) return;
    beat = setInterval(() => {
      const r = tick(get().state, get().settings, Date.now(), wordsNow());
      set({ now: Date.now(), state: r.state });
      if (r.ended) ended(r.ended);
      if (r.state.since === null && beat) {
        clearInterval(beat);
        beat = null;
      }
    }, 500);
  };

  return {
    settings: DEFAULT_TIMER,
    state: idle(),
    log: null,
    now: Date.now(),
    load() {
      const app = useColumn.getState().app;
      const raw = app.timerLog as DayLog | undefined;
      set({ settings: normalizeSettings(app.timer), log: raw && typeof raw.date === 'string' ? raw : null });
    },
    setSettings(p) {
      set({ settings: normalizeSettings({ ...get().settings, ...p }) });
      persist();
    },
    toggle() {
      const st = toggle(get().state, Date.now(), wordsNow());
      set({ state: st, now: Date.now() });
      if (st.since !== null) {
        ensureBeat();
        if (st.phase === 'work' && get().settings.silentium) useColumn.getState().setSilentium(true);
      }
    },
    skip() {
      const r = skip(get().state, get().settings, Date.now(), wordsNow());
      set({ state: r.state, now: Date.now(), log: logPhase(get().log, r.ended, Date.now()) });
      persist();
    },
    reset() {
      set({ state: reset(wordsNow()), now: Date.now() });
    },
  };
});
