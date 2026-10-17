// Comandi di Folium e dove stanno sullo schermo. Regola: un'azione, un controllo. Ogni comando ha
// una sola "casa" (una superficie dell'interfaccia) oppure nessuna, e allora si raggiunge per nome
// (⌘K, "/", scorciatoie). Le superfici disegnano i loro controlli da qui; un test controlla che
// nessun id compaia due volte e che ogni comando sia raggiungibile.

/**
 * header       barra in alto (L0)
 * crumb        popover del titolo del foglio (L1)
 * bar          barretta in basso nello Scriptorium e i suoi popover (L0/L1)
 * tabulaBar    barretta della Tabula
 * versionsBar  barretta del Palimpsestus
 * context      clic destro (nel testo o su un blocco)
 * thread       nuvoletta di un commento
 * panel        pannelli Fogli e Index
 * appMenu      menu dell'app (✦)
 * none         solo per nome: ⌘K, scorciatoia
 */
export type Home = 'header' | 'crumb' | 'bar' | 'tabulaBar' | 'versionsBar' | 'context' | 'thread' | 'panel' | 'appMenu' | 'none';

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
  { id: 'app.menu', label: 'cmd.app.menu', home: 'header', palette: false },
  { id: 'panel.sheets', label: 'cmd.panel.sheets', home: 'header', shortcut: 'Mod+Shift+E' },
  { id: 'panel.index', label: 'cmd.panel.index', home: 'header', shortcut: 'Mod+Shift+I' },
  { id: 'view.write', label: 'cmd.view.write', home: 'header', shortcut: 'Mod+1' },
  { id: 'view.both', label: 'cmd.view.both', home: 'header', shortcut: 'Mod+2' },
  { id: 'view.tabula', label: 'cmd.view.tabula', home: 'header', shortcut: 'Mod+3' },
  { id: 'view.versions', label: 'cmd.view.versions', home: 'header', shortcut: 'Mod+4' },
  { id: 'sheet.menu', label: 'cmd.sheet.menu', home: 'header', palette: false },
  { id: 'palette.open', label: 'cmd.palette.open', home: 'header', shortcut: 'Mod+K', palette: false },

  // popover del titolo
  { id: 'sheet.rename', label: 'cmd.sheet.rename', home: 'crumb' },
  { id: 'sheet.saveAs', label: 'cmd.sheet.saveAs', home: 'crumb', shortcut: 'Mod+Shift+S' },
  { id: 'sheet.exportDocx', label: 'cmd.sheet.exportDocx', home: 'crumb' },
  { id: 'sheet.exportPdf', label: 'cmd.sheet.exportPdf', home: 'crumb', shortcut: 'Mod+P' },
  { id: 'sheet.toCompendium', label: 'cmd.sheet.toCompendium', home: 'crumb' },

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
  { id: 'text.color', label: 'cmd.text.color', home: 'bar', palette: false },
  { id: 'text.insert', label: 'cmd.text.insert', home: 'bar', palette: false },
  { id: 'timer.toggle', label: 'cmd.timer.toggle', home: 'bar', shortcut: 'Mod+Alt+T' },
  { id: 'counts.open', label: 'cmd.counts.open', home: 'bar', palette: false },

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

  // menu dell'app
  { id: 'app.prefs', label: 'cmd.app.prefs', home: 'appMenu', shortcut: 'Mod+,' },
  { id: 'app.help', label: 'cmd.app.help', home: 'appMenu' },
  { id: 'app.about', label: 'cmd.app.about', home: 'appMenu' },
  { id: 'app.quit', label: 'cmd.app.quit', home: 'appMenu' },

  // solo per nome
  { id: 'silentium.toggle', label: 'cmd.silentium.toggle', home: 'none', shortcut: 'Mod+Shift+D' },
  { id: 'timer.skip', label: 'cmd.timer.skip', home: 'none' },
  { id: 'timer.reset', label: 'cmd.timer.reset', home: 'none' },
  { id: 'zoom.in', label: 'cmd.zoom.in', home: 'none', shortcut: 'Mod+=' },
  { id: 'zoom.out', label: 'cmd.zoom.out', home: 'none', shortcut: 'Mod+-' },
  { id: 'zoom.reset', label: 'cmd.zoom.reset', home: 'none', shortcut: 'Mod+0' },
];

/** Controlli sempre visibili (L0) per superficie, in ordine. Il segmentato delle viste e' uno solo. */
export const L0: Record<'header' | 'bar' | 'tabulaBar' | 'versionsBar', string[][]> = {
  header: [['app.menu'], ['panel.sheets'], ['panel.index'], ['view.write', 'view.both', 'view.tabula', 'view.versions'], ['sheet.menu'], ['palette.open']],
  bar: [['text.style'], ['text.bold', 'text.italic', 'text.underline', 'text.strike'], ['text.color'], ['text.insert'], ['timer.toggle'], ['counts.open']],
  tabulaBar: [['tabula.add'], ['tabula.find'], ['tabula.zoomOut', 'tabula.zoomIn', 'tabula.fit']],
  versionsBar: [['version.save'], ['version.resume']],
};

export function specOf(id: string): CommandSpec | undefined {
  return COMMANDS.find((c) => c.id === id);
}

export function inHome(home: Home): CommandSpec[] {
  return COMMANDS.filter((c) => c.home === home);
}
