// Pannello dell'aspetto di un riquadro evidenziato: tipo (predefiniti e tipi propri del Compendium),
// colore e icona del singolo riquadro, e "salva come tipo" per riusare la combinazione.
import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { t } from '../i18n';
import { confirmDialog } from '../components/confirm';
import {
  CALLOUT_COLORS,
  CALLOUT_ICONS,
  CALLOUT_OFFERED,
  CALLOUT_BUILTIN,
  calloutTypeId,
  isCalloutKind,
  type CalloutColor,
  type CalloutIcon,
  type ResolvedCallout,
} from 'logos/doc/callouts';
import { useCalloutTypes } from '../callouts/store';
import { CALLOUT_ICON_COMPONENTS } from './calloutIcons';

export interface CalloutAttrs {
  kind: string;
  color: string;
  icon: string;
}

interface Props {
  /** aspetto attuale (gia' risolto) e attributi propri del riquadro */
  look: ResolvedCallout;
  attrs: CalloutAttrs;
  onChange(attrs: Partial<CalloutAttrs>): void;
}

export function CalloutPicker({ look, attrs, onChange }: Props) {
  const types = useCalloutTypes((s) => s.types);
  const [name, setName] = useState('');
  // i predefiniti proposti, piu' quello del riquadro se e' uno dei vecchi (Suggerimento, Attenzione)
  const builtins = CALLOUT_OFFERED.includes(look.kind as never) || !isCalloutKind(look.kind) ? CALLOUT_OFFERED : [...CALLOUT_OFFERED, look.kind];

  const saveType = () => {
    const label = name.trim();
    if (!label) return;
    const id = calloutTypeId(label, types.map((x) => x.id));
    void useCalloutTypes.getState().save([...types, { id, label, color: look.color, icon: look.icon }]);
    onChange({ kind: id, color: '', icon: '' });
    setName('');
  };

  const removeType = async (id: string, label: string) => {
    if (!(await confirmDialog(t('callout.deleteConfirm', { name: label }), t('callout.deleteConfirmMsg'), { danger: true, okLabel: t('common.delete') }))) return;
    void useCalloutTypes.getState().save(types.filter((x) => x.id !== id));
  };

  const Row = ({ id, label, color, icon, own }: { id: string; label: string; color: CalloutColor; icon: CalloutIcon; own: boolean }) => {
    const Icon = CALLOUT_ICON_COMPONENTS[icon];
    return (
      <div className={`callout-pick__type ${look.kind === id ? 'is-on' : ''}`} style={{ '--callout': `var(--${color})` } as React.CSSProperties}>
        <button className="callout-pick__type-main" onClick={() => onChange({ kind: id, color: '', icon: '' })}>
          <Icon size={14} />
          <span>{label}</span>
          {look.kind === id && <Check size={13} className="callout-pick__check" />}
        </button>
        {own && (
          <button className="icon-btn small" title={t('callout.deleteType')} aria-label={t('callout.deleteType')} onClick={() => void removeType(id, label)}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="callout-pick">
      <div className="callout-pick__label">{t('callout.types')}</div>
      <div className="callout-pick__types">
        {builtins.map((k) => (
          <Row key={k} id={k} label={t(`callout.${k}`)} color={CALLOUT_BUILTIN[k].color} icon={CALLOUT_BUILTIN[k].icon} own={false} />
        ))}
        {types.map((x) => (
          <Row key={x.id} id={x.id} label={x.label} color={x.color} icon={x.icon} own />
        ))}
      </div>

      <div className="callout-pick__label">{t('callout.color')}</div>
      <div className="callout-pick__swatches">
        {CALLOUT_COLORS.map((c, i) => (
          <button
            key={c}
            className={`callout-pick__swatch ${look.color === c ? 'is-on' : ''}`}
            style={{ background: `var(--${c})` }}
            title={t('callout.colorN', { n: i + 1 })}
            aria-label={t('callout.colorN', { n: i + 1 })}
            aria-pressed={look.color === c}
            onClick={() => onChange({ color: c })}
          />
        ))}
        {attrs.color && (
          <button className="btn small" onClick={() => onChange({ color: '' })}>
            {t('callout.fromType')}
          </button>
        )}
      </div>

      <div className="callout-pick__label">{t('callout.icon')}</div>
      <div className="callout-pick__icons">
        {CALLOUT_ICONS.map((name) => {
          const Icon = CALLOUT_ICON_COMPONENTS[name];
          return (
            <button key={name} className={`icon-btn small ${look.icon === name ? 'is-on' : ''}`} title={name} aria-label={name} aria-pressed={look.icon === name} onClick={() => onChange({ icon: name })}>
              <Icon size={15} />
            </button>
          );
        })}
      </div>
      {attrs.icon && (
        <button className="btn small callout-pick__reset" onClick={() => onChange({ icon: '' })}>
          {t('callout.fromType')}
        </button>
      )}

      <div className="callout-pick__label">{t('callout.newType')}</div>
      <form
        className="callout-pick__new"
        onSubmit={(e) => {
          e.preventDefault();
          saveType();
        }}
      >
        <input className="input" value={name} placeholder={t('callout.newTypeName')} onChange={(e) => setName(e.target.value)} />
        <button className="btn small" type="submit" disabled={!name.trim()}>
          {t('callout.saveType')}
        </button>
      </form>
    </div>
  );
}
