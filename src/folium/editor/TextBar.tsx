// Barretta dello Scriptorium: Stile ▾ | B I U S | Colore ▾ | + ▾ | ⏱ | parole.
import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Bold, Italic, Underline, Strikethrough, Baseline, Plus, ChevronDown, Minus, RotateCcw } from 'lucide-react';
import { TEXT_COLORS, HIGHLIGHT_COLORS, type TextColor, type HighlightColor } from 'logos/doc/colors';
import { FloatingBar, BarSep, CmdButton } from '../FloatingBar';
import { Popover } from '../../components/Popover';
import { useUi } from '../ui';
import { useEditorRef } from './editorRef';
import { useCounts } from './counts';
import { useFolium } from '../store';
import { insertItems } from './insertItems';
import { TimerChip } from '../timer/TimerChip';
import { runCommand } from '../commands';
import { t, useLang } from '../../i18n';
import type { SheetFont } from '../format';

const STYLE_IDS = ['p', 'h1', 'h2', 'h3', 'quote', 'code'];

function currentStyle(e: Editor): string {
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

function CountsPopover() {
  const c = useCounts((s) => s.doc);
  const sel = useCounts((s) => s.selection);
  const zoom = useFolium((s) => s.app.zoom);
  return (
    <div className="fx-menu fx-counts">
      <dl>
        <dt>{t('counts.words')}</dt>
        <dd>{c?.words ?? 0}</dd>
        <dt>{t('counts.chars')}</dt>
        <dd>{c?.chars ?? 0}</dd>
        <dt>{t('counts.charsNoSpaces')}</dt>
        <dd>{c?.charsNoSpaces ?? 0}</dd>
        <dt>{t('counts.paragraphs')}</dt>
        <dd>{c?.paragraphs ?? 0}</dd>
        <dt>{t('counts.reading')}</dt>
        <dd>{t('counts.minutes', { n: c?.readingMinutes ?? 0 })}</dd>
        {sel && (
          <>
            <dt>{t('counts.selection')}</dt>
            <dd>{t('counts.selectionValue', { words: sel.words, chars: sel.chars })}</dd>
          </>
        )}
      </dl>
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

export function TextBar({ editor, faded }: { editor: Editor; faded: boolean }) {
  useLang();
  useEditorRef((s) => s.tick);
  const popover = useUi((s) => s.popover);
  const words = useCounts((s) => s.selection?.words ?? s.doc?.words ?? 0);
  const hasSel = useCounts((s) => !!s.selection);
  const refs = {
    style: useRef<HTMLButtonElement>(null),
    color: useRef<HTMLButtonElement>(null),
    insert: useRef<HTMLButtonElement>(null),
    counts: useRef<HTMLButtonElement>(null),
  };
  const close = () => useUi.getState().close();
  return (
    <FloatingBar faded={faded} label={t('bar.text')}>
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
      <TimerChip />
      <BarSep />
      <CmdButton id="counts.open" ref={refs.counts} className="fx-btn--text" pressed={popover === 'counts'}>
        <span className="fx-btn__label">{t(hasSel ? 'bar.wordsSelected' : 'bar.words', { n: words })}</span>
      </CmdButton>
      <Popover anchor={refs.style.current} open={popover === 'style'} onClose={close} placement="above">
        <StylePopover editor={editor} />
      </Popover>
      <Popover anchor={refs.color.current} open={popover === 'color'} onClose={close} placement="above">
        <ColorPopover editor={editor} />
      </Popover>
      <Popover anchor={refs.insert.current} open={popover === 'insert'} onClose={close} placement="above">
        <InsertPopover editor={editor} />
      </Popover>
      <Popover anchor={refs.counts.current} open={popover === 'counts'} onClose={close} placement="above">
        <CountsPopover />
      </Popover>
    </FloatingBar>
  );
}
