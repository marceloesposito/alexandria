// Registro dei comandi: menu, ribbon, menu contestuali e scorciatoie usano gli stessi id.
import type { ComponentType } from 'react';
import type { View } from '../state/prefs';
import { effectiveShortcut, eventToShortcut, normalizeFor, type ShortcutOverrides } from './shortcuts';

export interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export interface Command {
  id: string;
  /** chiave i18n dell'etichetta */
  label: string;
  /** chiave i18n del suggerimento (facoltativa) */
  hint?: string;
  icon?: ComponentType<IconProps>;
  /** es. 'Mod+B', 'Mod+Shift+K', 'F11' */
  shortcut?: string;
  /** la scorciatoia e' gestita dall'editor (non dal gestore globale) */
  editorShortcut?: boolean;
  /** viste in cui ha senso (per il ribbon personalizzabile); assente = tutte */
  views?: View[];
  /** categoria per il pannello di personalizzazione */
  category: string;
  run: () => unknown;
  isActive?: () => boolean;
  isEnabled?: () => boolean;
  /** al posto del pulsante il ribbon mostra un controllo dedicato */
  widget?: string;
}

const commands = new Map<string, Command>();
const listeners = new Set<() => void>();
let version = 0;

export function registerCommands(list: Command[]) {
  for (const c of list) commands.set(c.id, c);
  version++;
  listeners.forEach((l) => l());
}

export function getCommand(id: string): Command | undefined {
  return commands.get(id);
}

export function allCommands(): Command[] {
  return [...commands.values()];
}

export function commandIds(): Set<string> {
  return new Set(commands.keys());
}

export function registryVersion(): number {
  return version;
}

export function onRegistryChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function runCommand(id: string): Promise<void> {
  const c = commands.get(id);
  if (!c) return;
  if (c.isEnabled && !c.isEnabled()) return;
  await c.run();
  // lo stato attivo/abilitato dei pulsanti dipende spesso dall'azione appena fatta
  notifyCommandState();
}

// --- stato dei pulsanti: i componenti si ri-disegnano quando cambia la selezione o il documento
const stateListeners = new Set<() => void>();
let stateTick = 0;
export function notifyCommandState() {
  stateTick++;
  stateListeners.forEach((l) => l());
}
export function onCommandState(cb: () => void): () => void {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}
export function commandStateTick(): number {
  return stateTick;
}

// --- scorciatoie (predefinite nei comandi, modificabili dall'utente: `shortcuts.ts`)
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

let overrides: ShortcutOverrides = {};

/** Modifiche dell'utente alle scorciatoie (dallo stato dell'app). */
export function setShortcutOverrides(o: ShortcutOverrides) {
  overrides = o;
  version++;
  listeners.forEach((l) => l());
}

export function getShortcutOverrides(): ShortcutOverrides {
  return overrides;
}

/** Scorciatoia in uso per un comando (quella scelta dall'utente o la predefinita). */
export function shortcutOf(cmd: Command | undefined): string | undefined {
  return cmd ? effectiveShortcut(cmd, overrides) : undefined;
}

export function normalizeShortcut(s: string): string {
  return normalizeFor(s, isMac);
}

export function eventShortcut(e: KeyboardEvent): string {
  return eventToShortcut(e);
}

export function displayShortcut(s: string): string {
  const n = normalizeShortcut(s);
  if (!isMac) return n;
  return n.replace('Meta', '⌘').replace('Ctrl', '⌃').replace('Alt', '⌥').replace('Shift', '⇧').replace(/\+(?!$)/g, '');
}

/** Comando per un tasto (in forma di piattaforma), con le scorciatoie in uso. */
export function commandForKey(key: string, skipEditorShortcuts = false): Command | undefined {
  for (const c of commands.values()) {
    const s = shortcutOf(c);
    if (!s) continue;
    // nell'editor le scorciatoie predefinite di formattazione le esegue TipTap
    if (skipEditorShortcuts && c.editorShortcut && !Object.prototype.hasOwnProperty.call(overrides, c.id)) continue;
    if (normalizeShortcut(s) === key) return c;
  }
  return undefined;
}

/** Filtro delle scorciatoie (es. la copia per revisione blocca i comandi che cambiano il Compendium). */
let guard: (id: string) => boolean = () => true;
export function setShortcutGuard(g: (id: string) => boolean) {
  guard = g;
}
export function shortcutAllowed(id: string): boolean {
  return guard(id);
}

export function findByShortcut(e: KeyboardEvent, inEditor: boolean): Command | undefined {
  return commandForKey(eventShortcut(e), inEditor);
}
