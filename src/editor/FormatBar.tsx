// Barra flottante di formattazione in basso al centro dello Scriptorium: gli strumenti essenziali in
// forma condensata (stile, carattere, colore del testo, evidenziazione, elenchi, link), richiudibile
// in una pillola. Lo stato (aperta, chiusa, nascosta) e' una preferenza.
import { useEffect, useRef, useState } from 'react';
import { Baseline, ChevronDown, ChevronUp, Highlighter, Type } from 'lucide-react';
import { getEditor } from '../state/editorRef';
import { getCommand, runCommand } from '../commands/registry';
import { useCommandTick } from '../shell/useCommands';
import { useWorkspace } from '../state/workspace';
import { t, useLang } from '../i18n';
import { TEXT_COLORS, HIGHLIGHT_COLORS, type TextColor, type HighlightColor } from '../doc/colors';
import { registerWidget } from '../shell/RibbonWidgets';

const GROUPS: string[][] = [
  ['insert.h1', 'insert.h2', 'insert.paragraph'],
  ['fmt.bold', 'fmt.italic', 'fmt.underline', 'fmt.strike'],
  ['insert.bulletList', 'insert.orderedList', 'insert.link', 'fmt.clear'],
];

function Btn({ id }: { id: string }) {
  const c = getCommand(id);
  if (!c) return null;
  const Icon = c.icon;
  const active = c.isActive?.() ?? false;
  return (
    <button
      className={`fbar__btn ${active ? 'is-active' : ''}`}
      title={t(c.label) + (c.shortcut ? ` (${c.shortcut.replace('Mod', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')})` : '')}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => void runCommand(id)}
    >
      {Icon ? <Icon size={16} /> : t(c.label)}
    </button>
  );
}

/** Colore del testo o dell'evidenziazione attivo nella selezione (null: nessuno). */
export function activeColor(kind: 'text' | 'highlight'): string | null {
  const e = getEditor();
  if (!e) return null;
  const a = e.getAttributes(kind === 'text' ? 'textColor' : 'highlight');
  if (kind === 'highlight' && !e.isActive('highlight')) return null;
  return (a.color as string | null) ?? (kind === 'highlight' ? 'yellow' : null);
}

export function applyColor(kind: 'text' | 'highlight', color: string | null) {
  const e = getEditor();
  if (!e) return;
  const c = e.chain().focus();
  if (kind === 'text') (color ? c.setTextColor(color as TextColor) : c.unsetTextColor()).run();
  // il giallo e' l'evidenziazione semplice (<mark>), gli altri colori la portano scritta
  else if (!color) c.unsetHighlight().run();
  // prima si toglie: setMark unirebbe il colore nuovo a quello vecchio
  else c.unsetHighlight().setHighlight(color === 'yellow' ? undefined : { color: color as HighlightColor }).run();
}

/** Pulsante con la tavolozza: colore del testo o evidenziazione. */
export function ColorPicker({ kind, compact = true }: { kind: 'text' | 'highlight'; compact?: boolean }) {
  useLang();
  useCommandTick();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const colors = kind === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const current = activeColor(kind);
  const label = kind === 'text' ? t('fmt.textColor') : t('fmt.highlightColor');
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  const pre = kind === 'text' ? 'tc' : 'hl';
  return (
    <div className="color-picker" ref={ref}>
      <button className={`fbar__btn color-picker__btn ${compact ? '' : 'is-wide'}`} title={label} aria-expanded={open} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((v) => !v)}>
        {kind === 'text' ? <Baseline size={16} /> : <Highlighter size={16} />}
        <span className={`color-picker__bar ${current ? `swatch--${pre}-${current}` : ''} is-${kind}`} />
        {!compact && <span className="color-picker__label">{label}</span>}
      </button>
      {open && (
        <div className="color-picker__menu" role="menu" aria-label={label}>
          <div className="color-picker__title">{label}</div>
          <div className="color-picker__grid">
            {colors.map((c) => (
              <button
                key={c}
                role="menuitemradio"
                aria-checked={current === c}
                className={`color-picker__swatch is-${kind} swatch--${pre}-${c} ${current === c ? 'is-current' : ''}`}
                title={t(`color.${c}`)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  applyColor(kind, c);
                  setOpen(false);
                }}
              >
                {kind === 'text' ? 'A' : ''}
              </button>
            ))}
          </div>
          <button
            className="btn small color-picker__none"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              applyColor(kind, null);
              setOpen(false);
            }}
          >
            {kind === 'text' ? t('fmt.textColorNone') : t('fmt.highlightNone')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Le tavolozze come controlli del ribbon (gruppo Carattere). */
export function registerColorWidgets() {
  registerWidget('textColor', ({ size }) => (
    <label className={`ribbon__widget ribbon__widget--${size}`}>
      <ColorPicker kind="text" compact />
      {size === 'large' && <span className="ribbon__btn-label">{t('fmt.textColor')}</span>}
    </label>
  ));
  registerWidget('highlightColor', ({ size }) => (
    <label className={`ribbon__widget ribbon__widget--${size}`}>
      <ColorPicker kind="highlight" compact />
      {size === 'large' && <span className="ribbon__btn-label">{t('fmt.highlightColor')}</span>}
    </label>
  ));
}

export function FormatBar() {
  useLang();
  useCommandTick();
  const state = useWorkspace((s) => s.app.prefs.formatBar);
  if (state === 'hidden') return null;
  const set = (formatBar: 'open' | 'collapsed') => useWorkspace.getState().setPrefs({ formatBar });
  if (state === 'collapsed')
    return (
      <button className="fbar fbar--pill" title={t('fbar.expand')} onClick={() => set('open')}>
        <Type size={15} />
        <ChevronUp size={14} />
      </button>
    );
  return (
    <div className="fbar" role="toolbar" aria-label={t('fbar.title')}>
      {GROUPS.map((g, i) => (
        <div key={i} className="fbar__group">
          {g.map((id) => (
            <Btn key={id} id={id} />
          ))}
          {i === 1 && (
            <>
              <ColorPicker kind="text" />
              <ColorPicker kind="highlight" />
            </>
          )}
        </div>
      ))}
      <button className="fbar__btn fbar__collapse" title={t('fbar.collapse')} onClick={() => set('collapsed')}>
        <ChevronDown size={16} />
      </button>
    </div>
  );
}
