// Modulo risorse e citazioni: vista, pannelli dell'editor, dialoghi, comandi, widget.
import { useEffect, useState } from 'react';
import {
  Plus,
  BookMarked,
  Library,
  LayoutDashboard,
  Network,
  Layers,
  FolderPlus,
  Filter,
  Tags,
  Sparkles,
  MousePointer2,
  Hand,
  StickyNote,
  Frame,
  Spline,
  Maximize,
  Search,
  Quote,
  BookOpen,
  Image as ImageIcon,
  FileUp,
} from 'lucide-react';
import { registerCommands, notifyCommandState } from '../commands/registry';
import { viewComponents, globalComponents } from '../shell/views';
import { registerDialog } from '../shell/DialogHost';
import { registerWidget } from '../shell/RibbonWidgets';
import { leftPanelSections } from '../editor/slots';
import { ResourcesView } from './ui/ResourcesView';
import { AddResourceModal } from './ui/AddResourceModal';
import { ResourceTreeSection, PinnedSection } from './ui/EditorSidebar';
import { useResources } from './store';
import { wbApi } from './ui/Whiteboard';
import { ws } from '../state/workspace';
import { promptDialog } from '../components/confirm';
import { CitePicker } from '../citations/CitePicker';
import { useCitations, insertBibliography, BUNDLED_STYLES, listCustomStyles, type StyleInfo } from '../citations/store';
import { useDocSettings } from '../layout/docSettings';
import { getEditor } from '../state/editorRef';
import { setEditorFilesHandler } from '../editor/extensions/drop';
import { importFiles } from './importer';
import { relativeFromDoc } from '../vault/resolve';
import { platform } from '../platform';
import { t, useLang } from '../i18n';
import type { RibbonSize } from '../state/prefs';
import { ResourceViewer } from './viewer/ResourceViewer';

function StyleWidget({ size }: { size: RibbonSize }) {
  useLang();
  const style = useDocSettings((s) => s.settings.citationStyle);
  const [custom, setCustom] = useState<StyleInfo[]>([]);
  useEffect(() => {
    void listCustomStyles().then(setCustom);
  }, []);
  return (
    <label className={`ribbon__widget ribbon__widget--${size}`}>
      <select className="select" value={style} title={t('cmd.cite.style')} onChange={(e) => useDocSettings.getState().update({ citationStyle: e.target.value })}>
        {[...BUNDLED_STYLES, ...custom].map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      {size === 'large' && <span className="ribbon__btn-label">{t('cmd.cite.style')}</span>}
    </label>
  );
}

/** Immagini trascinate dal disco nel testo: diventano risorse del vault e figure nel documento. */
async function dropFilesIntoEditor(files: File[], pos: number) {
  const images = files.filter((f) => f.type.startsWith('image/'));
  const others = files.filter((f) => !f.type.startsWith('image/'));
  const data = await Promise.all(images.map(async (f) => ({ name: f.name, mime: f.type, data: new Uint8Array(await f.arrayBuffer()) })));
  const made = await importFiles(data, 'vault');
  const e = getEditor();
  const docRel = ws().activeDoc;
  if (e && docRel) {
    let at = pos;
    for (const r of made) {
      if (r.kind !== 'image' || !r.file) continue;
      const node = e.schema.nodes.figure.create({ src: relativeFromDoc(docRel, `resources/${r.id}/${r.file}`), caption: r.title });
      const $p = e.state.doc.resolve(Math.min(at, e.state.doc.content.size));
      const insertAt = $p.depth > 0 ? $p.after(1) : at;
      e.view.dispatch(e.state.tr.insert(insertAt, node));
      at = insertAt + node.nodeSize;
    }
  }
  if (others.length) {
    const rest = await Promise.all(others.map(async (f) => ({ name: f.name, mime: f.type, data: new Uint8Array(await f.arrayBuffer()) })));
    await importFiles(rest, 'vault');
    ws().toast(t('res.addedToResources', { n: rest.length }), 'info');
  }
}

export function registerResources() {
  viewComponents.resources = ResourcesView;
  registerDialog('addResource', AddResourceModal);
  registerDialog('cite', CitePicker);
  leftPanelSections.add(ResourceTreeSection);
  leftPanelSections.add(PinnedSection);
  // il visualizzatore si apre da ogni vista (anche dai pin della colonna sinistra dell'editor)
  globalComponents.push(ResourceViewer);
  registerWidget('citeStyle', StyleWidget);
  setEditorFilesHandler(dropFilesIntoEditor);
  // i pulsanti del ribbon seguono vista, ambito e selezione del gestore risorse
  useResources.subscribe((s, p) => {
    if (s.view !== p.view || s.scope !== p.scope || s.selected !== p.selected) notifyCommandState();
  });

  const st = () => useResources.getState();
  registerCommands([
    { id: 'res.add', label: 'cmd.res.add', icon: Plus, shortcut: 'Mod+Shift+A', category: 'resources', run: () => ws().openDialog('addResource') },
    {
      id: 'res.importBib',
      label: 'cmd.res.importBib',
      icon: BookMarked,
      category: 'resources',
      run: () => ws().openDialog('addResource', { tab: 'bib' }),
    },
    {
      id: 'res.library',
      label: 'cmd.res.library',
      icon: Library,
      category: 'resources',
      isActive: () => st().scope === 'library',
      run: () => {
        ws().setView('resources');
        st().setScope(st().scope === 'library' ? 'vault' : 'library');
      },
    },
    { id: 'res.view.whiteboard', label: 'cmd.res.view.whiteboard', icon: LayoutDashboard, category: 'resources', isActive: () => st().view === 'whiteboard', run: () => (ws().setView('resources'), st().setView('whiteboard')) },
    { id: 'res.view.graph', label: 'cmd.res.view.graph', icon: Network, category: 'resources', isActive: () => st().view === 'graph', run: () => (ws().setView('resources'), st().setView('graph')) },
    { id: 'res.view.layers', label: 'cmd.res.view.layers', icon: Layers, category: 'resources', isActive: () => st().view === 'layers', run: () => (ws().setView('resources'), st().setView('layers')) },
    {
      id: 'res.newLayer',
      label: 'cmd.res.newLayer',
      icon: FolderPlus,
      category: 'resources',
      run: async () => {
        const name = await promptDialog(t('layers.newGroup'), t('layers.newGroupDefault'));
        if (!name?.trim()) return;
        const l = st().addLayer({ name: name.trim() });
        if (st().selected.length) await st().assignLayer(st().selected, l.id, true);
      },
    },
    {
      id: 'res.newFilter',
      label: 'cmd.res.newFilter',
      icon: Filter,
      category: 'resources',
      run: async () => {
        const tag = await promptDialog(t('filter.quickTitle'), '', t('filter.quickHint'));
        if (!tag?.trim()) return;
        st().addLayer({ name: `#${tag.trim()}`, kind: 'filter', rule: { match: 'all', conditions: [{ field: 'tag', op: 'is', value: tag.trim() }] } });
      },
    },
    {
      id: 'res.tags',
      label: 'cmd.res.tags',
      icon: Tags,
      category: 'resources',
      isEnabled: () => st().selected.length > 0,
      run: async () => {
        const tag = await promptDialog(t('res.tagSelected', { n: st().selected.length }), '');
        if (!tag?.trim()) return;
        for (const id of st().selected) {
          const r = st().get(id);
          if (r) await st().setTags(id, [...r.tags, tag.trim().replace(/^#/, '')]);
        }
      },
    },
    {
      id: 'res.suggest',
      label: 'cmd.res.suggest',
      icon: Sparkles,
      category: 'resources',
      isActive: () => ws().app.prefs.layerSuggestions === 'suggest',
      run: () => ws().setPrefs({ layerSuggestions: ws().app.prefs.layerSuggestions === 'suggest' ? 'off' : 'suggest' }),
    },
    { id: 'res.search', label: 'cmd.res.search', icon: Search, category: 'resources', run: () => (document.querySelector('.resources__search input') as HTMLInputElement | null)?.focus() },
    { id: 'wb.select', label: 'cmd.wb.select', icon: MousePointer2, category: 'whiteboard', views: ['resources'], isActive: () => !wbApi.pan, run: () => (wbApi.pan = false) },
    { id: 'wb.pan', label: 'cmd.wb.pan', icon: Hand, category: 'whiteboard', views: ['resources'], isActive: () => !!wbApi.pan, run: () => (wbApi.pan = !wbApi.pan) },
    { id: 'wb.note', label: 'cmd.wb.note', icon: StickyNote, category: 'whiteboard', views: ['resources'], run: () => (st().setView('whiteboard'), setTimeout(() => wbApi.addNote?.(), 50)) },
    { id: 'wb.frame', label: 'cmd.wb.frame', icon: Frame, category: 'whiteboard', views: ['resources'], run: () => (st().setView('whiteboard'), setTimeout(() => void wbApi.addFrame?.(), 50)) },
    { id: 'wb.connect', label: 'cmd.wb.connect', icon: Spline, category: 'whiteboard', views: ['resources'], run: () => ws().toast(t('wb.connectHint'), 'info') },
    { id: 'wb.fit', label: 'cmd.wb.fit', icon: Maximize, category: 'whiteboard', views: ['resources'], run: () => wbApi.fit?.() },

    // ----- citazioni
    { id: 'cite.insert', label: 'cmd.cite.insert', icon: Quote, shortcut: 'Mod+Shift+K', category: 'citations', views: ['editor'], run: () => ws().openDialog('cite') },
    { id: 'cite.style', label: 'cmd.cite.style', icon: BookOpen, category: 'citations', views: ['editor'], widget: 'citeStyle', run: () => ws().openDialog('docSettings', { tab: 'citations' }) },
    {
      id: 'cite.bibliography',
      label: 'cmd.cite.bibliography',
      icon: BookMarked,
      category: 'citations',
      views: ['editor'],
      run: async () => {
        const e = getEditor();
        if (!e) return;
        if (!useCitations.getState().engine) await useCitations.getState().rebuild();
        const n = insertBibliography(e);
        ws().toast(n ? t('cite.bibDone', { n }) : t('cite.bibNone'), n ? 'ok' : 'info');
      },
    },
    { id: 'cite.manage', label: 'cmd.cite.manage', icon: Library, category: 'citations', run: () => (ws().setView('resources'), st().setView('layers')) },
    {
      id: 'insert.image',
      label: 'cmd.insert.image',
      icon: ImageIcon,
      category: 'insert',
      views: ['editor'],
      run: async () => {
        const e = getEditor();
        const docRel = ws().activeDoc;
        if (!e || !docRel) return;
        const paths = await platform.pickFiles(t('add.pick'));
        if (!paths.length) return;
        const { importPaths } = await import('./importer');
        const made = await importPaths(paths, 'vault');
        for (const r of made.filter((x) => x.kind === 'image' && x.file)) {
          e.chain().focus().insertFigure({ src: relativeFromDoc(docRel, `resources/${r.id}/${r.file}`), caption: r.title }).run();
        }
      },
    },
    {
      id: 'res.importCsl',
      label: 'cmd.res.importCsl',
      icon: FileUp,
      category: 'citations',
      run: async () => {
        const [p] = await platform.pickFiles(t('cite.importStyle'));
        if (!p) return;
        const { importStyle } = await import('../citations/store');
        try {
          const s = await importStyle(p);
          if (s) {
            useDocSettings.getState().update({ citationStyle: s.id });
            ws().toast(t('cite.styleImported', { title: s.title }), 'ok');
          }
        } catch (err) {
          ws().toast(String(err), 'error');
        }
      },
    },
  ]);
}
