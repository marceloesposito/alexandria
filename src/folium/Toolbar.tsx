// Barretta di Folium: Stile ▾ | B I U S | Colore ▾ | + ▾ | ⏱ | contatore | Esporta. Libera, si sposta
// dalla maniglia dove si vuole; portata vicino alla barra in alto vi si aggancia da sola (magnetica)
// e ne diventa parte; trascinata via si stacca. La posizione resta nelle preferenze (barPosition.ts).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import { Bold, Italic, Underline, Strikethrough, Baseline, Plus, ChevronDown, Minus, RotateCcw, GripVertical, Share, Check } from 'lucide-react';
import { TEXT_COLORS, HIGHLIGHT_COLORS, type TextColor, type HighlightColor } from 'logos/doc/colors';
import { BarSep, CmdButton } from './FloatingBar';
import { Popover } from '../components/Popover';
import { useUi } from './ui';
import { useEditorRef } from './editor/editorRef';
import { useCounts } from './editor/counts';
import { COUNT_KEYS, countValue, countsLabel, toggleShown, type CountKey } from './editor/countsModel';
import { useFolium } from './store';
import { insertItems } from './editor/insertItems';
import { runCommand } from './commands';
import { specOf } from './commandSpecs';
import { shortcutLabel } from './keys';
import { TimerChip } from './timer/TimerChip';
import { DEFAULT_BAR, clampBar, fromBarPos, popoverSide, shouldDock, toBarPos } from './barPosition';
import { getLang, t, useLang } from '../i18n';
import type { SheetFont } from './format';

const STYLE_IDS = ['p', 'h1', 'h2', 'h3', 'quote', 'code'];
type Side = 'above' | 'below';

function currentStyle(e: Editor | null): string {
  if (!e) return t('style.body');
  if (e.isActive('heading', { level: 1 })) return t('style.h1');
  if (e.isActive('heading', { level: 2 })) return t('style.h2');
  if (e.isActive('heading', { level: 3 })) return t('style.h3');
  if (e.isActive('codeBlock')) return t('style.code');
  if (e.isActive('blockquote')) return t('style.quote');
  return t('style.body');
}

function StylePopover({ editor }: { editor: Editor }) {
  const font = useFolium((s) => s.sheet?.meta.font ?? 'serif');
  const items = insertItems().filter((i) => STYLE_IDS.includes(i.id));
  return (
    <div className="fx-menu" role="menu">
      {items.map((it) => (
        <button
          key={it.id}
          role="menuitem"
          className="fx-menu__item"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            it.run(editor);
            useUi.getState().close();
          }}
        >
          <it.icon size={16} />
          <span>{it.label}</span>
        </button>
      ))}
      <div className="fx-menu__sep" />
      <div className="fx-menu__label">{t('style.font')}</div>
      <div className="fx-seg" role="radiogroup" aria-label={t('style.font')}>
        {(['serif', 'sans', 'mono'] as SheetFont[]).map((f) => (
          <button key={f} role="radio" aria-checked={font === f} className={`fx-seg__btn fx-font--${f} ${font === f ? 'is-active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => useFolium.getState().setMeta({ font: f })}>
            {t(`style.font.${f}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorPopover({ editor }: { editor: Editor }) {
  const [tab, setTab] = useState<'text' | 'highlight'>('text');
  const colors = tab === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const apply = (c: string | null) => {
    const chain = editor.chain().focus();
    if (tab === 'text') (c ? chain.setTextColor(c as TextColor) : chain.unsetTextColor()).run();
    else if (!c) chain.unsetHighlight().run();
    else chain.unsetHighlight().setHighlight(c === 'yellow' ? undefined : { color: c as HighlightColor }).run();
    useUi.getState().close();
  };
  return (
    <div className="fx-menu fx-colors">
      <div className="fx-seg" role="tablist">
        {(['text', 'highlight'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`fx-seg__btn ${tab === k ? 'is-active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setTab(k)}>
            {t(`color.tab.${k}`)}
          </button>
        ))}
      </div>
      <div className="fx-colors__grid">
        {colors.map((c) => (
          <button key={c} className={`fx-swatch fx-swatch--${tab} ${tab === 'text' ? 'tc' : 'hl'}-${c}`} title={t(`color.${c}`)} aria-label={t(`color.${c}`)} onMouseDown={(e) => e.preventDefault()} onClick={() => apply(c)}>
            {tab === 'text' ? 'A' : ''}
          </button>
        ))}
      </div>
      <button className="fx-menu__item" onMouseDown={(e) => e.preventDefault()} onClick={() => apply(null)}>
        {t('color.none')}
      </button>
    </div>
  );
}

function InsertPopover({ editor }: { editor: Editor }) {
  const items = insertItems().filter((i) => !i.block);
  return (
    <div className="fx-menu" role="menu">
      {items.map((it) => (
        <button
          key={it.id}
          role="menuitem"
          className="fx-menu__item"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            useUi.getState().close();
            it.run(editor);
          }}
        >
          <it.icon size={16} />
          <span>{it.label}</span>
        </button>
      ))}
      <div className="fx-menu__hint">{t('insert.slashHint')}</div>
    </div>
  );
}

const unit = (k: CountKey, n: number) => t(`counts.unit.${k}.${n === 1 ? 'one' : 'other'}`);

/** Conteggi: ognuno si puo' mettere o togliere dal contatore; in fondo lo zoom. */
function CountsPopover() {
  const c = useCounts((s) => s.doc);
  const pages = useCounts((s) => s.pages);
  const sel = useCounts((s) => s.selection);
  const shown = useFolium((s) => s.app.counts);
  const zoom = useFolium((s) => s.app.zoom);
  return (
    <div className="fx-menu fx-counts">
      <div className="fx-menu__label">{t('counts.show')}</div>
      {COUNT_KEYS.map((k) => (
        <button
          key={k}
          role="menuitemcheckbox"
          aria-checked={shown.includes(k)}
          className={`fx-menu__item fx-counts__row ${shown.includes(k) ? 'is-on' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => useFolium.getState().setApp({ counts: toggleShown(shown, k) })}
        >
          <span className="fx-counts__check">{shown.includes(k) ? <Check size={14} /> : null}</span>
          <span>{t(`counts.${k}`)}</span>
          <span className="fx-counts__value">{k === 'cartelle' ? countValue(c, k, pages).toLocaleString(getLang(), { maximumFractionDigits: 1 }) : countValue(c, k, pages).toLocaleString(getLang())}</span>
        </button>
      ))}
      {sel && <div className="fx-menu__hint">{t('counts.selectionValue', { words: sel.words, chars: sel.chars })}</div>}
      <div className="fx-menu__sep" />
      <div className="fx-zoom">
        <span>{t('counts.zoom')}</span>
        <button className="fx-icon" onClick={() => runCommand('zoom.out')} title={t('cmd.zoom.out')} aria-label={t('cmd.zoom.out')}>
          <Minus size={14} />
        </button>
        <span className="fx-zoom__value">{Math.round(zoom * 100)}%</span>
        <button className="fx-icon" onClick={() => runCommand('zoom.in')} title={t('cmd.zoom.in')} aria-label={t('cmd.zoom.in')}>
          <Plus size={14} />
        </button>
        <button className="fx-icon" onClick={() => runCommand('zoom.reset')} title={t('cmd.zoom.reset')} aria-label={t('cmd.zoom.reset')}>
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
}

const EXPORTS = ['sheet.exportDocx', 'sheet.exportPdf', 'sheet.saveAs', 'sheet.toCompendium'];

/** Il contenuto della barretta, libera o agganciata. */
function ToolbarContent({ side, grip }: { side: Side; grip?: React.ReactNode }) {
  useLang();
  const editor = useEditorRef((s) => s.editor);
  useEditorRef((s) => s.tick);
  const popover = useUi((s) => s.popover);
  const c = useCounts((s) => s.doc);
  const pages = useCounts((s) => s.pages);
  const sel = useCounts((s) => s.selection);
  const shown = useFolium((s) => s.app.counts);
  const refs = {
    style: useRef<HTMLButtonElement>(null),
    color: useRef<HTMLButtonElement>(null),
    insert: useRef<HTMLButtonElement>(null),
    counts: useRef<HTMLButtonElement>(null),
    export: useRef<HTMLButtonElement>(null),
  };
  const close = () => useUi.getState().close();
  const label = sel ? t('bar.wordsSelected', { n: sel.words }) : countsLabel(c, shown, pages, unit, getLang());
  return (
    <>
      {grip}
      <CmdButton id="text.style" ref={refs.style} className="fx-btn--text" pressed={popover === 'style'}>
        <span className="fx-btn__label">{currentStyle(editor)}</span>
        <ChevronDown size={13} />
      </CmdButton>
      <BarSep />
      <CmdButton id="text.bold">
        <Bold size={16} />
      </CmdButton>
      <CmdButton id="text.italic">
        <Italic size={16} />
      </CmdButton>
      <CmdButton id="text.underline">
        <Underline size={16} />
      </CmdButton>
      <CmdButton id="text.strike">
        <Strikethrough size={16} />
      </CmdButton>
      <BarSep />
      <CmdButton id="text.color" ref={refs.color} pressed={popover === 'color'}>
        <Baseline size={16} />
        <ChevronDown size={12} />
      </CmdButton>
      <CmdButton id="text.insert" ref={refs.insert} pressed={popover === 'insert'}>
        <Plus size={16} />
        <ChevronDown size={12} />
      </CmdButton>
      <BarSep />
      <TimerChip placement={side} />
      <BarSep />
      <CmdButton id="counts.open" ref={refs.counts} className="fx-btn--text" pressed={popover === 'counts'}>
        <span className="fx-btn__label">{label}</span>
      </CmdButton>
      <BarSep />
      <CmdButton id="export.menu" ref={refs.export} className="fx-btn--text" pressed={popover === 'export'}>
        <Share size={14} />
        <span className="fx-btn__label">{t('cmd.export.menu')}</span>
      </CmdButton>
      {editor && (
        <>
          <Popover anchor={refs.style.current} open={popover === 'style'} onClose={close} placement={side}>
            <StylePopover editor={editor} />
          </Popover>
          <Popover anchor={refs.color.current} open={popover === 'color'} onClose={close} placement={side}>
            <ColorPopover editor={editor} />
          </Popover>
          <Popover anchor={refs.insert.current} open={popover === 'insert'} onClose={close} placement={side}>
            <InsertPopover editor={editor} />
          </Popover>
        </>
      )}
      <Popover anchor={refs.counts.current} open={popover === 'counts'} onClose={close} placement={side}>
        <CountsPopover />
      </Popover>
      <Popover anchor={refs.export.current} open={popover === 'export'} onClose={close} placement={side}>
        <div className="fx-menu" role="menu">
          {EXPORTS.map((id) => {
            const s = specOf(id)!;
            return (
              <button
                key={id}
                role="menuitem"
                className="fx-menu__item"
                data-cmd={id}
                onClick={() => {
                  close();
                  runCommand(id);
                }}
              >
                <span>{t(s.label)}</span>
                {s.shortcut && <span className="fx-menu__key">{shortcutLabel(s.shortcut)}</span>}
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}

const HEADER_H = 40;

/**
 * La barretta: agganciata si disegna nel posto che le lascia la barra in alto (`#fx-dock`), libera
 * galleggia sopra il testo. La maniglia la sposta; il trascinamento la stacca e, vicino alla barra
 * in alto, la riaggancia.
 */
export function Toolbar() {
  useLang();
  const pos = useFolium((s) => s.app.bar ?? DEFAULT_BAR);
  const box = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<{ left: number; top: number; dock: boolean } | null>(null);
  const [, setTick] = useState(0);
  const dockEl = typeof document !== 'undefined' ? document.getElementById('fx-dock') : null;

  // la posizione libera e' in frazioni: si ricalcola quando cambiano le misure della finestra o
  // della barretta (la sua larghezza si conosce solo dopo averla disegnata)
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const f = () => setTick((n) => n + 1);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize((prev) => (prev.w === el.offsetWidth && prev.h === el.offsetHeight ? prev : { w: el.offsetWidth, h: el.offsetHeight }));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [pos.docked, live === null]);

  // il trascinamento segue la finestra intera: la barretta puo' passare dalla barra in alto al testo
  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const d = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height, sx: e.clientX, sy: e.clientY };
    let last: { left: number; top: number; dock: boolean } | null = null;
    const move = (ev: PointerEvent) => {
      if (!last && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) < 4) return;
      const rawTop = ev.clientY - d.dy;
      const p = clampBar(ev.clientX - d.dx, rawTop, d.w, d.h, window.innerWidth, window.innerHeight, 0);
      last = { ...p, dock: shouldDock(rawTop, HEADER_H) };
      setLive(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (last) {
        const cur = useFolium.getState().app.bar ?? DEFAULT_BAR;
        if (last.dock) useFolium.getState().setApp({ bar: { ...cur, docked: true } });
        else {
          const p = clampBar(last.left, last.top, d.w, d.h, window.innerWidth, window.innerHeight, HEADER_H);
          useFolium.getState().setApp({ bar: toBarPos(p.left, p.top, d.w, window.innerWidth, window.innerHeight) });
        }
      }
      setLive(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const grip = (
    <span className="fx-fbar__grip" title={t('bar.move')} aria-label={t('bar.move')} role="separator" onPointerDown={down}>
      <GripVertical size={14} />
    </span>
  );
  const side: Side = live ? (live.top < window.innerHeight / 2 ? 'below' : 'above') : popoverSide(pos);

  // agganciata (e non in trascinamento): dentro la barra in alto
  if (pos.docked && !live && dockEl)
    return createPortal(
      <div ref={box} className="fx-fbar is-docked" role="toolbar" aria-label={t('bar.text')}>
        <ToolbarContent side={side} grip={grip} />
      </div>,
      dockEl,
    );

  const w = size.w || box.current?.offsetWidth || 640;
  const h = size.h || box.current?.offsetHeight || 36;
  const at = live ?? fromBarPos(pos, w, h, window.innerWidth, window.innerHeight, HEADER_H);
  return (
    <>
      {live?.dock && <div className="fx-dock-hint" aria-hidden />}
      <div ref={box} className={`fx-fbar is-free ${live ? 'is-dragging' : ''}`} style={{ left: at.left, top: at.top }} role="toolbar" aria-label={t('bar.text')}>
        <ToolbarContent side={side} grip={grip} />
      </div>
    </>
  );
}
