// Comandi di Column e dove stanno sullo schermo. Regola: un'azione, un controllo. Ogni comando ha
// una sola "casa" (una superficie dell'interfaccia) oppure nessuna, e allora si raggiunge per nome
// (⌘K, "/", scorciatoie). Le superfici disegnano i loro controlli da qui; un test controlla che
// nessun id compaia due volte e che ogni comando sia raggiungibile.

/**
 * header       in alto a sinistra: il nome del foglio (L0)
 * edgeTab      strisce sui bordi: Tabula a sinistra, Palimpsestus a destra (L0)
 * bar          barretta (libera o agganciata in alto) e i suoi popover (L0/L1)
 * tabulaBar    barretta della Tabula
 * versionsBar  barretta del Palimpsestus
 * context      clic destro (nel testo o su un blocco)
 * thread       nuvoletta di un commento
 * panel        pannelli Fogli e Index
 * none         solo per nome: ⌘K, scorciatoia
 */
export type Home = 'header' | 'edgeTab' | 'bar' | 'tabulaBar' | 'versionsBar' | 'context' | 'thread' | 'panel' | 'none';

export interface CommandSpec {
  id: string;
  /** chiave i18n */
  label: string;
  home: Home;
  /** "Mod" = Cmd su Mac, Ctrl altrove */
  shortcut?: string;
  /** compare in ⌘K (predefinito: si') */
  palette?: boolean;
}

export const COMMANDS: CommandSpec[] = [
  // barra in alto
  // in alto a sinistra: il nome del foglio, che si modifica con un clic
  { id: 'sheet.rename', label: 'cmd.sheet.rename', home: 'header', shortcut: 'Mod+R' },

  // strisce sui bordi: la Tabula a sinistra, il Palimpsestus a destra
  { id: 'tabula.toggle', label: 'cmd.tabula.toggle', home: 'edgeTab', shortcut: 'Mod+1' },
  { id: 'versions.toggle', label: 'cmd.versions.toggle', home: 'edgeTab', shortcut: 'Mod+2' },

  // solo per nome (⌘K) e scorciatoie
  { id: 'palette.open', label: 'cmd.palette.open', home: 'none', shortcut: 'Mod+K', palette: false },
  { id: 'panel.sheets', label: 'cmd.panel.sheets', home: 'none', shortcut: 'Mod+Shift+E' },
  { id: 'panel.index', label: 'cmd.panel.index', home: 'none', shortcut: 'Mod+Shift+I' },

  // pannello Fogli
  { id: 'sheet.new', label: 'cmd.sheet.new', home: 'panel', shortcut: 'Mod+N' },
  { id: 'sheet.open', label: 'cmd.sheet.open', home: 'panel', shortcut: 'Mod+O' },
  { id: 'sheet.delete', label: 'cmd.sheet.delete', home: 'panel', palette: false },

  // barretta dello Scriptorium
  { id: 'text.style', label: 'cmd.text.style', home: 'bar', palette: false },
  { id: 'text.bold', label: 'cmd.text.bold', home: 'bar', shortcut: 'Mod+B' },
  { id: 'text.italic', label: 'cmd.text.italic', home: 'bar', shortcut: 'Mod+I' },
  { id: 'text.underline', label: 'cmd.text.underline', home: 'bar', shortcut: 'Mod+U' },
  { id: 'text.strike', label: 'cmd.text.strike', home: 'bar', shortcut: 'Mod+Shift+X' },
  { id: 'text.align', label: 'cmd.text.align', home: 'bar', palette: false },
  { id: 'text.color', label: 'cmd.text.color', home: 'bar', palette: false },
  { id: 'text.insert', label: 'cmd.text.insert', home: 'bar', palette: false },
  { id: 'timer.toggle', label: 'cmd.timer.toggle', home: 'bar', shortcut: 'Mod+Alt+T' },
  { id: 'counts.open', label: 'cmd.counts.open', home: 'bar', palette: false },
  { id: 'export.menu', label: 'cmd.export.menu', home: 'bar', palette: false },
  // nel menu dell'export (L1)
  { id: 'sheet.exportDocx', label: 'cmd.sheet.exportDocx', home: 'bar' },
  { id: 'sheet.exportPdf', label: 'cmd.sheet.exportPdf', home: 'bar', shortcut: 'Mod+P' },
  { id: 'sheet.saveAs', label: 'cmd.sheet.saveAs', home: 'bar', shortcut: 'Mod+Shift+S' },
  { id: 'sheet.toCompendium', label: 'cmd.sheet.toCompendium', home: 'bar' },

  // barretta della Tabula
  { id: 'tabula.add', label: 'cmd.tabula.add', home: 'tabulaBar', palette: false },
  { id: 'tabula.find', label: 'cmd.tabula.find', home: 'tabulaBar', palette: false },
  { id: 'tabula.zoomOut', label: 'cmd.tabula.zoomOut', home: 'tabulaBar', palette: false },
  { id: 'tabula.zoomIn', label: 'cmd.tabula.zoomIn', home: 'tabulaBar', palette: false },
  { id: 'tabula.fit', label: 'cmd.tabula.fit', home: 'tabulaBar' },

  // barretta del Palimpsestus
  { id: 'version.save', label: 'cmd.version.save', home: 'versionsBar', shortcut: 'Mod+Shift+V' },
  { id: 'version.resume', label: 'cmd.version.resume', home: 'versionsBar', palette: false },

  // clic destro
  { id: 'comment.add', label: 'cmd.comment.add', home: 'context', shortcut: 'Mod+Alt+M' },
  { id: 'edit.link', label: 'cmd.edit.link', home: 'context', shortcut: 'Mod+L' },
  { id: 'edit.cut', label: 'cmd.edit.cut', home: 'context', palette: false },
  { id: 'edit.copy', label: 'cmd.edit.copy', home: 'context', palette: false },
  { id: 'edit.paste', label: 'cmd.edit.paste', home: 'context', palette: false },
  { id: 'block.edit', label: 'cmd.block.edit', home: 'context', palette: false },
  { id: 'block.delete', label: 'cmd.block.delete', home: 'context', palette: false },

  // nuvoletta di un commento
  { id: 'comment.reply', label: 'cmd.comment.reply', home: 'thread', palette: false },
  { id: 'comment.resolve', label: 'cmd.comment.resolve', home: 'thread', palette: false },
  { id: 'comment.delete', label: 'cmd.comment.delete', home: 'thread', palette: false },

  // dell'app (per nome)
  { id: 'app.prefs', label: 'cmd.app.prefs', home: 'none', shortcut: 'Mod+,' },
  { id: 'app.help', label: 'cmd.app.help', home: 'none' },
  { id: 'app.about', label: 'cmd.app.about', home: 'none' },
  { id: 'app.quit', label: 'cmd.app.quit', home: 'none', shortcut: 'Mod+Q' },

  // solo per nome
  { id: 'silentium.toggle', label: 'cmd.silentium.toggle', home: 'none', shortcut: 'Mod+Shift+D' },
  { id: 'text.align.left', label: 'cmd.text.align.left', home: 'none' },
  { id: 'text.align.center', label: 'cmd.text.align.center', home: 'none' },
  { id: 'text.align.right', label: 'cmd.text.align.right', home: 'none' },
  { id: 'focus.toggle', label: 'cmd.focus.toggle', home: 'none' },
  { id: 'timer.skip', label: 'cmd.timer.skip', home: 'none' },
  { id: 'timer.reset', label: 'cmd.timer.reset', home: 'none' },
  { id: 'zoom.in', label: 'cmd.zoom.in', home: 'none', shortcut: 'Mod+=' },
  { id: 'zoom.out', label: 'cmd.zoom.out', home: 'none', shortcut: 'Mod+-' },
  { id: 'zoom.reset', label: 'cmd.zoom.reset', home: 'none', shortcut: 'Mod+0' },
];

/** Controlli sempre visibili (L0) per superficie, in ordine. Il segmentato delle viste e' uno solo. */
export const L0: Record<'header' | 'edgeTab' | 'bar' | 'tabulaBar' | 'versionsBar', string[][]> = {
  header: [['sheet.rename']],
  edgeTab: [['tabula.toggle'], ['versions.toggle']],
  bar: [['text.style'], ['text.bold', 'text.italic', 'text.underline', 'text.strike', 'text.align'], ['text.color'], ['text.insert'], ['timer.toggle'], ['counts.open'], ['export.menu', 'sheet.exportDocx', 'sheet.exportPdf', 'sheet.saveAs', 'sheet.toCompendium']],
  tabulaBar: [['tabula.add'], ['tabula.find'], ['tabula.zoomOut', 'tabula.zoomIn', 'tabula.fit']],
  versionsBar: [['version.save'], ['version.resume']],
};

export function specOf(id: string): CommandSpec | undefined {
  return COMMANDS.find((c) => c.id === id);
}

export function inHome(home: Home): CommandSpec[] {
  return COMMANDS.filter((c) => c.home === home);
}
