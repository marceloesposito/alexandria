// Impostazioni documento: dati, citazioni, pagina, testo, stili di paragrafo, pagine mastro.
import { useEffect, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWorkspace } from '../state/workspace';
import { useDocSettings } from './docSettings';
import { masterLabel } from './TemplatesView';
import { PAPERS, withPaper, type LayoutSettings, type MasterId, type ParaStyleId, type ParaStyle, type MasterPage, type Paper } from './model';
import { BUNDLED_STYLES, listCustomStyles, type StyleInfo } from '../citations/store';
import { runCommand } from '../commands/registry';
import { t, useLang } from '../i18n';

type Tab = 'doc' | 'citations' | 'page' | 'text' | 'styles' | 'masters';

function Num({ value, onChange, step = 1, min, max, suffix }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <span className="num">
      <input
        className="input"
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
      {suffix && <span className="hint">{suffix}</span>}
    </span>
  );
}

export function DocSettingsDialog() {
  useLang();
  const arg = useWorkspace((s) => s.dialogArg) as { tab?: Tab } | null;
  const [tab, setTab] = useState<Tab>(arg?.tab ?? 'doc');
  const settings = useDocSettings((s) => s.settings);
  const update = useDocSettings.getState().update;
  const L = settings.layout;
  const setL = (p: Partial<LayoutSettings>) => useDocSettings.getState().updateLayout(p);
  const close = () => useWorkspace.getState().closeDialog();
  const [custom, setCustom] = useState<StyleInfo[]>([]);
  const [styleId, setStyleId] = useState<ParaStyleId>('body');
  const [masterId, setMasterId] = useState<MasterId>('body');
  useEffect(() => {
    void listCustomStyles().then(setCustom);
  }, []);

  const setStyle = (id: ParaStyleId, p: Partial<ParaStyle>) => setL({ styles: { ...L.styles, [id]: { ...L.styles[id], ...p } } });
  const setMaster = (id: MasterId, p: Partial<MasterPage>) => setL({ masters: { ...L.masters, [id]: { ...L.masters[id], ...p } } });
  const ps = L.styles[styleId];
  const mp = L.masters[masterId];

  return (
    <Modal title={t('docset.title')} onClose={close} size="large">
      <div className="tabs-row" role="tablist">
        {(['doc', 'citations', 'page', 'text', 'styles', 'masters'] as Tab[]).map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} className={`seg ${tab === x ? 'is-active' : ''}`} onClick={() => setTab(x)}>
            {t(`docset.tab.${x}`)}
          </button>
        ))}
      </div>
      <div className="form docset">
        {tab === 'doc' && (
          <>
            <label className="form__row">
              <span>{t('docset.docTitle')}</span>
              <input className="input" value={settings.title} placeholder={t('docset.docTitleHint')} onChange={(e) => update({ title: e.target.value })} />
            </label>
            <label className="form__row">
              <span>{t('docset.author')}</span>
              <input className="input" value={settings.author} onChange={(e) => update({ author: e.target.value })} />
            </label>
            <label className="form__row">
              <span>{t('docset.date')}</span>
              <input className="input" value={settings.date} placeholder={t('docset.dateHint')} onChange={(e) => update({ date: e.target.value })} />
            </label>
          </>
        )}
        {tab === 'citations' && (
          <>
            <label className="form__row">
              <span>{t('docset.style')}</span>
              <select className="select" value={settings.citationStyle} onChange={(e) => update({ citationStyle: e.target.value })}>
                {[...BUNDLED_STYLES, ...custom].map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                    {s.note ? ` — ${t('docset.noteStyle')}` : ''}
                  </option>
                ))}
              </select>
              <button className="btn small" onClick={() => void runCommand('res.importCsl').then(() => listCustomStyles().then(setCustom))}>
                <FileUp size={13} /> {t('docset.importCsl')}
              </button>
            </label>
            <label className="form__row">
              <span>{t('docset.citeLang')}</span>
              <select className="select" value={settings.citationLocale} onChange={(e) => update({ citationLocale: e.target.value })}>
                <option value="it-IT">Italiano</option>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
              </select>
            </label>
            <label className="form__row">
              <span>{t('docset.bibTitle')}</span>
              <input className="input" value={settings.bibliographyTitle} onChange={(e) => update({ bibliographyTitle: e.target.value })} />
            </label>
            <p className="hint">{t('docset.citeHint')}</p>
          </>
        )}
        {tab === 'page' && (
          <>
            <label className="form__row">
              <span>{t('docset.paper')}</span>
              <select className="select" value={L.paper} onChange={(e) => setL(withPaper(L, e.target.value as Paper))}>
                {(Object.keys(PAPERS) as Paper[]).map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()} ({PAPERS[p as Exclude<Paper, 'custom'>].join(' × ')} mm)
                  </option>
                ))}
                <option value="custom">{t('docset.custom')}</option>
              </select>
            </label>
            {L.paper === 'custom' && (
              <div className="form__row">
                <span>{t('docset.size')}</span>
                <span className="num-pair">
                  <Num value={L.widthMm} onChange={(v) => setL({ widthMm: v })} suffix="mm" /> ×
                  <Num value={L.heightMm} onChange={(v) => setL({ heightMm: v })} suffix="mm" />
                </span>
              </div>
            )}
            <div className="form__row">
              <span>{t('docset.margins')}</span>
              <span className="num-grid">
                <label>
                  {t('docset.top')} <Num value={L.marginTopMm} onChange={(v) => setL({ marginTopMm: v })} suffix="mm" />
                </label>
                <label>
                  {t('docset.bottom')} <Num value={L.marginBottomMm} onChange={(v) => setL({ marginBottomMm: v })} suffix="mm" />
                </label>
                <label>
                  {L.facingPages ? t('docset.inner') : t('docset.left')} <Num value={L.marginInnerMm} onChange={(v) => setL({ marginInnerMm: v })} suffix="mm" />
                </label>
                <label>
                  {L.facingPages ? t('docset.outer') : t('docset.right')} <Num value={L.marginOuterMm} onChange={(v) => setL({ marginOuterMm: v })} suffix="mm" />
                </label>
              </span>
            </div>
            <label className="form__check">
              <input type="checkbox" checked={L.facingPages} onChange={(e) => setL({ facingPages: e.target.checked })} />
              {t('docset.facing')}
            </label>
            <div className="form__row">
              <span>{t('docset.columns')}</span>
              <span className="num-pair">
                <select className="select" value={L.columns} onChange={(e) => setL({ columns: Number(e.target.value) as 1 | 2 | 3 })}>
                  {[1, 2, 3].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {L.columns > 1 && (
                  <label>
                    {t('docset.gutter')} <Num value={L.columnGapMm} onChange={(v) => setL({ columnGapMm: v })} suffix="mm" />
                  </label>
                )}
              </span>
            </div>
          </>
        )}
        {tab === 'text' && (
          <>
            <label className="form__row">
              <span>{t('docset.font')}</span>
              <select className="select" value={L.font} onChange={(e) => setL({ font: e.target.value as LayoutSettings['font'] })}>
                <option value="serif">Libertinus Serif</option>
                <option value="sans">Sans (Inter / New Computer Modern Sans)</option>
              </select>
            </label>
            <div className="form__row">
              <span>{t('docset.fontSize')}</span>
              <Num value={L.fontSizePt} step={0.5} min={8} max={16} onChange={(v) => setL({ fontSizePt: v, styles: { ...L.styles, body: { ...L.styles.body, sizePt: v } } })} suffix="pt" />
            </div>
            <div className="form__row">
              <span>{t('docset.leading')}</span>
              <Num value={L.leading} step={0.05} min={1} max={2.5} onChange={(v) => setL({ leading: v })} />
            </div>
            <label className="form__check">
              <input type="checkbox" checked={L.justify} onChange={(e) => setL({ justify: e.target.checked })} />
              {t('docset.justify')}
            </label>
            <label className="form__check">
              <input type="checkbox" checked={L.hyphenate} onChange={(e) => setL({ hyphenate: e.target.checked })} />
              {t('docset.hyphenate')}
            </label>
            <label className="form__check">
              <input type="checkbox" checked={L.widowsOrphans} onChange={(e) => setL({ widowsOrphans: e.target.checked })} />
              {t('docset.widows')}
            </label>
            <label className="form__check">
              <input type="checkbox" checked={L.headingNumbers} onChange={(e) => setL({ headingNumbers: e.target.checked })} />
              {t('docset.headingNumbers')}
            </label>
            <label className="form__check">
              <input type="checkbox" checked={L.lineNumbersInPdf} onChange={(e) => setL({ lineNumbersInPdf: e.target.checked })} />
              {t('docset.lineNumbersPdf')}
            </label>
            <label className="form__check">
              <input type="checkbox" checked={L.baselineGrid} onChange={(e) => setL({ baselineGrid: e.target.checked })} />
              {t('docset.baselineGrid')}
            </label>
          </>
        )}
        {tab === 'styles' && (
          <div className="docset__split">
            <ul className="pick-list">
              {(Object.keys(L.styles) as ParaStyleId[]).map((id) => (
                <li key={id}>
                  <button className={`pick-list__item ${styleId === id ? 'is-active' : ''}`} onClick={() => setStyleId(id)}>
                    {t(`pstyle.${id}`)}
                  </button>
                </li>
              ))}
            </ul>
            <div className="form">
              <div className="form__row">
                <span>{t('pstyle.size')}</span>
                <Num value={ps.sizePt} step={0.5} min={6} max={40} onChange={(v) => setStyle(styleId, { sizePt: v })} suffix="pt" />
              </div>
              <label className="form__check">
                <input type="checkbox" checked={ps.weight === 'bold'} onChange={(e) => setStyle(styleId, { weight: e.target.checked ? 'bold' : 'regular' })} />
                {t('pstyle.bold')}
              </label>
              <label className="form__check">
                <input type="checkbox" checked={ps.italic} onChange={(e) => setStyle(styleId, { italic: e.target.checked })} />
                {t('pstyle.italic')}
              </label>
              <label className="form__check">
                <input type="checkbox" checked={ps.smallCaps} onChange={(e) => setStyle(styleId, { smallCaps: e.target.checked })} />
                {t('pstyle.smallCaps')}
              </label>
              <label className="form__row">
                <span>{t('pstyle.align')}</span>
                <select className="select" value={ps.align} onChange={(e) => setStyle(styleId, { align: e.target.value as ParaStyle['align'] })}>
                  {['inherit', 'left', 'center', 'right', 'justify'].map((a) => (
                    <option key={a} value={a}>
                      {t(`pstyle.align.${a}`)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form__row">
                <span>{t('pstyle.spacing')}</span>
                <span className="num-pair">
                  <Num value={ps.spaceBeforePt} min={0} onChange={(v) => setStyle(styleId, { spaceBeforePt: v })} suffix={t('pstyle.before')} />
                  <Num value={ps.spaceAfterPt} min={0} onChange={(v) => setStyle(styleId, { spaceAfterPt: v })} suffix={t('pstyle.after')} />
                </span>
              </div>
              <div className="form__row">
                <span>{t('pstyle.indent')}</span>
                <Num value={ps.indentFirstMm} min={0} step={0.5} onChange={(v) => setStyle(styleId, { indentFirstMm: v })} suffix="mm" />
              </div>
            </div>
          </div>
        )}
        {tab === 'masters' && (
          <div className="docset__split">
            <ul className="pick-list">
              {(Object.keys(L.masters) as MasterId[]).map((id) => (
                <li key={id}>
                  <button className={`pick-list__item ${masterId === id ? 'is-active' : ''}`} onClick={() => setMasterId(id)}>
                    {masterLabel(id, L.masters[id])}
                  </button>
                </li>
              ))}
            </ul>
            <div className="form">
              <label className="form__row">
                <span>{t('master.header')}</span>
                <input className="input" value={mp.header} placeholder="{title}" onChange={(e) => setMaster(masterId, { header: e.target.value })} />
              </label>
              <label className="form__row">
                <span>{t('master.footer')}</span>
                <input className="input" value={mp.footer} onChange={(e) => setMaster(masterId, { footer: e.target.value })} />
              </label>
              <label className="form__row">
                <span>{t('master.pageNumbers')}</span>
                <select className="select" value={mp.pageNumbers} onChange={(e) => setMaster(masterId, { pageNumbers: e.target.value as MasterPage['pageNumbers'] })}>
                  {['none', 'bottom-center', 'bottom-outer', 'top-outer', 'top-center'].map((p) => (
                    <option key={p} value={p}>
                      {t(`master.pos.${p}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form__row">
                <span>{t('master.numbering')}</span>
                <select className="select" value={mp.numbering} onChange={(e) => setMaster(masterId, { numbering: e.target.value as MasterPage['numbering'] })}>
                  <option value="1">1, 2, 3</option>
                  <option value="i">i, ii, iii</option>
                  <option value="I">I, II, III</option>
                  <option value="a">a, b, c</option>
                </select>
              </label>
              <label className="form__check">
                <input type="checkbox" checked={mp.firstPagePlain} onChange={(e) => setMaster(masterId, { firstPagePlain: e.target.checked })} />
                {t('master.firstPlain')}
              </label>
              <p className="hint">{t('master.vars')}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
