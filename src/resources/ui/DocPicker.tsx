// Scelta di pergamene del Compendium (per metterle sulla Tabula o per collegarle fra loro).
import { useMemo, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useWorkspace } from '../../state/workspace';
import { t } from '../../i18n';

interface Props {
  title: string;
  action: string;
  /** pergamene da non proporre (gia' sulla Tabula, la pergamena stessa...) */
  exclude?: string[];
  /** gia' spuntate all'apertura */
  initial?: string[];
  onPick: (rels: string[]) => void;
  onClose: () => void;
}

export function DocPicker({ title, action, exclude = [], initial = [], onPick, onClose }: Props) {
  const docs = useWorkspace((s) => s.docs);
  const active = useWorkspace((s) => s.activeDoc);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set(initial));
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return docs.filter((d) => !exclude.includes(d.rel) && (!k || `${d.title} ${d.folder}`.toLowerCase().includes(k)));
  }, [docs, exclude, q]);
  const toggle = (rel: string) => {
    const n = new Set(sel);
    if (n.has(rel)) n.delete(rel);
    else n.add(rel);
    setSel(n);
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      size="small"
      footer={
        <>
          <span className="hint">{t('docpick.selected', { n: sel.size })}</span>
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn--primary"
            disabled={!sel.size}
            onClick={() => {
              onPick([...sel]);
              onClose();
            }}
          >
            {action}
          </button>
        </>
      }
    >
      <label className="search-field doc-pick__search">
        <Search size={13} />
        <input className="input" autoFocus value={q} placeholder={t('docpick.search')} onChange={(e) => setQ(e.target.value)} />
      </label>
      <ul className="doc-pick">
        {!shown.length && <li className="hint">{t('docpick.none')}</li>}
        {shown.map((d) => (
          <li key={d.rel}>
            <label className={`doc-pick__item ${sel.has(d.rel) ? 'is-on' : ''}`}>
              <input type="checkbox" checked={sel.has(d.rel)} onChange={() => toggle(d.rel)} />
              <ScrollText size={14} />
              <span className="doc-pick__title">{d.title}</span>
              {d.folder && <span className="hint">{d.folder}</span>}
              {d.rel === active && <span className="chip">{t('docpick.active')}</span>}
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
