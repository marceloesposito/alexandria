// Chip del timer nella barretta: un clic avvia o mette in pausa; la freccia apre il popover con
// salta, azzera, durate, cicli, avvio automatico, suono, Silentium e lo storico di oggi.
import { useEffect, useRef } from 'react';
import { ChevronDown, SkipForward, RotateCcw } from 'lucide-react';
import { useTimer } from './store';
import { clock, dayKey, progress, remaining } from './model';
import { CmdButton } from '../FloatingBar';
import { Popover } from '../../components/Popover';
import { useUi } from '../ui';
import { t, useLang } from '../../i18n';

function Ring({ value, phase }: { value: number; phase: string }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg className={`fx-ring fx-ring--${phase}`} width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <circle cx="9" cy="9" r={r} className="fx-ring__track" />
      <circle cx="9" cy="9" r={r} className="fx-ring__value" strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 9 9)" />
    </svg>
  );
}

function Num({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <label className="fx-field fx-field--row">
      <span>{label}</span>
      <input className="fx-input fx-input--num" type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="fx-check">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function TimerPopover() {
  const s = useTimer((x) => x.settings);
  const log = useTimer((x) => x.log);
  const set = useTimer.getState().setSettings;
  const today = log && log.date === dayKey(Date.now()) ? log : null;
  return (
    <div className="fx-menu fx-timer">
      <div className="fx-timer__actions">
        <button className="fx-menu__item" onClick={() => useTimer.getState().skip()}>
          <SkipForward size={15} /> <span>{t('cmd.timer.skip')}</span>
        </button>
        <button className="fx-menu__item" onClick={() => useTimer.getState().reset()}>
          <RotateCcw size={15} /> <span>{t('cmd.timer.reset')}</span>
        </button>
      </div>
      <div className="fx-menu__sep" />
      <Num label={t('timer.work')} value={s.work} min={1} max={240} onChange={(v) => set({ work: v })} />
      <Num label={t('timer.short')} value={s.short} min={1} max={120} onChange={(v) => set({ short: v })} />
      <Num label={t('timer.long')} value={s.long} min={1} max={240} onChange={(v) => set({ long: v })} />
      <Num label={t('timer.cycles')} value={s.cycles} min={1} max={12} onChange={(v) => set({ cycles: v })} />
      <Check label={t('timer.autoStart')} value={s.autoStart} onChange={(v) => set({ autoStart: v })} />
      <Check label={t('timer.sound')} value={s.sound} onChange={(v) => set({ sound: v })} />
      <Check label={t('timer.silentium')} value={s.silentium} onChange={(v) => set({ silentium: v })} />
      <div className="fx-menu__sep" />
      <div className="fx-timer__today">{t('timer.today', { pomodoros: today?.pomodoros ?? 0, words: today?.words ?? 0 })}</div>
    </div>
  );
}

export function TimerChip() {
  useLang();
  const st = useTimer((x) => x.state);
  const settings = useTimer((x) => x.settings);
  const now = useTimer((x) => x.now);
  const popover = useUi((s) => s.popover);
  const more = useRef<HTMLButtonElement>(null);
  useEffect(() => useTimer.getState().load(), []);
  const left = remaining(st, settings, st.since !== null ? Math.max(now, Date.now()) : now);
  const running = st.since !== null;
  return (
    <span className={`fx-timer-chip fx-timer-chip--${st.phase} ${running ? 'is-running' : ''}`}>
      <CmdButton id="timer.toggle" className="fx-btn--text" pressed={running}>
        <Ring value={progress(st, settings, Date.now())} phase={st.phase} />
        <span className="fx-btn__label fx-mono">{clock(left)}</span>
      </CmdButton>
      <button ref={more} className={`fx-btn fx-btn--narrow ${popover === 'timer' ? 'is-active' : ''}`} title={t('timer.settings')} aria-label={t('timer.settings')} onMouseDown={(e) => e.preventDefault()} onClick={() => useUi.getState().toggle('timer')}>
        <ChevronDown size={12} />
      </button>
      <Popover anchor={more.current} open={popover === 'timer'} onClose={() => useUi.getState().close()} placement="above">
        <TimerPopover />
      </Popover>
    </span>
  );
}
