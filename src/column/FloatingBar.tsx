// Barretta flottante in basso al centro: la stessa base per lo Scriptorium, la Tabula e il
// Palimpsestus. Controlli di almeno 28 px, separatori fra i gruppi.
import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { specOf } from './commandSpecs';
import { runCommand, isActive } from './commands';
import { shortcutLabel } from './keys';
import { t } from '../i18n';

export function FloatingBar({ children, faded, label }: { children: ReactNode; faded?: boolean; label: string }) {
  return (
    <div className={`fx-fbar ${faded ? 'is-faded' : ''}`} role="toolbar" aria-label={label}>
      {children}
    </div>
  );
}

export function BarSep() {
  return <span className="fx-fbar__sep" aria-hidden />;
}

/** Titolo con la scorciatoia, se c'e'. */
export function commandTitle(id: string): string {
  const s = specOf(id);
  if (!s) return id;
  return s.shortcut ? `${t(s.label)} (${shortcutLabel(s.shortcut)})` : t(s.label);
}

type BtnProps = { id: string; children: ReactNode; pressed?: boolean; onRun?: () => void } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'id'>;

/** Pulsante di un comando del registro. Non toglie il fuoco al testo. */
export const CmdButton = forwardRef<HTMLButtonElement, BtnProps>(function CmdButton({ id, children, pressed, onRun, className, ...rest }, ref) {
  const active = pressed ?? isActive(id);
  return (
    <button
      ref={ref}
      className={`fx-btn ${active ? 'is-active' : ''} ${className ?? ''}`}
      title={commandTitle(id)}
      aria-label={t(specOf(id)?.label ?? id)}
      aria-pressed={active}
      data-cmd={id}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => (onRun ? onRun() : runCommand(id))}
      {...rest}
    >
      {children}
    </button>
  );
});
