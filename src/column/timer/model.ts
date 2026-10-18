// Timer di scrittura (pomodoro): stato calcolato dai timestamp, cosi' non deriva quando la finestra
// e' in secondo piano. Funzioni pure: l'orologio e il conteggio delle parole arrivano da fuori.

export type Phase = 'work' | 'short' | 'long';

export interface TimerSettings {
  /** durate in minuti */
  work: number;
  short: number;
  long: number;
  /** fasi di lavoro prima della pausa lunga */
  cycles: number;
  /** la fase successiva parte da sola */
  autoStart: boolean;
  sound: boolean;
  /** entra in Silentium quando parte una fase di lavoro */
  silentium: boolean;
}

export const DEFAULT_TIMER: TimerSettings = { work: 25, short: 5, long: 15, cycles: 4, autoStart: false, sound: true, silentium: false };

export interface TimerState {
  phase: Phase;
  /** fasi di lavoro concluse nel giro corrente (si azzera dopo la pausa lunga) */
  done: number;
  /** istante dell'ultimo avvio o ripresa; null se fermo */
  since: number | null;
  /** millisecondi gia' trascorsi nella fase prima dell'ultima pausa */
  spent: number;
  /** parole del foglio all'inizio della fase */
  wordsAtStart: number;
}

/** Una fase conclusa (per lo storico del giorno e l'avviso). */
export interface PhaseEnd {
  phase: Phase;
  words: number;
  /** finita da sola (non saltata) */
  completed: boolean;
}

export function idle(words = 0): TimerState {
  return { phase: 'work', done: 0, since: null, spent: 0, wordsAtStart: words };
}

export function normalizeSettings(raw: unknown): TimerSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<TimerSettings>;
  const min = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return {
    work: min(r.work, DEFAULT_TIMER.work, 0.05, 240),
    short: min(r.short, DEFAULT_TIMER.short, 0.05, 120),
    long: min(r.long, DEFAULT_TIMER.long, 0.05, 240),
    cycles: Math.round(min(r.cycles, DEFAULT_TIMER.cycles, 1, 12)),
    autoStart: typeof r.autoStart === 'boolean' ? r.autoStart : DEFAULT_TIMER.autoStart,
    sound: typeof r.sound === 'boolean' ? r.sound : DEFAULT_TIMER.sound,
    silentium: typeof r.silentium === 'boolean' ? r.silentium : DEFAULT_TIMER.silentium,
  };
}

export function duration(s: TimerSettings, phase: Phase): number {
  return Math.round(s[phase] * 60_000);
}

export function running(st: TimerState): boolean {
  return st.since !== null;
}

export function elapsed(st: TimerState, now: number): number {
  return st.spent + (st.since !== null ? Math.max(0, now - st.since) : 0);
}

export function remaining(st: TimerState, s: TimerSettings, now: number): number {
  return Math.max(0, duration(s, st.phase) - elapsed(st, now));
}

/** Frazione della fase gia' trascorsa (0..1), per l'anello. */
export function progress(st: TimerState, s: TimerSettings, now: number): number {
  const d = duration(s, st.phase);
  return d ? Math.min(1, elapsed(st, now) / d) : 1;
}

export function start(st: TimerState, now: number, words: number): TimerState {
  if (st.since !== null) return st;
  // una fase mai avviata conta le parole da adesso
  return { ...st, since: now, wordsAtStart: st.spent === 0 ? words : st.wordsAtStart };
}

export function pause(st: TimerState, now: number): TimerState {
  if (st.since === null) return st;
  return { ...st, spent: elapsed(st, now), since: null };
}

export function toggle(st: TimerState, now: number, words: number): TimerState {
  return st.since === null ? start(st, now, words) : pause(st, now);
}

/** Fase che segue `phase` dopo `done` fasi di lavoro concluse. */
export function nextPhase(phase: Phase, done: number, s: TimerSettings): { phase: Phase; done: number } {
  if (phase !== 'work') return { phase: 'work', done: phase === 'long' ? 0 : done };
  const d = done + 1;
  return d >= s.cycles ? { phase: 'long', done: d } : { phase: 'short', done: d };
}

function advance(st: TimerState, s: TimerSettings, at: number, words: number, completed: boolean): { state: TimerState; ended: PhaseEnd } {
  const ended: PhaseEnd = { phase: st.phase, words: Math.max(0, words - st.wordsAtStart), completed };
  const n = nextPhase(st.phase, st.done, s);
  const auto = completed && s.autoStart;
  return { state: { phase: n.phase, done: n.done, since: auto ? at : null, spent: 0, wordsAtStart: words }, ended };
}

/** Passa subito alla fase successiva (la fase saltata non conta come conclusa). */
export function skip(st: TimerState, s: TimerSettings, now: number, words: number): { state: TimerState; ended: PhaseEnd } {
  return advance(st, s, now, words, false);
}

/** Torna all'inizio del giro, fermo. */
export function reset(words: number): TimerState {
  return idle(words);
}

/**
 * Da chiamare a ogni battito: se la fase e' finita passa alla successiva. Con l'avvio automatico
 * la fase nuova parte dall'istante in cui e' finita la precedente (niente secondi persi).
 */
export function tick(st: TimerState, s: TimerSettings, now: number, words: number): { state: TimerState; ended: PhaseEnd | null } {
  if (st.since === null) return { state: st, ended: null };
  const left = remaining(st, s, now);
  if (left > 0) return { state: st, ended: null };
  const endAt = now - (elapsed(st, now) - duration(s, st.phase));
  return advance(st, s, endAt, words, true);
}

/** Storico del giorno: pomodori di lavoro conclusi e parole scritte nelle fasi di lavoro. */
export interface DayLog {
  date: string;
  pomodoros: number;
  words: number;
}

export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function logPhase(log: DayLog | null, ended: PhaseEnd, now: number): DayLog {
  const date = dayKey(now);
  const base = log && log.date === date ? log : { date, pomodoros: 0, words: 0 };
  if (ended.phase !== 'work') return base;
  return { date, pomodoros: base.pomodoros + (ended.completed ? 1 : 0), words: base.words + ended.words };
}

/** mm:ss (o h:mm:ss sopra l'ora). */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(2, '0');
  return h ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`;
}
