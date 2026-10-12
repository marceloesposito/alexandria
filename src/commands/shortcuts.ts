// Scorciatoie da tastiera personalizzabili. Ogni comando ha la sua scorciatoia predefinita
// (`Command.shortcut`); l'utente puo' cambiarla o toglierla dalle Preferenze. Si salvano solo le
// modifiche, in forma portabile ("Mod" = Cmd su Mac, Ctrl altrove), nello stato dell'app.

/** Modifiche dell'utente: nuova scorciatoia, oppure null = nessuna scorciatoia. */
export type ShortcutOverrides = Record<string, string | null>;

/** Quel che serve di un comando per ragionare sulle scorciatoie. */
export interface ShortcutCommand {
  id: string;
  shortcut?: string;
}

const MODS = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'];

function modOrder(p: string): number {
  const i = MODS.indexOf(p);
  return i === -1 ? 9 : i;
}

/** Forma confrontabile su una piattaforma: "Mod" diventa Meta (Mac) o Ctrl, modificatori in ordine. */
export function normalizeFor(s: string, mac: boolean): string {
  return splitShortcut(s)
    .map((p) => (p === 'Mod' ? (mac ? 'Meta' : 'Ctrl') : p))
    .map((p) => (p.length === 1 ? p.toUpperCase() : p))
    .sort((a, b) => modOrder(a) - modOrder(b))
    .join('+');
}

/** "Mod+Shift+B" -> parti; il tasto "+" resta un tasto ("Mod++"). */
function splitShortcut(s: string): string[] {
  const parts = s.split('+').map((p) => p.trim());
  // "Mod++": l'ultima parte vuota e' il tasto "+"
  if (parts.length > 1 && parts[parts.length - 1] === '' && parts[parts.length - 2] === '') return [...parts.slice(0, -2), '+'];
  return parts.filter((p) => p !== '');
}

/** Nome del tasto: lettere e cifre dalla posizione fisica quando Alt/Shift le trasformano (⌥B = "∫", ⇧9 = "("). */
export function keyName(e: Pick<KeyboardEvent, 'key' | 'code'>): string {
  const k = e.key;
  if (k === ' ') return 'Space';
  if (k.length === 1 && /[a-z0-9]/i.test(k)) return k.toUpperCase();
  const m = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(e.code ?? '');
  if (m) return m[1] ?? m[2];
  return k.length === 1 ? k.toUpperCase() : k;
}

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;

/** Il tasto premuto in forma di piattaforma (Ctrl/Meta espliciti), come `normalizeFor`. */
export function eventToShortcut(e: KeyEventLike): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.metaKey) parts.push('Meta');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const k = keyName(e);
  if (!['Control', 'Meta', 'Alt', 'Shift', 'OS'].includes(k)) parts.push(k);
  return parts.join('+');
}

/** Il tasto premuto in forma portabile, da salvare: Cmd (Mac) o Ctrl (altrove) diventano "Mod". */
export function shortcutFromEvent(e: KeyEventLike, mac: boolean): string {
  return eventToShortcut(e)
    .split('+')
    .map((p) => (p === (mac ? 'Meta' : 'Ctrl') ? 'Mod' : p))
    .sort((a, b) => modOrder(a) - modOrder(b))
    .join('+');
}

export type ShortcutProblem = 'incomplete' | 'needsModifier' | 'reserved';

/** Scorciatoie che il sistema si tiene (chiudere, uscire, cambiare finestra). */
const RESERVED = ['Mod+Q', 'Mod+W', 'Mod+Tab', 'Alt+Tab', 'Alt+F4'];

/** null se la scorciatoia si puo' usare, altrimenti il motivo. */
export function validateShortcut(s: string, mac: boolean): ShortcutProblem | null {
  const parts = splitShortcut(s);
  const key = parts.find((p) => !MODS.includes(p));
  if (!key) return 'incomplete';
  const hasMod = parts.some((p) => p === 'Mod' || p === 'Ctrl' || p === 'Meta' || p === 'Alt');
  if (!hasMod && !/^F([1-9]|1[0-9])$/.test(key)) return 'needsModifier';
  const n = normalizeFor(s, mac);
  if (RESERVED.some((r) => normalizeFor(r, mac) === n)) return 'reserved';
  return null;
}

/** Scorciatoia in uso per un comando: quella scelta dall'utente, altrimenti la predefinita. */
export function effectiveShortcut(cmd: ShortcutCommand, overrides: ShortcutOverrides): string | undefined {
  if (Object.prototype.hasOwnProperty.call(overrides, cmd.id)) return overrides[cmd.id] ?? undefined;
  return cmd.shortcut;
}

/** Comandi (diversi da `id`) che usano gia' la scorciatoia `s`. */
export function conflictsFor(id: string, s: string, cmds: readonly ShortcutCommand[], overrides: ShortcutOverrides, mac: boolean): string[] {
  const n = normalizeFor(s, mac);
  return cmds.filter((c) => c.id !== id && effectiveShortcut(c, overrides) && normalizeFor(effectiveShortcut(c, overrides)!, mac) === n).map((c) => c.id);
}

/** Dato il comando, la sua nuova scorciatoia (null = nessuna) tolta a chi la usava gia'. */
export function assignShortcut(
  overrides: ShortcutOverrides,
  id: string,
  s: string | null,
  cmds: readonly ShortcutCommand[],
  mac: boolean,
): ShortcutOverrides {
  const out: ShortcutOverrides = { ...overrides };
  if (s) for (const other of conflictsFor(id, s, cmds, overrides, mac)) setOverride(out, other, null, cmds);
  setOverride(out, id, s, cmds);
  return out;
}

/** Torna alla predefinita (se quella e' presa da un altro comando, l'altro la perde). */
export function resetShortcut(overrides: ShortcutOverrides, id: string, cmds: readonly ShortcutCommand[], mac: boolean): ShortcutOverrides {
  const def = cmds.find((c) => c.id === id)?.shortcut ?? null;
  return assignShortcut(overrides, id, def, cmds, mac);
}

/** Salva solo le differenze dalla predefinita. */
function setOverride(out: ShortcutOverrides, id: string, s: string | null, cmds: readonly ShortcutCommand[]) {
  const def = cmds.find((c) => c.id === id)?.shortcut ?? null;
  if ((s ?? null) === def) delete out[id];
  else out[id] = s;
}

/** Modifiche lette dallo stato salvato (scarta valori malformati). */
export function normalizeOverrides(raw: unknown): ShortcutOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ShortcutOverrides = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === null || (typeof v === 'string' && v.trim())) out[k] = v as string | null;
  }
  return out;
}

/**
 * Tasti che l'editor deve gestire da se' perche' l'utente li ha cambiati: le scorciatoie nuove di
 * qualunque comando modificato e quelle predefinite tolte ai comandi dell'editor (che altrimenti la
 * keymap di TipTap continuerebbe a eseguire). Forma di piattaforma (`normalizeFor`).
 */
export function editorManagedKeys(cmds: readonly (ShortcutCommand & { editorShortcut?: boolean })[], overrides: ShortcutOverrides, mac: boolean): Set<string> {
  const keys = new Set<string>();
  for (const c of cmds) {
    if (!Object.prototype.hasOwnProperty.call(overrides, c.id)) continue;
    const s = overrides[c.id];
    if (s) keys.add(normalizeFor(s, mac));
    if (c.editorShortcut && c.shortcut) keys.add(normalizeFor(c.shortcut, mac));
  }
  return keys;
}
