// Ispettore di una risorsa: metadati bibliografici modificabili, fonte e chiave di citazione,
// tag, layer, pin; apertura nel visualizzatore.
import { useEffect, useState } from 'react';
import { PanelRight, X, BookOpen, ExternalLink, Trash2, Search, Library, Copy, Pin as PinIcon, Quote } from 'lucide-react';
import { removeWithConfirm } from './remove';
import { useResources } from '../store';
import { type Resource, type CslItem, authorsOf, yearOf } from '../model';
import { KindIcon, kindLabel, thumbUrl } from './common';
import { t, useLang } from '../../i18n';
import { platform } from '../../platform';
import { lookupDoi, lookupIsbn, addFromLibrary, sendToLibrary } from '../importer';
import { parseName } from '../html';
import { useWorkspace } from '../../state/workspace';
import { useSidePane } from '../../editor/paneStore';
import { TypeSelect, PropField, TypeIcon, useType } from '../../types/ui';
import { emptyObject } from '../../types/model';

const CSL_TYPES = ['book', 'article', 'chapter', 'article-journal', 'article-magazine', 'article-newspaper', 'paper-conference', 'thesis', 'report', 'webpage', 'post-weblog', 'motion_picture', 'graphic', 'document', 'entry-encyclopedia', 'manuscript', 'interview', 'legislation'];

export function Inspector({ id }: { id: string }) {
  useLang();
  const r = useResources((s) => s.get(id));
  const layers = useResources((s) => s.layers);
  const scope = useResources((s) => s.scope);
  const st = useResources.getState();
  if (!r) return null;
  const inLibrary = scope === 'library';
  const thumb = thumbUrl(r);

  return (
    <aside className="inspector">
      <header className="inspector__head">
        <KindIcon kind={r.kind} size={16} />
        <span className="inspector__kind">{kindLabel(r.kind)}</span>
        <span className="grow" />
        <button className="icon-btn" title={t('common.close')} onClick={() => st.openInspector(null)}>
          <X size={15} />
        </button>
      </header>
      {thumb && <img className="inspector__thumb" src={thumb} alt="" />}
      <div className="inspector__actions">
        <button className="btn small" onClick={() => st.openViewer(r.id)}>
          <BookOpen size={13} /> {t('res.open')}
        </button>
        <button
          className="btn small"
          onClick={() => {
            useWorkspace.getState().setView('editor');
            useSidePane.getState().open({ kind: 'resource', id: r.id });
          }}
        >
          <PanelRight size={13} /> {t('pane.openAside')}
        </button>
        {r.url && (
          <button className="btn small" onClick={() => void platform.openExternal(r.url!)}>
            <ExternalLink size={13} /> {t('res.openBrowser')}
          </button>
        )}
        {inLibrary ? (
          <>
            <button className="btn small" onClick={() => void addFromLibrary([r.id]).then(() => useWorkspace.getState().toast(t('library.added'), 'ok'))}>
              <Library size={13} /> {t('library.addToVault')}
            </button>
            <button className="btn small" onClick={() => void addFromLibrary([r.id], true).then(() => useWorkspace.getState().toast(t('library.copied'), 'ok'))}>
              <Copy size={13} /> {t('library.copyToVault')}
            </button>
          </>
        ) : (
          !r.library && (
            <button className="btn small" onClick={() => void sendToLibrary([r.id])}>
              <Library size={13} /> {t('library.send')}
            </button>
          )
        )}
      </div>

      <section className="inspector__section">
        <label className="check inspector__source">
          <input type="checkbox" checked={r.isSource} onChange={(e) => void st.setSource(r.id, e.target.checked)} />
          <Quote size={13} /> {t('res.markSource')}
        </label>
        {r.isSource && <CiteKeyField r={r} />}
      </section>

      <MetaEditor r={r} />
      <TagsField r={r} />
      <ObjectSection r={r} />

      {!inLibrary && layers.some((l) => l.kind === 'group') && (
        <section className="inspector__section">
          <h4>{t('layers.title')}</h4>
          {layers
            .filter((l) => l.kind === 'group')
            .map((l) => (
              <label key={l.id} className="check">
                <input type="checkbox" checked={r.layers.includes(l.id)} onChange={(e) => void st.assignLayer([r.id], l.id, e.target.checked)} />
                <span className="layer-dot" style={{ background: l.color }} /> {l.name}
              </label>
            ))}
        </section>
      )}

      {r.pins.length > 0 && (
        <section className="inspector__section">
          <h4>
            <PinIcon size={12} /> {t('res.pinsTitle')}
          </h4>
          {r.pins.map((p) => (
            <div key={p.id} className="pin-row" onClick={() => st.openViewer(r.id, p.id)}>
              <span className="pin-row__loc">{p.locator ?? '—'}</span>
              <span className="pin-row__label">{p.label}</span>
              <button
                className="icon-btn tiny"
                onClick={(e) => {
                  e.stopPropagation();
                  void st.removePin(r.id, p.id);
                }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </section>
      )}

      <footer className="inspector__foot">
        <button
          className="btn small btn--danger-ghost"
          onClick={() => void removeWithConfirm([r.id])}
        >
          <Trash2 size={13} /> {t('common.delete')}
        </button>
      </footer>
    </aside>
  );
}

function CiteKeyField({ r }: { r: Resource }) {
  const [v, setV] = useState(r.citeKey ?? '');
  useEffect(() => setV(r.citeKey ?? ''), [r.citeKey]);
  const vaultItems = useResources((s) => s.resources);
  const libItems = useResources((s) => s.libraryItems);
  const clash = v && [...vaultItems, ...libItems].some((x) => x.id !== r.id && x.citeKey === v);
  return (
    <label className="form__stack">
      <span className="field-label">{t('res.citeKey')}</span>
      <input
        className={`input mono ${clash ? 'is-invalid' : ''}`}
        value={v}
        onChange={(e) => setV(e.target.value.replace(/[^\p{L}\p{N}_:.-]/gu, ''))}
        onBlur={() => !clash && v && v !== r.citeKey && void useResources.getState().update(r.id, { citeKey: v })}
      />
      {clash && <span className="hint is-bad">{t('res.citeKeyClash')}</span>}
    </label>
  );
}

function authorsText(c: CslItem | null): string {
  return (c?.author ?? []).map((a) => a.literal ?? [a.family, a.given].filter(Boolean).join(', ')).join('; ');
}

function MetaEditor({ r }: { r: Resource }) {
  const [c, setC] = useState<CslItem>(r.csl ?? {});
  const [authors, setAuthors] = useState(authorsText(r.csl));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setC(r.csl ?? {});
    setAuthors(authorsText(r.csl));
  }, [r.csl, r.id]);
  const commit = (next: CslItem) => void useResources.getState().setCsl(r.id, next);
  const field = (key: keyof CslItem & string, label: string) => (
    <label className="form__stack" key={key}>
      <span className="field-label">{label}</span>
      <input
        className="input"
        value={String(c[key] ?? '')}
        onChange={(e) => setC({ ...c, [key]: e.target.value })}
        onBlur={() => commit(c)}
      />
    </label>
  );
  const year = yearOf(r);
  return (
    <section className="inspector__section">
      <h4>{t('res.metadata')}</h4>
      {field('title', t('meta.title'))}
      <label className="form__stack">
        <span className="field-label">{t('meta.authors')}</span>
        <input
          className="input"
          value={authors}
          placeholder={t('meta.authorsHint')}
          onChange={(e) => setAuthors(e.target.value)}
          onBlur={() => {
            const list = authors.split(';').map((a) => a.trim()).filter(Boolean).map(parseName);
            const next = { ...c, author: list };
            setC(next);
            commit(next);
          }}
        />
      </label>
      <div className="form__grid2">
        <label className="form__stack">
          <span className="field-label">{t('meta.year')}</span>
          <input
            className="input"
            defaultValue={year ?? ''}
            key={`${r.id}-${year}`}
            onBlur={(e) => {
              const y = parseInt(e.target.value, 10);
              const next = { ...c, issued: Number.isNaN(y) ? undefined : { 'date-parts': [[y]] } };
              setC(next);
              commit(next);
            }}
          />
        </label>
        <label className="form__stack">
          <span className="field-label">{t('meta.type')}</span>
          <select
            className="select"
            value={c.type ?? 'document'}
            onChange={(e) => {
              const next = { ...c, type: e.target.value };
              setC(next);
              commit(next);
            }}
          >
            {CSL_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`csl.type.${x}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {field('container-title', t('meta.container'))}
      <div className="form__grid2">
        {field('publisher', t('meta.publisher'))}
        {field('publisher-place', t('meta.place'))}
      </div>
      <div className="form__grid2">
        {field('volume', t('meta.volume'))}
        {field('page', t('meta.pages'))}
      </div>
      <div className="form__grid2">
        {field('DOI', 'DOI')}
        {field('ISBN', 'ISBN')}
      </div>
      {field('URL', 'URL')}
      {(c.DOI || c.ISBN) && (
        <button
          className="btn small"
          disabled={busy}
          title={t('meta.lookupHint')}
          onClick={async () => {
            setBusy(true);
            const found = c.DOI ? await lookupDoi(c.DOI) : await lookupIsbn(String(c.ISBN));
            setBusy(false);
            if (!found) {
              useWorkspace.getState().toast(t('meta.lookupNone'), 'info');
              return;
            }
            const next = { ...c, ...found };
            setC(next);
            setAuthors(authorsText(next));
            commit(next);
            useWorkspace.getState().toast(t('meta.lookupDone'), 'ok');
          }}
        >
          <Search size={13} /> {busy ? t('meta.lookingUp') : t('meta.lookup')}
        </button>
      )}
      {authorsOf(r).length === 0 && !r.csl?.title && <p className="hint">{t('meta.empty')}</p>}
    </section>
  );
}

function TagsField({ r }: { r: Resource }) {
  const [v, setV] = useState('');
  const st = useResources.getState();
  return (
    <section className="inspector__section">
      <h4>{t('res.tags')}</h4>
      <div className="tags">
        {r.tags.map((tag) => (
          <span key={tag} className="chip chip--removable">
            #{tag}
            <button onClick={() => void st.setTags(r.id, r.tags.filter((x) => x !== tag))} aria-label={t('common.delete')}>
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          className="tags__input"
          placeholder={t('res.addTag')}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && v.trim()) {
              e.preventDefault();
              void st.setTags(r.id, [...r.tags, v.trim().replace(/^#/, '')]);
              setV('');
            }
          }}
        />
      </div>
    </section>
  );
}

/** Tipo di oggetto e proprietà della risorsa (Personaggio, Luogo, Intervista...). */
function ObjectSection({ r }: { r: Resource }) {
  const obj = r.object ?? emptyObject();
  const type = useType(obj.type);
  const st = useResources.getState();
  return (
    <section className="inspector__section">
      <h4>
        {type && <TypeIcon icon={type.icon} color={type.color} />} {t('types.type')}
      </h4>
      <TypeSelect target="resource" value={obj.type} onChange={(id) => void st.update(r.id, { object: { ...obj, type: id } })} />
      {type?.properties.map((d) => (
        <label key={d.key} className="form__stack">
          <span className="field-label">{d.label}</span>
          <PropField def={d} value={obj.props[d.key]} onChange={(v) => void st.update(r.id, { object: { ...obj, props: { ...obj.props, [d.key]: v } } })} />
        </label>
      ))}
    </section>
  );
}
