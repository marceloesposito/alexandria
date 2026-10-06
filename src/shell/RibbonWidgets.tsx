// Controlli speciali del ribbon (menu a tendina, ecc.). I moduli registrano i propri.
import type { ComponentType } from 'react';
import { getEditor } from '../state/editorRef';
import { t } from '../i18n';
import { useCommandTick } from './useCommands';
import type { RibbonSize } from '../state/prefs';

type Widget = ComponentType<{ size: RibbonSize }>;
const widgets = new Map<string, Widget>();

export function registerWidget(id: string, w: Widget) {
  widgets.set(id, w);
}

export function RibbonWidget({ id, size }: { id: string; size: RibbonSize }) {
  const W = widgets.get(id);
  return W ? <W size={size} /> : null;
}

function currentBlock(): string {
  const e = getEditor();
  if (!e) return 'p';
  for (let l = 1; l <= 6; l++) if (e.isActive('heading', { level: l })) return `h${l}`;
  if (e.isActive('blockquote')) return 'quote';
  if (e.isActive('codeBlock')) return 'code';
  if (e.isActive('paragraph', { textStyle: 'caption' })) return 'caption';
  return 'p';
}

function BlockStyle({ size }: { size: RibbonSize }) {
  useCommandTick();
  const value = currentBlock();
  return (
    <label className={`ribbon__widget ribbon__widget--${size}`}>
      <select
        className="select"
        value={value}
        title={t('cmd.fmt.blockStyle')}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(ev) => {
          const e = getEditor();
          if (!e) return;
          const v = ev.target.value;
          const c = e.chain().focus();
          if (v === 'p') c.setParagraph().updateAttributes('paragraph', { textStyle: null }).run();
          else if (v === 'caption') c.setParagraph().updateAttributes('paragraph', { textStyle: 'caption' }).run();
          else if (v === 'quote') c.setParagraph().toggleBlockquote().run();
          else if (v === 'code') c.toggleCodeBlock().run();
          else c.setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
        }}
      >
        <option value="p">{t('style.paragraph')}</option>
        {[1, 2, 3, 4, 5, 6].map((l) => (
          <option key={l} value={`h${l}`}>
            {t('style.heading', { n: l })}
          </option>
        ))}
        <option value="caption">{t('style.caption')}</option>
        <option value="quote">{t('style.quote')}</option>
        <option value="code">{t('style.code')}</option>
      </select>
      {size === 'large' && <span className="ribbon__btn-label">{t('cmd.fmt.blockStyle')}</span>}
    </label>
  );
}

registerWidget('blockStyle', BlockStyle);
