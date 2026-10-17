// Cosa fa ogni comando di Folium (le "case" stanno in commandSpecs.ts). Le superfici chiamano
// runCommand(id); ⌘K e le scorciatoie usano lo stesso elenco.
import { COMMANDS, specOf } from './commandSpecs';
import { useFolium } from './store';
import { getEditor } from './editor/editorRef';
import { useUi } from './ui';
import { startComment } from './comments/store';
import { editLink } from './editor/insertItems';
import { useTimer } from './timer/store';
import { matches } from './keys';
import type { SheetView } from './format';

type Runner = { run: () => unknown; active?: () => boolean };

const setView = (view: SheetView) => () => {
  useFolium.getState().setMeta({ view });
  useUi.setState({ popover: null });
};

const zoomBy = (d: number) => () => {
  const z = Math.round(Math.min(2, Math.max(0.6, useFolium.getState().app.zoom + d)) * 10) / 10;
  useFolium.getState().setApp({ zoom: z });
};

const togglePanel = (p: 'sheets' | 'index') => () => {
  const st = useFolium.getState();
  st.setApp({ panel: st.app.panel === p ? null : p });
};

const lazy =
  <T,>(load: () => Promise<T>, call: (m: T) => unknown) =>
  () =>
    void load().then(call);

const RUN: Record<string, Runner> = {
  'app.menu': { run: () => useUi.getState().toggle('appMenu') },
  'panel.sheets': { run: togglePanel('sheets'), active: () => useFolium.getState().app.panel === 'sheets' },
  'panel.index': { run: togglePanel('index'), active: () => useFolium.getState().app.panel === 'index' },
  'view.write': { run: setView('write'), active: () => useFolium.getState().sheet?.meta.view === 'write' },
  'view.both': { run: setView('both'), active: () => useFolium.getState().sheet?.meta.view === 'both' },
  'view.tabula': { run: setView('tabula'), active: () => useFolium.getState().sheet?.meta.view === 'tabula' },
  'view.versions': { run: setView('versions'), active: () => useFolium.getState().sheet?.meta.view === 'versions' },
  'sheet.menu': { run: () => useUi.getState().toggle('crumb') },
  'palette.open': { run: () => useUi.getState().setPalette(!useUi.getState().palette) },

  'sheet.rename': { run: lazy(() => import('./actions'), (m) => m.renameSheet()) },
  'sheet.saveAs': { run: lazy(() => import('./actions'), (m) => m.saveAs()) },
  'sheet.exportDocx': { run: lazy(() => import('./exportDoc'), (m) => m.exportDocx()) },
  'sheet.exportPdf': { run: lazy(() => import('./exportDoc'), (m) => m.exportPdf()) },
  'sheet.toCompendium': { run: lazy(() => import('./actions'), (m) => m.toCompendium()) },

  'sheet.new': { run: () => void useFolium.getState().createNew() },
  'sheet.open': { run: lazy(() => import('./actions'), (m) => m.openFiles()) },
  'sheet.delete': { run: lazy(() => import('./actions'), (m) => m.deleteSheet(useFolium.getState().sheet?.meta.id ?? '')) },

  'text.style': { run: () => useUi.getState().toggle('style') },
  'text.bold': { run: () => getEditor()?.chain().focus().toggleBold().run(), active: () => !!getEditor()?.isActive('bold') },
  'text.italic': { run: () => getEditor()?.chain().focus().toggleItalic().run(), active: () => !!getEditor()?.isActive('italic') },
  'text.underline': { run: () => getEditor()?.chain().focus().toggleUnderline().run(), active: () => !!getEditor()?.isActive('underline') },
  'text.strike': { run: () => getEditor()?.chain().focus().toggleStrike().run(), active: () => !!getEditor()?.isActive('strike') },
  'text.color': { run: () => useUi.getState().toggle('color') },
  'text.insert': { run: () => useUi.getState().toggle('insert') },
  'timer.toggle': { run: () => useTimer.getState().toggle(), active: () => useTimer.getState().state.since !== null },
  'counts.open': { run: () => useUi.getState().toggle('counts') },

  'tabula.add': { run: () => useUi.getState().toggle('tabulaAdd') },
  'tabula.find': { run: () => useUi.getState().toggle('tabulaFind') },
  'tabula.zoomOut': { run: () => useUi.getState().tabula?.zoomOut() },
  'tabula.zoomIn': { run: () => useUi.getState().tabula?.zoomIn() },
  'tabula.fit': { run: () => useUi.getState().tabula?.fit() },

  'version.save': { run: lazy(() => import('./actions'), (m) => m.saveNamedVersion()) },
  'version.resume': { run: lazy(() => import('./actions'), (m) => m.resumeSelected()) },

  'comment.add': {
    run: () => {
      const e = getEditor();
      if (e) startComment(e);
    },
  },
  'edit.link': {
    run: () => {
      const e = getEditor();
      if (e) void editLink(e);
    },
  },
  'edit.cut': { run: () => document.execCommand('cut') },
  'edit.copy': { run: () => document.execCommand('copy') },
  'edit.paste': { run: () => getEditor()?.commands.focus() },
  'block.edit': { run: () => undefined },
  'block.delete': { run: () => undefined },
  'comment.reply': { run: () => undefined },
  'comment.resolve': { run: () => undefined },
  'comment.delete': { run: () => undefined },

  'app.prefs': { run: () => useUi.getState().setDialog('prefs') },
  'app.help': { run: () => useUi.getState().setDialog('help') },
  'app.about': { run: () => useUi.getState().setDialog('about') },
  'app.quit': { run: lazy(() => import('./actions'), (m) => m.quit()) },

  'silentium.toggle': { run: () => useFolium.getState().setSilentium(!useFolium.getState().silentium), active: () => useFolium.getState().silentium },
  'timer.skip': { run: () => useTimer.getState().skip() },
  'timer.reset': { run: () => useTimer.getState().reset() },
  'zoom.in': { run: zoomBy(0.1) },
  'zoom.out': { run: zoomBy(-0.1) },
  'zoom.reset': { run: () => useFolium.getState().setApp({ zoom: 1 }) },
};

export function runCommand(id: string) {
  RUN[id]?.run();
}

export function isActive(id: string): boolean {
  return RUN[id]?.active?.() ?? false;
}

/** Comandi da proporre in ⌘K. */
export function paletteCommands() {
  return COMMANDS.filter((c) => c.palette !== false && RUN[c.id]);
}

/** Scorciatoie globali; quelle del testo (grassetto...) le gestisce gia' l'editor. */
const EDITOR_KEYS = new Set(['text.bold', 'text.italic', 'text.underline', 'text.strike']);

export function handleGlobalKey(e: KeyboardEvent): boolean {
  for (const c of COMMANDS) {
    if (!c.shortcut || EDITOR_KEYS.has(c.id) || !matches(e, c.shortcut)) continue;
    e.preventDefault();
    runCommand(c.id);
    return true;
  }
  return false;
}

export function hasRunner(id: string): boolean {
  return !!RUN[id] && !!specOf(id);
}
