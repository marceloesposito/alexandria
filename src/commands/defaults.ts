// Ribbon e menu predefiniti. Gli id di comando che non esistono ancora vengono ignorati.
import type { RibbonConfig } from './ribbonModel';

export const DEFAULT_RIBBON: RibbonConfig = {
  version: 1,
  // rev 2: citazioni e bibliografia anche in Home
  rev: 2,
  tabs: [
    // ----- editor
    {
      id: 'ed-home',
      view: 'editor',
      label: 'ribbon.tab.home',
      groups: [
        { id: 'ed-home-clip', label: 'ribbon.group.clipboard', items: ['edit.paste', 'edit.cut', 'edit.copy', 'edit.undo', 'edit.redo'] },
        { id: 'ed-home-style', label: 'ribbon.group.style', items: ['fmt.blockStyle', 'insert.h1', 'insert.h2', 'insert.h3', 'insert.paragraph'] },
        {
          id: 'ed-home-char',
          label: 'ribbon.group.character',
          items: ['fmt.bold', 'fmt.italic', 'fmt.underline', 'fmt.strike', 'fmt.highlight', 'fmt.superscript', 'fmt.subscript', 'fmt.code', 'fmt.clear'],
        },
        // subito dopo il carattere: visibile anche su schermi normali, senza scorrere la barra
        { id: 'ed-home-cite', label: 'ribbon.group.citations', items: ['cite.insert', 'cite.bibliography'], since: 2 },
        {
          id: 'ed-home-para',
          label: 'ribbon.group.paragraph',
          items: ['insert.bulletList', 'insert.orderedList', 'insert.taskList', 'fmt.outdent', 'fmt.indent', 'fmt.alignLeft', 'fmt.alignCenter', 'fmt.alignRight', 'fmt.alignJustify'],
        },
        { id: 'ed-home-find', label: 'ribbon.group.find', items: ['edit.find', 'edit.replace', 'edit.goToLine'] },
      ],
    },
    {
      id: 'ed-insert',
      view: 'editor',
      label: 'ribbon.tab.insert',
      groups: [
        { id: 'ed-ins-blocks', label: 'ribbon.group.blocks', items: ['insert.quote', 'insert.codeBlock', 'insert.hr', 'insert.table', 'table.addRow', 'table.addColumn', 'table.deleteRow', 'table.deleteColumn'] },
        { id: 'ed-ins-media', label: 'ribbon.group.media', items: ['insert.image', 'res.insert', 'res.insertSnippet', 'insert.math', 'insert.mathInline'] },
        { id: 'ed-ins-links', label: 'ribbon.group.links', items: ['insert.link', 'insert.wikilink', 'comment.add'] },
        { id: 'ed-ins-pages', label: 'ribbon.group.pages', items: ['insert.pageBreak', 'insert.sectionBreak', 'insert.toc'] },
      ],
    },
    {
      id: 'ed-refs',
      view: 'editor',
      label: 'ribbon.tab.references',
      groups: [
        { id: 'ed-refs-cite', label: 'ribbon.group.citations', items: ['cite.insert', 'cite.style', 'insert.footnote'] },
        { id: 'ed-refs-bib', label: 'ribbon.group.bibliography', items: ['cite.bibliography', 'cite.manage'] },
      ],
    },
    {
      id: 'ed-review',
      view: 'editor',
      label: 'ribbon.tab.review',
      groups: [
        { id: 'ed-rev-track', label: 'ribbon.group.track', items: ['track.suggest', 'track.next', 'track.accept', 'track.reject', 'track.acceptAll', 'track.rejectAll', 'track.importWord', 'review.rounds'] },
        { id: 'ed-rev-comments', label: 'ribbon.group.comments', items: ['comment.add', 'comment.search', 'comment.showResolved'] },
        { id: 'ed-rev-versions', label: 'ribbon.group.versions', items: ['vc.commit', 'vc.checkpoint', 'view.versions'] },
        { id: 'ed-rev-tools', label: 'ribbon.group.proofing', items: ['view.lineNumbers', 'tools.spellcheck', 'tools.counts'] },
      ],
    },
    {
      id: 'ed-layout',
      view: 'editor',
      label: 'ribbon.tab.layout',
      groups: [
        { id: 'ed-lay-page', label: 'ribbon.group.page', items: ['layout.paper', 'layout.margins', 'layout.columns'] },
        { id: 'ed-lay-tpl', label: 'ribbon.group.templates', items: ['tpl.manage', 'tpl.newFrom', 'tpl.saveAs', 'layout.masters'] },
        { id: 'ed-lay-type', label: 'ribbon.group.typography', items: ['layout.styles', 'layout.lineNumbersPdf'] },
        { id: 'ed-lay-out', label: 'ribbon.group.output', items: ['view.preview', 'file.export', 'file.exportPdf'] },
      ],
    },
    {
      id: 'ed-view',
      view: 'editor',
      label: 'ribbon.tab.view',
      groups: [
        { id: 'ed-view-panels', label: 'ribbon.group.panels', items: ['view.toggleLeft', 'view.outline', 'view.toggleRight', 'view.preview', 'view.source'] },
        { id: 'ed-view-mode', label: 'ribbon.group.mode', items: ['view.layoutPage', 'view.layoutBorderless', 'view.docHeader', 'view.rulers', 'view.focus', 'view.zen', 'view.fullscreen', 'view.zoomOut', 'view.zoomIn'] },
        { id: 'ed-view-theme', label: 'ribbon.group.theme', items: ['view.themeLight', 'view.themeDark', 'view.themeSystem', 'view.customizeRibbon'] },
      ],
    },

    // ----- risorse
    {
      id: 'res-home',
      view: 'resources',
      label: 'ribbon.tab.home',
      groups: [
        { id: 'res-add', label: 'ribbon.group.add', items: ['res.add', 'res.newSnippet', 'res.importBib'] },
        { id: 'res-views', label: 'ribbon.group.views', items: ['res.view.whiteboard', 'res.view.graph', 'res.view.layers'] },
        { id: 'res-org', label: 'ribbon.group.organize', items: ['res.newLayer', 'res.newFilter', 'res.tags', 'res.suggest', 'res.remove'] },
        { id: 'res-tools', label: 'ribbon.group.whiteboard', items: ['wb.select', 'wb.pan', 'wb.note', 'wb.frame', 'wb.activeDoc', 'wb.pickDocs', 'wb.connect', 'wb.fit'] },
        { id: 'res-search', label: 'ribbon.group.find', items: ['res.search'] },
      ],
    },

    // ----- versioni
    {
      id: 'vc-home',
      view: 'versions',
      label: 'ribbon.tab.home',
      groups: [
        { id: 'vc-commit', label: 'ribbon.group.commit', items: ['vc.commit', 'vc.checkpoint'] },
        { id: 'vc-branches', label: 'ribbon.group.branches', items: ['vc.newBranch', 'vc.switchBranch', 'vc.merge'] },
        { id: 'vc-history', label: 'ribbon.group.history', items: ['vc.compare', 'vc.restore'] },
        { id: 'vc-remote', label: 'ribbon.group.remote', items: ['vc.remote', 'vc.pull', 'vc.push'] },
      ],
    },
  ],
};

export type MenuEntry =
  | { cmd: string }
  | { sep: true }
  | { label: string; submenu: MenuEntry[] }
  | { dynamic: 'recentVaults' | 'documents' | 'workspaces' };

export interface MenuDef {
  id: string;
  label: string;
  items: MenuEntry[];
}

const c = (cmd: string): MenuEntry => ({ cmd });
const sep: MenuEntry = { sep: true };

export const MENUS: MenuDef[] = [
  {
    id: 'file',
    label: 'menu.file',
    items: [
      c('file.newDoc'),
      c('tpl.newFrom'),
      { label: 'menu.file.documents', submenu: [{ dynamic: 'documents' }] },
      sep,
      c('file.home'),
      c('file.openVault'),
      c('file.newVault'),
      c('file.newJournal'),
      c('file.journalToday'),
      { label: 'menu.file.recentVaults', submenu: [{ dynamic: 'recentVaults' }] },
      c('file.revealVault'),
      sep,
      c('file.save'),
      c('file.renameDoc'),
      c('file.duplicateDoc'),
      c('file.deleteDoc'),
      sep,
      c('file.export'),
      {
        label: 'menu.file.exportAs',
        submenu: [c('file.exportPdf'), c('file.exportDocx'), c('file.exportHtml'), c('file.exportMd'), c('file.exportTxt'), c('file.exportTex')],
      },
      c('file.print'),
      sep,
      c('file.docSettings'),
      sep,
      c('file.recensioCreate'),
      c('file.recensioOpen'),
    ],
  },
  {
    id: 'edit',
    label: 'menu.edit',
    items: [
      c('edit.undo'),
      c('edit.redo'),
      sep,
      c('edit.cut'),
      c('edit.copy'),
      c('edit.paste'),
      c('edit.pastePlain'),
      c('edit.selectAll'),
      sep,
      c('edit.find'),
      c('edit.replace'),
      c('edit.goToLine'),
      sep,
      { label: 'menu.edit.track', submenu: [c('track.suggest'), c('track.next'), c('track.accept'), c('track.reject'), sep, c('track.acceptAll'), c('track.rejectAll'), sep, c('track.importWord'), c('review.rounds')] },
    ],
  },
  {
    id: 'insert',
    label: 'menu.insert',
    items: [
      { label: 'menu.insert.headings', submenu: [c('insert.h1'), c('insert.h2'), c('insert.h3'), c('insert.paragraph')] },
      { label: 'menu.insert.lists', submenu: [c('insert.bulletList'), c('insert.orderedList'), c('insert.taskList')] },
      c('insert.table'),
      c('insert.image'),
      c('res.insert'),
      c('res.insertSnippet'),
      c('insert.quote'),
      c('insert.codeBlock'),
      c('insert.math'),
      c('insert.mathInline'),
      sep,
      c('cite.insert'),
      c('insert.footnote'),
      c('cite.bibliography'),
      c('comment.add'),
      sep,
      c('insert.link'),
      c('insert.wikilink'),
      sep,
      c('insert.hr'),
      c('insert.pageBreak'),
      c('insert.sectionBreak'),
      c('insert.toc'),
    ],
  },
  {
    id: 'format',
    label: 'menu.format',
    items: [
      c('fmt.bold'),
      c('fmt.italic'),
      c('fmt.underline'),
      c('fmt.strike'),
      c('fmt.highlight'),
      c('fmt.superscript'),
      c('fmt.subscript'),
      c('fmt.code'),
      sep,
      { label: 'menu.format.align', submenu: [c('fmt.alignLeft'), c('fmt.alignCenter'), c('fmt.alignRight'), c('fmt.alignJustify')] },
      c('fmt.indent'),
      c('fmt.outdent'),
      sep,
      c('fmt.clear'),
      sep,
      c('layout.styles'),
      c('layout.masters'),
    ],
  },
  {
    id: 'view',
    label: 'menu.view',
    items: [
      { label: 'menu.view.workspace', submenu: [{ dynamic: 'workspaces' }] },
      sep,
      c('view.resources'),
      c('view.editor'),
      c('view.versions'),
      c('view.library'),
      sep,
      c('view.toggleLeft'),
      c('view.outline'),
      c('view.toggleRight'),
      c('view.preview'),
      c('view.source'),
      c('view.lineNumbers'),
      c('view.focus'),
      c('view.zen'),
      { label: 'menu.view.editorLayout', submenu: [c('view.layoutPage'), c('view.layoutBorderless'), sep, c('view.rulers'), c('view.docHeader')] },
      sep,
      c('view.zoomIn'),
      c('view.zoomOut'),
      c('view.zoomReset'),
      { label: 'menu.view.theme', submenu: [c('view.themeLight'), c('view.themeDark'), c('view.themeSystem')] },
      sep,
      c('view.customizeRibbon'),
      c('view.ribbonSmall'),
      c('view.ribbonCollapse'),
      c('view.fullscreen'),
    ],
  },
  {
    id: 'versions',
    label: 'menu.versions',
    items: [c('vc.commit'), c('vc.checkpoint'), sep, c('vc.newBranch'), c('vc.switchBranch'), c('vc.merge'), sep, c('vc.compare'), c('vc.restore'), sep, c('vc.remote'), c('vc.pull'), c('vc.push')],
  },
  {
    id: 'resources',
    label: 'menu.resources',
    items: [
      c('res.add'),
      c('res.newSnippet'),
      c('res.importBib'),
      sep,
      c('res.view.whiteboard'),
      c('res.view.graph'),
      c('res.view.layers'),
      sep,
      c('res.newLayer'),
      c('res.newFilter'),
      c('res.tags'),
      c('res.suggest'),
      sep,
      c('res.remove'),
      sep,
      c('view.library'),
      c('cite.manage'),
    ],
  },
  { id: 'prefs', label: 'menu.preferences', items: [c('app.preferences'), c('file.docSettings'), c('doc.types'), c('view.customizeRibbon')] },
  { id: 'help', label: 'menu.help', items: [c('help.onboarding'), c('help.guide'), c('help.shortcuts'), c('help.markdown'), sep, c('help.about')] },
];
