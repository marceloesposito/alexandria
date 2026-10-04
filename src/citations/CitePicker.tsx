// Inserisci citazione: cerca fra le fonti (titolo, autore, chiave), scegli un pin o scrivi il locator.
import { useMemo, useState } from 'react';
import { Quote, Pin as PinIcon } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWorkspace } from '../state/workspace';
import { useResources } from '../resources/store';
import { displayAuthorYear, authorsOf } from '../resources/model';
import { KindIcon } from '../resources/ui/common';
import { getEditor } from '../state/editorRef';
import { citationRenderer } from './renderer';
import { t } from '../i18n';
import type { CitationItem } from '../doc/types';

export function CitePicker() {
  const close = () => useWorkspace.getState().closeDialog();
  const resources = useResources((s) => s.resources);
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<CitationItem[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [locator, setLocator] = useState('');
  const [prefix, setPrefix] = useState('');

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return resources
      .filter((r) => r.isSource || r.csl?.title)
      .filter((r) => !s || `${r.title} ${authorsOf(r).join(' ')} ${r.citeKey ?? ''} ${displayAuthorYear(r)}`.toLowerCase().includes(s))
      .sort((a, b) => Number(b.isSource) - Number(a.isSource) || a.title.localeCompare(b.title))
      .slice(0, 60);
  }, [resources, q]);

  const cur = resources.find((r) => r.id === current);

  const add = async (id: string, loc?: string) => {
    const st = useResources.getState();
    const r = st.get(id);
    if (!r) return;
    if (!r.isSource || !r.citeKey) await st.setSource(id, true);
    const key = useResources.getState().get(id)?.citeKey;
    if (!key) return;
    const item: CitationItem = { key };
    const l = (loc ?? locator).trim();
    if (l) item.locator = l;
    if (prefix.trim()) item.prefix = prefix.trim();
    setChosen([...chosen.filter((c) => c.key !== key), item]);
    setLocator('');
    setPrefix('');
  };

  const insert = () => {
    const e = getEditor();
    if (e && chosen.length) e.chain().focus().insertCitation(chosen).run();
    close();
  };

  return (
    <Modal
      title={t('cite.pickTitle')}
      onClose={close}
      size="large"
      footer={
        <>
          <span className="cite-preview">{chosen.length ? citationRenderer().label(chosen) : t('cite.pickNone')}</span>
          <span className="grow" />
          <button className="btn" onClick={close}>
            {t('common.cancel')}
          </button>
          <button className="btn btn--primary" disabled={!chosen.length} onClick={insert}>
            <Quote size={14} /> {t('cite.insert')}
          </button>
        </>
      }
    >
      <div className="cite-picker">
        <div className="cite-picker__list">
          <input className="input" autoFocus placeholder={t('cite.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          {!list.length && <p className="hint">{t('cite.noSources')}</p>}
          {list.map((r) => (
            <button key={r.id} className={`cite-picker__item ${current === r.id ? 'is-active' : ''}`} onClick={() => setCurrent(r.id)} onDoubleClick={() => void add(r.id)}>
              <KindIcon kind={r.kind} />
              <span className="cite-picker__title">{r.title}</span>
              <span className="hint">{displayAuthorYear(r)}</span>
              {r.citeKey && <code>@{r.citeKey}</code>}
              {r.pins.length > 0 && (
                <span className="chip">
                  <PinIcon size={10} /> {r.pins.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="cite-picker__detail">
          {cur ? (
            <>
              <h3>{cur.title}</h3>
              <p className="hint">{displayAuthorYear(cur)}</p>
              <div className="form__grid2">
                <label className="form__stack">
                  <span className="field-label">{t('cite.prefix')}</span>
                  <input className="input" placeholder={t('cite.prefixHint')} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
                </label>
                <label className="form__stack">
                  <span className="field-label">{t('cite.locator')}</span>
                  <input className="input" placeholder="p. 12" value={locator} onChange={(e) => setLocator(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add(cur.id)} />
                </label>
              </div>
              <button className="btn" onClick={() => void add(cur.id)}>
                {t('cite.add')}
              </button>
              {cur.pins.length > 0 && (
                <>
                  <h4>{t('res.pinsTitle')}</h4>
                  {cur.pins.map((p) => (
                    <button key={p.id} className="pinned-item" onClick={() => void add(cur.id, p.locator ?? '')}>
                      <span className="pinned-item__loc">{p.locator ?? '·'}</span>
                      <span className="pinned-item__text">{p.quote ? `«${p.quote}»` : p.label}</span>
                    </button>
                  ))}
                </>
              )}
            </>
          ) : (
            <p className="hint">{t('cite.pickHint')}</p>
          )}
          {chosen.length > 0 && (
            <div className="cite-picker__chosen">
              <h4>{t('cite.chosen')}</h4>
              {chosen.map((c) => (
                <div key={c.key} className="chip chip--removable">
                  @{c.key}
                  {c.locator ? `, ${c.locator}` : ''}
                  <button onClick={() => setChosen(chosen.filter((x) => x.key !== c.key))}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
