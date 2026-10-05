// Modulo export e impaginazione: finestra Esporta, anteprima, comandi e controlli della scheda Layout.
import { useState } from 'react';
import { FileDown, FileText, FileType2, Globe, FileCode2, Printer, Sigma, Ruler, Columns3, Type, LayoutTemplate, Hash, FileOutput, ListTree } from 'lucide-react';
import { registerCommands } from '../commands/registry';
import { registerDialog } from '../shell/DialogHost';
import { registerWidget } from '../shell/RibbonWidgets';
import { previewPanel } from '../editor/slots';
import { Modal } from '../components/Modal';
import { useWorkspace, ws } from '../state/workspace';
import { useDocSettings } from '../layout/docSettings';
import { PAPERS, withPaper, type Paper } from '../layout/model';
import { PreviewPanel } from './PreviewPanel';
import { exportTo, printDocument, type ExportFormat } from './run';
import { platform } from '../platform';
import { t, useLang } from '../i18n';
import type { RibbonSize } from '../state/prefs';

const FORMATS: { id: ExportFormat; icon: typeof FileText }[] = [
  { id: 'pdf', icon: FileDown },
  { id: 'docx', icon: FileType2 },
  { id: 'html', icon: Globe },
  { id: 'md', icon: FileCode2 },
  { id: 'txt', icon: FileText },
  { id: 'tex', icon: Sigma },
];

function ExportDialog() {
  useLang();
  const close = () => useWorkspace.getState().closeDialog();
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [busy, setBusy] = useState(false);
  const lineNumbers = useDocSettings((s) => s.settings.layout.lineNumbersInPdf);
  const revisions = useWorkspace((s) => s.app.prefs.exportRevisions);
  return (
    <Modal
      title={t('export.title')}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn--primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await exportTo(format);
              setBusy(false);
              if (ok) close();
            }}
          >
            <FileOutput size={14} /> {busy ? t('export.working') : t('export.go')}
          </button>
        </>
      }
    >
      <div className="export-formats">
        {FORMATS.map((f) => (
          <button key={f.id} className={`export-format ${format === f.id ? 'is-active' : ''}`} onClick={() => setFormat(f.id)}>
            <f.icon size={22} strokeWidth={1.5} />
            <strong>{t(`export.fmt.${f.id}`)}</strong>
            <span className="hint">{t(`export.desc.${f.id}`)}</span>
          </button>
        ))}
      </div>
      {format === 'pdf' && (
        <label className="check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={lineNumbers} onChange={(e) => useDocSettings.getState().updateLayout({ lineNumbersInPdf: e.target.checked })} />
          {t('docset.lineNumbersPdf')}
        </label>
      )}
      {(format === 'pdf' || format === 'docx' || format === 'html') && (
        <label className="check" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={revisions === 'marked'} onChange={(e) => useWorkspace.getState().setPrefs({ exportRevisions: e.target.checked ? 'marked' : 'clean' })} />
          {format === 'docx' ? t('export.revisionsDocx') : t('export.revisions')}
        </label>
      )}
      {format === 'pdf' && platform.kind !== 'tauri' && <p className="hint">{t('preview.desktopOnly')}</p>}
    </Modal>
  );
}

function PaperWidget({ size }: { size: RibbonSize }) {
  useLang();
  const L = useDocSettings((s) => s.settings.layout);
  return (
    <label className={`ribbon__widget ribbon__widget--${size}`}>
      <select className="select" value={L.paper} title={t('cmd.layout.paper')} onChange={(e) => useDocSettings.getState().updateLayout(withPaper(L, e.target.value as Paper))}>
        {(Object.keys(PAPERS) as Paper[]).map((p) => (
          <option key={p} value={p}>
            {p.toUpperCase()}
          </option>
        ))}
        <option value="custom">{t('docset.custom')}</option>
      </select>
      {size === 'large' && <span className="ribbon__btn-label">{t('cmd.layout.paper')}</span>}
    </label>
  );
}

const MARGINS: Record<string, number> = { narrow: 15, normal: 25, wide: 35 };

function MarginsWidget({ size }: { size: RibbonSize }) {
  useLang();
  const L = useDocSettings((s) => s.settings.layout);
  const cur = Object.entries(MARGINS).find(([, v]) => [L.marginTopMm, L.marginBottomMm, L.marginInnerMm, L.marginOuterMm].every((m) => m === v))?.[0] ?? 'custom';
  return (
    <label className={`ribbon__widget ribbon__widget--${size}`}>
      <select
        className="select"
        value={cur}
        title={t('cmd.layout.margins')}
        onChange={(e) => {
          const v = MARGINS[e.target.value];
          if (v) useDocSettings.getState().updateLayout({ marginTopMm: v, marginBottomMm: v, marginInnerMm: v, marginOuterMm: v });
          else ws().openDialog('docSettings', { tab: 'page' });
        }}
      >
        {Object.keys(MARGINS).map((k) => (
          <option key={k} value={k}>
            {t(`layout.margins.${k}`)}
          </option>
        ))}
        <option value="custom">{t('layout.margins.custom')}</option>
      </select>
      {size === 'large' && <span className="ribbon__btn-label">{t('cmd.layout.margins')}</span>}
    </label>
  );
}

function ColumnsWidget({ size }: { size: RibbonSize }) {
  useLang();
  const cols = useDocSettings((s) => s.settings.layout.columns);
  return (
    <label className={`ribbon__widget ribbon__widget--${size}`}>
      <select className="select" value={cols} title={t('cmd.layout.columns')} onChange={(e) => useDocSettings.getState().updateLayout({ columns: Number(e.target.value) as 1 | 2 | 3 })}>
        {[1, 2, 3].map((c) => (
          <option key={c} value={c}>
            {t('editor.section.columns', { n: c })}
          </option>
        ))}
      </select>
      {size === 'large' && <span className="ribbon__btn-label">{t('cmd.layout.columns')}</span>}
    </label>
  );
}

export function registerExport() {
  registerDialog('export', ExportDialog);
  previewPanel.set(PreviewPanel);
  registerWidget('layoutPaper', PaperWidget);
  registerWidget('layoutMargins', MarginsWidget);
  registerWidget('layoutColumns', ColumnsWidget);
  const L = () => useDocSettings.getState().settings.layout;
  const fmt = (id: ExportFormat, icon: typeof FileText) => ({
    id: `file.export${id === 'tex' ? 'Tex' : id.charAt(0).toUpperCase() + id.slice(1)}`,
    label: `cmd.file.export${id === 'tex' ? 'Tex' : id.charAt(0).toUpperCase() + id.slice(1)}`,
    icon,
    category: 'export',
    run: () => exportTo(id),
  });
  registerCommands([
    { id: 'file.export', label: 'cmd.file.export', icon: FileOutput, shortcut: 'Mod+E', category: 'export', run: () => ws().openDialog('export') },
    { ...fmt('pdf', FileDown), shortcut: 'Mod+Shift+E' },
    fmt('docx', FileType2),
    fmt('html', Globe),
    fmt('md', FileCode2),
    fmt('txt', FileText),
    fmt('tex', Sigma),
    { id: 'file.print', label: 'cmd.file.print', icon: Printer, shortcut: 'Mod+P', category: 'export', run: () => printDocument() },
    { id: 'layout.paper', label: 'cmd.layout.paper', icon: Ruler, category: 'layout', views: ['editor'], widget: 'layoutPaper', run: () => ws().openDialog('docSettings', { tab: 'page' }) },
    { id: 'layout.margins', label: 'cmd.layout.margins', icon: Ruler, category: 'layout', views: ['editor'], widget: 'layoutMargins', run: () => ws().openDialog('docSettings', { tab: 'page' }) },
    { id: 'layout.columns', label: 'cmd.layout.columns', icon: Columns3, category: 'layout', views: ['editor'], widget: 'layoutColumns', run: () => ws().openDialog('docSettings', { tab: 'page' }) },
    { id: 'layout.styles', label: 'cmd.layout.styles', icon: Type, category: 'layout', views: ['editor'], run: () => ws().openDialog('docSettings', { tab: 'styles' }) },
    { id: 'layout.masters', label: 'cmd.layout.masters', icon: LayoutTemplate, category: 'layout', views: ['editor'], run: () => ws().openDialog('docSettings', { tab: 'masters' }) },
    {
      id: 'layout.lineNumbersPdf',
      label: 'cmd.layout.lineNumbersPdf',
      icon: Hash,
      category: 'layout',
      views: ['editor'],
      isActive: () => L().lineNumbersInPdf,
      run: () => useDocSettings.getState().updateLayout({ lineNumbersInPdf: !L().lineNumbersInPdf }),
    },
    {
      id: 'view.outline',
      label: 'cmd.view.outline',
      icon: ListTree,
      shortcut: 'Mod+Shift+O',
      category: 'view',
      views: ['editor'],
      isActive: () => ws().app.prefs.leftTab === 'outline' && ws().app.prefs.showLeft,
      run: () => {
        const p = ws().app.prefs;
        ws().setPrefs({ showLeft: true, leftTab: p.leftTab === 'outline' && p.showLeft ? 'resources' : 'outline' });
      },
    },
  ]);
}
