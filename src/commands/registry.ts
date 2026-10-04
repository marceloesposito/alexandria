// Registro dei comandi: menu, ribbon, menu contestuali e scorciatoie usano gli stessi id.
import type { ComponentType } from 'react';
import type { View } from '../state/prefs';

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

// --- scorciatoie
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function normalizeShortcut(s: string): string {
  return s
    .split('+')
    .map((p) => p.trim())
    .map((p) => (p === 'Mod' ? (isMac ? 'Meta' : 'Ctrl') : p))
    .map((p) => (p.length === 1 ? p.toUpperCase() : p))
    .sort((a, b) => order(a) - order(b))
    .join('+');
}

function order(p: string): number {
  return ['Ctrl', 'Meta', 'Alt', 'Shift'].indexOf(p) === -1 ? 9 : ['Ctrl', 'Meta', 'Alt', 'Shift'].indexOf(p);
}

export function eventShortcut(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.metaKey) parts.push('Meta');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  let k = e.key;
  if (k === ' ') k = 'Space';
  if (k.length === 1) k = k.toUpperCase();
  if (!['Control', 'Meta', 'Alt', 'Shift'].includes(k)) parts.push(k);
  return parts.join('+');
}

export function displayShortcut(s: string): string {
  const n = normalizeShortcut(s);
  if (!isMac) return n;
  return n.replace('Meta', '⌘').replace('Ctrl', '⌃').replace('Alt', '⌥').replace('Shift', '⇧').replace(/\+/g, '');
}

export function findByShortcut(e: KeyboardEvent, inEditor: boolean): Command | undefined {
  const key = eventShortcut(e);
  for (const c of commands.values()) {
    if (!c.shortcut) continue;
    if (inEditor && c.editorShortcut) continue;
    if (normalizeShortcut(c.shortcut) === key) return c;
  }
  return undefined;
}
