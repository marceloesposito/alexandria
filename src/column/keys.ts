// Scorciatoie da tastiera: "Mod" e' Cmd su Mac e Ctrl altrove.
import { eventToShortcut, normalizeFor } from 'logos/commands/shortcuts';

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const MAC_SYMBOL: Record<string, string> = { Meta: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧' };

/** Testo da mostrare per una scorciatoia ("Mod+Shift+K" -> "⌘⇧K" o "Ctrl+Shift+K"). */
export function shortcutLabel(s: string): string {
  const norm = normalizeFor(s, isMac);
  if (!isMac) return norm;
  return norm
    .split('+')
    .map((p) => MAC_SYMBOL[p] ?? p)
    .join('');
}

export function matches(e: KeyboardEvent, shortcut: string): boolean {
  return normalizeFor(eventToShortcut(e), isMac) === normalizeFor(shortcut, isMac);
}
