// Gestione dei tipi di oggetto: nome, icona, colore, a cosa si applicano e proprietà.
import { useState } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWorkspace } from '../state/workspace';
import { useTypes } from './store';
import { type ObjectType, type PropDef, type PropKind, TYPE_ICONS, PROP_KINDS, builtInTypes, propKey } from './model';
import { TypeIcon } from './ui';
import { confirmDialog } from '../components/confirm';
import { t, getLang, useLang } from '../i18n';

const COLORS = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);

export function TypesDialog() {
  useLang();
  const close = () => useWorkspace.getState().closeDialog();
  const [types, setTypes] = useState<ObjectType[]>(() => structuredClone(useTypes.getState().types));
  const [sel, setSel] = useState<string | null>(types[0]?.id ?? null);
  const cur = types.find((x) => x.id === sel) ?? null;
  const edit = (patch: Partial<ObjectType>) => setTypes(types.map((x) => (x.id === sel ? { ...x, ...patch } : x)));
  const editProp = (i: number, patch: Partial<PropDef>) => cur && edit({ properties: cur.properties.map((p, k) => (k === i ? { ...p, ...patch } : p)) });

  const addType = () => {
    const id = propKey(t('types.newType'), types.map((x) => x.id));
    setTypes([...types, { id, name: t('types.newType'), icon: 'file', color: COLORS[types.length % 8], appliesTo: ['doc'], properties: [] }]);
    setSel(id);
  };

  return (
    <Modal
      title={t('types.title')}
      onClose={close}
      size="large"
      footer={
        <>
          <button
            className="btn"
            title={t('types.resetHint')}
            onClick={async () => {
              if (await confirmDialog(t('types.reset'), t('types.resetHint'))) {
                const b = builtInTypes(getLang());
                setTypes([...b, ...types.filter((x) => !b.some((y) => y.id === x.id))]);
              }
            }}
          >
            <RotateCcw size={13} /> {t('types.reset')}
          </button>
          <span className="grow" />
          <button className="btn" onClick={close}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn--primary"
            onClick={async () => {
              await useTypes.getState().save(types);
              close();
            }}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="types-dlg">
        <ul className="types-dlg__list">
          {types.map((ty) => (
            <li key={ty.id} className={ty.id === sel ? 'is-active' : ''} onClick={() => setSel(ty.id)}>
              <TypeIcon icon={ty.icon} color={ty.color} /> {ty.name}
            </li>
          ))}
          <li className="types-dlg__add" onClick={addType}>
            <Plus size={13} /> {t('types.add')}
          </li>
        </ul>
        {cur ? (
          <div className="types-dlg__edit">
            <div className="form__grid2">
              <label className="form__stack">
                <span className="field-label">{t('types.name')}</span>
                <input className="input" value={cur.name} onChange={(e) => edit({ name: e.target.value })} />
              </label>
              <div className="form__stack">
                <span className="field-label">{t('types.appliesTo')}</span>
                <div className="forge__row">
                  {(['doc', 'resource'] as const).map((a) => (
                    <label key={a} className="check">
                      <input
                        type="checkbox"
                        checked={cur.appliesTo.includes(a)}
                        onChange={(e) => edit({ appliesTo: e.target.checked ? [...cur.appliesTo, a] : cur.appliesTo.filter((x) => x !== a) })}
                      />{' '}
                      {t(`types.target.${a}`)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <span className="field-label">{t('types.icon')}</span>
            <div className="types-dlg__icons">
              {TYPE_ICONS.map((i) => (
                <button key={i} className={`icon-btn ${cur.icon === i ? 'is-active' : ''}`} onClick={() => edit({ icon: i })} aria-label={i}>
                  <TypeIcon icon={i} size={15} color={cur.icon === i ? cur.color : undefined} />
                </button>
              ))}
              <span className="types-dlg__sep" />
              {COLORS.map((c) => (
                <button key={c} className={`types-dlg__color ${cur.color === c ? 'is-active' : ''}`} style={{ background: c }} onClick={() => edit({ color: c })} aria-label={c} />
              ))}
            </div>
            <span className="field-label">{t('types.properties')}</span>
            <div className="types-dlg__props">
              {cur.properties.map((p, i) => (
                <div key={p.key} className="types-dlg__prop">
                  <input className="input" value={p.label} onChange={(e) => editProp(i, { label: e.target.value })} aria-label={t('types.propName')} />
                  <select className="select" value={p.kind} onChange={(e) => editProp(i, { kind: e.target.value as PropKind })} aria-label={t('types.propKind')}>
                    {PROP_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`types.kind.${k}`)}
                      </option>
                    ))}
                  </select>
                  {p.kind === 'select' || p.kind === 'multi' ? (
                    <input
                      className="input"
                      defaultValue={(p.options ?? []).join(', ')}
                      placeholder={t('types.optionsHint')}
                      onBlur={(e) => editProp(i, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
                    />
                  ) : (
                    <span />
                  )}
                  <button className="icon-btn" title={t('common.delete')} onClick={() => edit({ properties: cur.properties.filter((_, k) => k !== i) })}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button
                className="btn small"
                onClick={() => edit({ properties: [...cur.properties, { key: propKey(t('types.newProp'), cur.properties.map((x) => x.key)), label: t('types.newProp'), kind: 'text' }] })}
              >
                <Plus size={13} /> {t('types.addProp')}
              </button>
            </div>
            <p className="hint">{t('types.hint')}</p>
            <button
              className="btn small btn--danger-ghost"
              onClick={() => {
                setTypes(types.filter((x) => x.id !== cur.id));
                setSel(types.find((x) => x.id !== cur.id)?.id ?? null);
              }}
            >
              <Trash2 size={13} /> {t('types.delete')}
            </button>
          </div>
        ) : (
          <p className="hint">{t('types.empty')}</p>
        )}
      </div>
    </Modal>
  );
}
