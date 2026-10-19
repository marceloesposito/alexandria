// Barra della tabella: compare sopra la barra di formattazione quando il cursore sta in una tabella.
// Numero di righe e colonne, allineamento della colonna, larghezze uguali e il resto del menu.
import { useEffect, useState } from 'react';
import { Minus, MoreHorizontal, Plus } from 'lucide-react';
import { getEditor } from '../state/editorRef';
import { getCommand, runCommand } from '../commands/registry';
import { useCommandTick } from '../shell/useCommands';
import { t, useLang } from '../i18n';
import { setTableSize, tableAt } from './tableActions';
import { MAX_COLS, MAX_ROWS } from './tableModel';
import { openContextMenu } from '../components/ContextMenu';
import { tableMenuItems } from './extensions/tableTools';

function Stepper({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && n >= 1 && n !== value) onChange(Math.min(max, Math.round(n)));
    else setText(String(value));
  };
  return (
    <div className="tbar__stepper" role="group" aria-label={label}>
      <span className="tbar__label">{label}</span>
      <button className="fbar__btn" title={t('tbar.less')} disabled={value <= 1} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(value - 1)}>
        <Minus size={14} />
      </button>
      <input
        className="tbar__count"
        value={text}
        inputMode="numeric"
        aria-label={label}
        onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') setText(String(value));
        }}
      />
      <button className="fbar__btn" title={t('tbar.more')} disabled={value >= max} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(value + 1)}>
        <Plus size={14} />
      </button>
    </div>
  );
}

function Btn({ id }: { id: string }) {
  const c = getCommand(id);
  if (!c) return null;
  const Icon = c.icon;
  const active = c.isActive?.() ?? false;
  return (
    <button
      className={`fbar__btn ${active ? 'is-active' : ''}`}
      title={t(c.label)}
      aria-pressed={active}
      disabled={c.isEnabled ? !c.isEnabled() : false}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => void runCommand(id)}
    >
      {Icon ? <Icon size={16} /> : t(c.label)}
    </button>
  );
}

export function TableBar() {
  useLang();
  useCommandTick();
  const editor = getEditor();
  const here = editor && editor.isEditable ? tableAt(editor.state) : null;
  if (!editor || !here) return null;
  return (
    <div className="fbar tbar" role="toolbar" aria-label={t('tbar.title')} title={t('tbar.widthsHint')}>
      <div className="fbar__group">
        <Stepper label={t('tbar.rows')} value={here.rows} max={MAX_ROWS} onChange={(n) => setTableSize(editor, n, here.cols)} />
        <Stepper label={t('tbar.cols')} value={here.cols} max={MAX_COLS} onChange={(n) => setTableSize(editor, here.rows, n)} />
      </div>
      <div className="fbar__group">
        <Btn id="table.align.left" />
        <Btn id="table.align.center" />
        <Btn id="table.align.right" />
        <Btn id="table.equalWidths" />
      </div>
      <div className="fbar__group">
        <button
          className="fbar__btn"
          title={t('tbar.title')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            openContextMenu({ clientX: r.left, clientY: r.top - 8 }, tableMenuItems());
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}
