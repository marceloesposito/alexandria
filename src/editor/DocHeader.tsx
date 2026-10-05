// Header della pergamena: tipo e proprietà, modificabili sul posto. Compare nella vista senza bordi e,
// se l'autore lo chiede, anche in pagina e nell'export (impostazioni in DocSettings.header).
import { useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { useDocSettings } from '../layout/docSettings';
import { useTypes } from '../types/store';
import { TypeIcon, TypeSelect, PropField } from '../types/ui';
import { type HeaderSettings, type PropValue, typeById } from '../types/model';
import { Popover } from '../components/Popover';
import { useWorkspace } from '../state/workspace';
import { t, useLang } from '../i18n';

export function DocHeader({ borderless }: { borderless: boolean }) {
  useLang();
  const settings = useDocSettings((s) => s.settings);
  const types = useTypes((s) => s.types);
  const [open, setOpen] = useState(false);
  const gear = useRef<HTMLButtonElement>(null);
  const h = settings.header;
  if (borderless ? !h.borderless : !h.paged) return null;
  const obj = settings.object;
  const type = typeById(types, obj.type);
  const update = useDocSettings.getState().update;
  const setProp = (k: string, v: PropValue) => update({ object: { ...obj, props: { ...obj.props, [k]: v } } });
  const setHeader = (patch: Partial<HeaderSettings>) => update({ header: { ...h, ...patch } });
  const shown = (key: string) => !h.fields.length || h.fields.includes(key);
  const props = type ? type.properties.filter((d) => shown(d.key)) : [];

  return (
    <header className={`doc-header doc-header--${h.layout} ${h.align === 'center' ? 'is-center' : ''} ${type ? '' : 'is-empty'}`} contentEditable={false}>
      <div className="doc-header__type">
        {type && <TypeIcon icon={type.icon} color={type.color} />}
        <TypeSelect target="doc" value={obj.type} onChange={(id) => update({ object: { ...obj, type: id } })} className="doc-header__type-select" />
        <span className="grow" />
        <button ref={gear} className="icon-btn tiny" title={t('header.settings')} onClick={() => setOpen(!open)}>
          <Settings2 size={13} />
        </button>
      </div>
      {props.length > 0 && (
        <div className="doc-header__props">
          {props.map((d) => (
            <label key={d.key} className="doc-header__prop">
              <span className="doc-header__label">{d.label}</span>
              <PropField def={d} value={obj.props[d.key]} onChange={(v) => setProp(d.key, v)} compact />
            </label>
          ))}
        </div>
      )}
      <Popover anchor={gear.current} open={open} onClose={() => setOpen(false)} placement="below">
        <div className="popover__form header-settings">
          <span className="field-label">{t('header.where')}</span>
          <label className="check">
            <input type="checkbox" checked={h.borderless} onChange={(e) => setHeader({ borderless: e.target.checked })} /> {t('header.inBorderless')}
          </label>
          <label className="check">
            <input type="checkbox" checked={h.paged} onChange={(e) => setHeader({ paged: e.target.checked })} /> {t('header.inPaged')}
          </label>
          <label className="check">
            <input type="checkbox" checked={h.export} onChange={(e) => setHeader({ export: e.target.checked })} /> {t('header.inExport')}
          </label>
          <span className="field-label">{t('header.layout')}</span>
          <div className="seg-row">
            {(['line', 'table', 'block'] as const).map((l) => (
              <button key={l} className={`seg ${h.layout === l ? 'is-active' : ''}`} onClick={() => setHeader({ layout: l })}>
                {t(`header.layout.${l}`)}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={h.align === 'center'} onChange={(e) => setHeader({ align: e.target.checked ? 'center' : 'left' })} /> {t('header.center')}
          </label>
          <span className="field-label">{t('header.fields')}</span>
          {[
            { key: '@type', label: t('types.type') },
            { key: '@author', label: t('header.author') },
            { key: '@date', label: t('header.date') },
            ...(type?.properties.map((d) => ({ key: d.key, label: d.label })) ?? []),
          ].map((f) => {
            const all = ['@type', ...(type?.properties.map((d) => d.key) ?? [])];
            const current = h.fields.length ? h.fields : all;
            return (
              <label key={f.key} className="check">
                <input
                  type="checkbox"
                  checked={current.includes(f.key)}
                  onChange={(e) => setHeader({ fields: e.target.checked ? [...current, f.key] : current.filter((x) => x !== f.key) })}
                />{' '}
                {f.label}
              </label>
            );
          })}
          <p className="hint">{t('header.fieldsHint')}</p>
          <button
            className="btn small"
            onClick={() => {
              setOpen(false);
              useWorkspace.getState().openDialog('types');
            }}
          >
            {t('types.manage')}
          </button>
        </div>
      </Popover>
    </header>
  );
}
