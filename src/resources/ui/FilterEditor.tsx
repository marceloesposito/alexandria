// Editor dei filtri di proprieta' (come i filtri dei layer di AutoCAD): condizioni su tag, tipo,
// anno, autore, titolo, sito, testo, fonte; tutte o almeno una.
import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { type Condition, type FilterRule, type Layer, type FilterField, type FilterOp, matchRule } from '../model';
import { useResources } from '../store';
import { t } from '../../i18n';

const FIELDS: FilterField[] = ['tag', 'kind', 'year', 'author', 'title', 'domain', 'text', 'source', 'pinned'];
const OPS: Record<FilterField, FilterOp[]> = {
  tag: ['is', 'contains', 'not'],
  kind: ['is', 'not'],
  year: ['is', 'gte', 'lte'],
  author: ['is', 'contains', 'not'],
  title: ['contains', 'not'],
  domain: ['is', 'contains', 'not'],
  text: ['contains', 'not'],
  source: ['is'],
  pinned: ['is'],
};
const KINDS = ['pdf', 'text', 'markdown', 'rtf', 'docx', 'odt', 'epub', 'html', 'image', 'web', 'youtube', 'video', 'audio', 'reference', 'snippet', 'other'];

export function FilterEditor({ initial, onClose, onSave }: { initial?: Layer; onClose: () => void; onSave: (name: string, rule: FilterRule) => void }) {
  const [name, setName] = useState(initial?.name ?? t('filter.defaultName'));
  const [match, setMatch] = useState<FilterRule['match']>(initial?.rule?.match ?? 'all');
  const [conds, setConds] = useState<Condition[]>(initial?.rule?.conditions ?? [{ field: 'tag', op: 'is', value: '' }]);
  const resources = useResources((s) => (s.scope === 'vault' ? s.resources : s.libraryItems));
  const texts = useResources((s) => s.texts);
  const rule: FilterRule = { match, conditions: conds.filter((c) => c.value.trim() || c.field === 'source' || c.field === 'pinned') };
  const count = useMemo(() => resources.filter((r) => matchRule(r, rule, texts.get(r.id))).length, [resources, texts, rule]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (i: number, patch: Partial<Condition>) => setConds(conds.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <Modal
      title={initial ? t('filter.edit') : t('filter.new')}
      onClose={onClose}
      footer={
        <>
          <span className="hint">{t('filter.matches', { n: count })}</span>
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn--primary" disabled={!name.trim() || !rule.conditions.length} onClick={() => onSave(name.trim(), rule)}>
            {t('common.ok')}
          </button>
        </>
      }
    >
      <div className="form">
        <label className="form__row">
          <span>{t('filter.name')}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="form__row">
          <span>{t('filter.match')}</span>
          <select className="select" value={match} onChange={(e) => setMatch(e.target.value as FilterRule['match'])}>
            <option value="all">{t('filter.all')}</option>
            <option value="any">{t('filter.any')}</option>
          </select>
        </label>
        {conds.map((c, i) => (
          <div key={i} className="filter-cond">
            <select className="select" value={c.field} onChange={(e) => set(i, { field: e.target.value as FilterField, op: OPS[e.target.value as FilterField][0], value: '' })}>
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {t(`filter.field.${f}`)}
                </option>
              ))}
            </select>
            <select className="select" value={c.op} onChange={(e) => set(i, { op: e.target.value as FilterOp })}>
              {OPS[c.field].map((o) => (
                <option key={o} value={o}>
                  {t(`filter.op.${o}`)}
                </option>
              ))}
            </select>
            {c.field === 'kind' ? (
              <select className="select" value={c.value} onChange={(e) => set(i, { value: e.target.value })}>
                <option value="" />
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`kind.${k}`)}
                  </option>
                ))}
              </select>
            ) : c.field === 'source' ? (
              <select className="select" value={c.value || 'true'} onChange={(e) => set(i, { value: e.target.value })}>
                <option value="true">{t('filter.yes')}</option>
                <option value="false">{t('filter.no')}</option>
              </select>
            ) : c.field === 'pinned' ? (
              <span className="hint">{t('filter.hasPins')}</span>
            ) : (
              <input className="input" value={c.value} onChange={(e) => set(i, { value: e.target.value })} />
            )}
            <button className="icon-btn" onClick={() => setConds(conds.filter((_, j) => j !== i))} title={t('common.delete')}>
              <X size={14} />
            </button>
          </div>
        ))}
        <button className="btn small" onClick={() => setConds([...conds, { field: 'tag', op: 'is', value: '' }])}>
          <Plus size={13} /> {t('filter.addCondition')}
        </button>
      </div>
    </Modal>
  );
}
