// Vista "Template e master page": i template (predefiniti e dell'utente) con anteprima della pagina,
// e le master page della pergamena aperta con un'anteprima dal vivo di intestazione e numeri.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FilePlus2, Save, Copy, Trash2, Plus, Paintbrush, LayoutTemplate } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { useDocSettings } from './docSettings';
import { useTemplates, newDocFromTemplate, saveCurrentAsTemplate, applyTemplateLayout } from './templateStore';
import { addMaster, removeMaster, renameMaster, BUILTIN_MASTERS, type LayoutSettings, type MasterId, type MasterPage, type PageNumberPos } from './model';
import { templateFromDoc, type Template } from './templates';
import { promptDialog, confirmDialog } from '../components/confirm';
import { t, useLang } from '../i18n';

export function masterLabel(id: MasterId, m?: MasterPage): string {
  if (m?.name) return m.name;
  return (BUILTIN_MASTERS as readonly string[]).includes(id) ? t(`layout.master.${id}`) : id;
}

const NUMBERING = { '1': '1, 2, 3', i: 'i, ii, iii', I: 'I, II, III', a: 'a, b, c' } as const;

const POSITIONS: PageNumberPos[] = ['none', 'bottom-center', 'bottom-outer', 'top-outer', 'top-center'];

/** Miniatura della pagina: margini, colonne, intestazione e numero della master scelta. */
function PagePreview({ layout, master, width = 120, sample }: { layout: LayoutSettings; master?: MasterPage; width?: number; sample?: boolean }) {
  const m = master ?? layout.masters.body;
  const W = layout.widthMm;
  const H = layout.heightMm;
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const fill = (s: string) => s.replace('{title}', t('tpl.sample.title')).replace('{author}', t('tpl.sample.author')).replace('{chapter}', t('tpl.sample.chapter')).replace('{page}', '7').replace('{pages}', '24').replace('{date}', '2026');
  const num = m.numbering === 'i' ? 'vii' : m.numbering === 'I' ? 'VII' : m.numbering === 'a' ? 'g' : '7';
  return (
    <div className="page-preview" style={{ width, aspectRatio: `${W} / ${H}` }} aria-hidden>
      <div className="page-preview__text" style={{ left: pct(layout.marginInnerMm, W), right: pct(layout.marginOuterMm, W), top: pct(layout.marginTopMm, H), bottom: pct(layout.marginBottomMm, H), columnCount: layout.columns, columnGap: pct(layout.columnGapMm, W) }}>
        {Array.from({ length: 14 * layout.columns }, (_, i) => (
          <span key={i} className="page-preview__line" style={{ width: i % 7 === 6 ? '60%' : '100%' }} />
        ))}
      </div>
      {m.header && (
        <div className="page-preview__header" style={{ left: pct(layout.marginInnerMm, W), right: pct(layout.marginOuterMm, W), top: pct(layout.marginTopMm * 0.45, H) }}>
          {sample ? fill(m.header) : ''}
        </div>
      )}
      {m.footer && (
        <div className="page-preview__footer" style={{ left: pct(layout.marginInnerMm, W), right: pct(layout.marginOuterMm, W), bottom: pct(layout.marginBottomMm * 0.3, H) }}>
          {sample ? fill(m.footer) : ''}
        </div>
      )}
      {m.pageNumbers !== 'none' && (
        <div className={`page-preview__num at-${m.pageNumbers}`} style={{ [m.pageNumbers.startsWith('top') ? 'top' : 'bottom']: pct((m.pageNumbers.startsWith('top') ? layout.marginTopMm : layout.marginBottomMm) * 0.45, H) }}>
          {sample ? num : ''}
        </div>
      )}
    </div>
  );
}

function TemplatesTab() {
  const user = useTemplates((s) => s.user);
  const lang = useLang();
  const list = useMemo(() => useTemplates.getState().all(), [user, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sel, setSel] = useState<string>('blank');
  const hasDoc = useWorkspace((s) => !!s.activeDoc);
  const tpl = list.find((x) => x.id === sel) ?? list[0];
  const ws = useWorkspace.getState();
  const close = () => ws.closeDialog();
  const L = tpl.settings.layout;

  const create = async () => {
    const title = await promptDialog(t('tpl.newTitle'), tpl.id === 'blank' ? t('doc.untitled') : tpl.name);
    if (title === null) return;
    close();
    await newDocFromTemplate(tpl, title);
  };

  return (
    <div className="tpl">
      <div className="tpl__grid">
        {list.map((x) => (
          <button key={x.id} className={`tpl-card ${x.id === tpl.id ? 'is-active' : ''}`} onClick={() => setSel(x.id)} onDoubleClick={() => void create()}>
            <PagePreview layout={x.settings.layout} />
            <span className="tpl-card__name">{x.name}</span>
            <span className="tpl-card__kind">{x.builtIn ? t('tpl.builtIn') : t('tpl.mine')}</span>
          </button>
        ))}
        {hasDoc && (
          <button
            className="tpl-card tpl-card--add"
            onClick={async () => {
              const name = await promptDialog(t('tpl.saveAsName'), useDocSettings.getState().settings.title || t('tpl.myTemplate'));
              if (!name?.trim()) return;
              const made = await saveCurrentAsTemplate(name.trim(), '');
              if (made) {
                setSel(made.id);
                ws.toast(t('tpl.saved', { name: made.name }), 'ok');
              }
            }}
          >
            <Save size={22} strokeWidth={1.5} />
            <span className="tpl-card__name">{t('tpl.saveCurrent')}</span>
          </button>
        )}
      </div>
      <aside className="tpl__detail">
        <PagePreview layout={L} width={200} sample />
        <h3>{tpl.name}</h3>
        {tpl.description && <p className="hint">{tpl.description}</p>}
        <dl className="tpl__facts">
          <dt>{t('tpl.fact.paper')}</dt>
          <dd>
            {L.paper === 'custom' ? `${L.widthMm} × ${L.heightMm} mm` : L.paper.toUpperCase()}
            {L.facingPages ? ` · ${t('tpl.fact.facing')}` : ''}
          </dd>
          <dt>{t('tpl.fact.text')}</dt>
          <dd>
            {L.fontSizePt} pt · {t('tpl.fact.leading', { n: L.leading })} · {t('tpl.fact.columns', { n: L.columns })}
          </dd>
          <dt>{t('tpl.fact.citations')}</dt>
          <dd>{tpl.settings.citationStyle}</dd>
          <dt>{t('tpl.fact.masters')}</dt>
          <dd>{Object.entries(L.masters).map(([id, m]) => masterLabel(id, m)).join(', ')}</dd>
        </dl>
        <div className="tpl__actions">
          <button className="btn btn--primary" onClick={() => void create()}>
            <FilePlus2 size={14} /> {t('tpl.newFrom')}
          </button>
          {hasDoc && (
            <button
              className="btn"
              onClick={async () => {
                if (!(await confirmDialog(t('tpl.applyConfirm', { name: tpl.name }), t('tpl.applyHint')))) return;
                applyTemplateLayout(tpl);
                ws.toast(t('tpl.applied'), 'ok');
              }}
            >
              <Paintbrush size={14} /> {t('tpl.apply')}
            </button>
          )}
          <button
            className="btn"
            onClick={async () => {
              const name = await promptDialog(t('tpl.duplicateName'), `${tpl.name} (${t('tpl.copy')})`);
              if (!name?.trim()) return;
              const copy: Template = { ...templateFromDoc(`u${Date.now().toString(36)}`, name.trim(), tpl.description, tpl.markdown, tpl.settings) };
              await useTemplates.getState().save(copy);
              setSel(copy.id);
            }}
          >
            <Copy size={14} /> {t('tpl.duplicate')}
          </button>
          {!tpl.builtIn && (
            <button
              className="btn btn--danger-ghost"
              onClick={async () => {
                if (!(await confirmDialog(t('tpl.deleteConfirm', { name: tpl.name }), undefined, { danger: true, okLabel: t('common.delete') }))) return;
                await useTemplates.getState().remove(tpl.id);
                setSel('blank');
              }}
            >
              <Trash2 size={14} /> {t('common.delete')}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function MastersTab() {
  const layout = useDocSettings((s) => s.settings.layout);
  const hasDoc = useWorkspace((s) => !!s.activeDoc);
  const [sel, setSel] = useState<MasterId>('body');
  const set = (l: LayoutSettings) => useDocSettings.getState().updateLayout({ masters: l.masters });
  const id = layout.masters[sel] ? sel : 'body';
  const m = layout.masters[id];
  const patch = (p: Partial<MasterPage>) => set({ ...layout, masters: { ...layout.masters, [id]: { ...m, ...p } } });

  if (!hasDoc) return <p className="hint tpl__empty">{t('tpl.masters.noDoc')}</p>;
  return (
    <div className="tpl tpl--masters">
      <aside className="tpl__masters">
        <ul>
          {Object.entries(layout.masters).map(([k, v]) => (
            <li key={k}>
              <button className={`tpl__master ${k === id ? 'is-active' : ''}`} onClick={() => setSel(k)}>
                <PagePreview layout={layout} master={v} width={34} />
                <span>{masterLabel(k, v)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          className="btn small"
          onClick={async () => {
            const name = await promptDialog(t('tpl.masters.newName'), t('tpl.masters.newDefault'));
            if (!name?.trim()) return;
            const made = addMaster(layout, name.trim(), id);
            set(made.layout);
            setSel(made.id);
          }}
        >
          <Plus size={13} /> {t('tpl.masters.new')}
        </button>
        <p className="hint">{t('tpl.masters.hint')}</p>
      </aside>
      <div className="tpl__master-edit">
        <div className="form">
          <label className="form__row">
            <span>{t('tpl.masters.name')}</span>
            <input
              className="input"
              value={masterLabel(id, m)}
              disabled={(BUILTIN_MASTERS as readonly string[]).includes(id) && !m.name}
              onChange={(e) => set(renameMaster(layout, id, e.target.value))}
            />
          </label>
          <label className="form__row">
            <span>{t('master.header')}</span>
            <input className="input" value={m.header} placeholder="{title}" onChange={(e) => patch({ header: e.target.value })} />
          </label>
          <label className="form__row">
            <span>{t('master.footer')}</span>
            <input className="input" value={m.footer} placeholder="{author}" onChange={(e) => patch({ footer: e.target.value })} />
          </label>
          <p className="hint">{t('master.vars')}</p>
          <label className="form__row">
            <span>{t('master.pageNumbers')}</span>
            <select className="select" value={m.pageNumbers} onChange={(e) => patch({ pageNumbers: e.target.value as PageNumberPos })}>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {t(`master.pos.${p}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="form__row">
            <span>{t('master.numbering')}</span>
            <select className="select" value={m.numbering} onChange={(e) => patch({ numbering: e.target.value as MasterPage['numbering'] })}>
              {(['1', 'i', 'I', 'a'] as const).map((n) => (
                <option key={n} value={n}>
                  {NUMBERING[n]}
                </option>
              ))}
            </select>
          </label>
          <label className="form__check">
            <input type="checkbox" checked={m.firstPagePlain} onChange={(e) => patch({ firstPagePlain: e.target.checked })} />
            {t('master.firstPlain')}
          </label>
        </div>
        <div className="tpl__master-side">
          <PagePreview layout={layout} master={m} width={220} sample />
          {id !== 'body' && (
            <div className="tpl__master-actions">
              <button
                className="btn small"
                onClick={() => {
                  const made = addMaster(layout, `${masterLabel(id, m)} (${t('tpl.copy')})`, id);
                  set(made.layout);
                  setSel(made.id);
                }}
              >
                <Copy size={13} /> {t('tpl.duplicate')}
              </button>
              <button
                className="btn small btn--danger-ghost"
                onClick={async () => {
                  if (!(await confirmDialog(t('tpl.masters.deleteConfirm', { name: masterLabel(id, m) }), t('tpl.masters.deleteHint'), { danger: true, okLabel: t('common.delete') }))) return;
                  set(removeMaster(layout, id));
                  setSel('body');
                }}
              >
                <Trash2 size={13} /> {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TemplatesView() {
  useLang();
  const dialog = useWorkspace((s) => s.dialog);
  const arg = useWorkspace((s) => s.dialogArg) as { tab?: 'templates' | 'masters' } | null;
  const [tab, setTab] = useState<'templates' | 'masters'>('templates');
  const loaded = useTemplates((s) => s.loaded);
  const close = () => useWorkspace.getState().closeDialog();

  useEffect(() => {
    if (dialog === 'templates') setTab(arg?.tab ?? 'templates');
  }, [dialog, arg]);
  useEffect(() => {
    if (dialog === 'templates' && !loaded) void useTemplates.getState().load();
  }, [dialog, loaded]);
  useEffect(() => {
    if (dialog !== 'templates') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.modal-backdrop')) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  if (dialog !== 'templates') return null;
  return createPortal(
    <div className="viewer-backdrop">
      <div className="viewer tpl-view" role="dialog" aria-modal aria-label={t('tpl.title')}>
        <header className="viewer__head">
          <LayoutTemplate size={16} />
          <div className="viewer__title">
            <strong>{t('tpl.title')}</strong>
          </div>
          <div className="seg-group tpl-view__tabs" role="tablist">
            {(['templates', 'masters'] as const).map((x) => (
              <button key={x} role="tab" aria-selected={tab === x} className={`seg ${tab === x ? 'is-active' : ''}`} onClick={() => setTab(x)}>
                {t(`tpl.tab.${x}`)}
              </button>
            ))}
          </div>
          <span className="grow" />
          <button className="icon-btn" onClick={close} title={t('common.close')}>
            <X size={18} />
          </button>
        </header>
        <div className="tpl-view__body">{tab === 'templates' ? <TemplatesTab /> : <MastersTab />}</div>
      </div>
    </div>,
    document.body,
  );
}
