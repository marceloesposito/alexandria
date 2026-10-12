import { describe, expect, it } from 'vitest';
import {
  normalizeFor,
  shortcutFromEvent,
  eventToShortcut,
  validateShortcut,
  effectiveShortcut,
  conflictsFor,
  assignShortcut,
  resetShortcut,
  normalizeOverrides,
  editorManagedKeys,
} from './shortcuts';

const ev = (key: string, code: string, m: { ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean } = {}) => ({
  key,
  code,
  ctrlKey: !!m.ctrl,
  metaKey: !!m.meta,
  altKey: !!m.alt,
  shiftKey: !!m.shift,
});

const cmds = [
  { id: 'fmt.bold', shortcut: 'Mod+B', editorShortcut: true },
  { id: 'fmt.italic', shortcut: 'Mod+I', editorShortcut: true },
  { id: 'file.save', shortcut: 'Mod+S' },
  { id: 'view.zen' },
];

describe('forma delle scorciatoie', () => {
  it('Mod e\' Cmd su Mac e Ctrl altrove', () => {
    expect(normalizeFor('Mod+Shift+b', true)).toBe('Meta+Shift+B');
    expect(normalizeFor('Shift+Mod+B', false)).toBe('Ctrl+Shift+B');
    expect(normalizeFor('Mod++', false)).toBe('Ctrl++');
  });
  it('dal tasto premuto alla forma portabile', () => {
    expect(shortcutFromEvent(ev('b', 'KeyB', { meta: true, shift: true }), true)).toBe('Mod+Shift+B');
    expect(shortcutFromEvent(ev('b', 'KeyB', { ctrl: true }), false)).toBe('Mod+B');
    // su Mac Ctrl resta Ctrl
    expect(shortcutFromEvent(ev('b', 'KeyB', { ctrl: true }), true)).toBe('Ctrl+B');
  });
  it('Alt e Shift che trasformano il carattere: conta il tasto fisico', () => {
    expect(eventToShortcut(ev('∫', 'KeyB', { meta: true, alt: true }))).toBe('Meta+Alt+B');
    expect(eventToShortcut(ev('(', 'Digit9', { ctrl: true, shift: true }))).toBe('Ctrl+Shift+9');
    expect(eventToShortcut(ev('.', 'Period', { ctrl: true }))).toBe('Ctrl+.');
    expect(eventToShortcut(ev('Shift', 'ShiftLeft', { shift: true }))).toBe('Shift');
  });
});

describe('validazione', () => {
  it('serve un modificatore, salvo i tasti funzione', () => {
    expect(validateShortcut('B', false)).toBe('needsModifier');
    expect(validateShortcut('Shift+B', false)).toBe('needsModifier');
    expect(validateShortcut('F5', false)).toBeNull();
    expect(validateShortcut('Mod+Shift', false)).toBe('incomplete');
    expect(validateShortcut('Alt+B', true)).toBeNull();
  });
  it('quelle del sistema no', () => {
    expect(validateShortcut('Mod+Q', true)).toBe('reserved');
    expect(validateShortcut('Mod+W', false)).toBe('reserved');
  });
});

describe('assegnazione', () => {
  it('scorciatoia in uso: la modifica, altrimenti la predefinita', () => {
    expect(effectiveShortcut(cmds[0], {})).toBe('Mod+B');
    expect(effectiveShortcut(cmds[0], { 'fmt.bold': 'Mod+Shift+B' })).toBe('Mod+Shift+B');
    expect(effectiveShortcut(cmds[0], { 'fmt.bold': null })).toBeUndefined();
  });
  it('conflitto: la scorciatoia passa al nuovo comando e l\'altro la perde', () => {
    expect(conflictsFor('view.zen', 'Mod+S', cmds, {}, true)).toEqual(['file.save']);
    const o = assignShortcut({}, 'view.zen', 'Mod+S', cmds, true);
    expect(o).toEqual({ 'view.zen': 'Mod+S', 'file.save': null });
    expect(effectiveShortcut(cmds[2], o)).toBeUndefined();
  });
  it('si salvano solo le differenze', () => {
    expect(assignShortcut({ 'fmt.bold': 'Mod+J' }, 'fmt.bold', 'Mod+B', cmds, true)).toEqual({});
  });
  it('ripristino: torna la predefinita, tolta a chi l\'aveva presa', () => {
    const o = assignShortcut(assignShortcut({}, 'fmt.bold', 'Mod+J', cmds, true), 'view.zen', 'Mod+B', cmds, true);
    // view.zen non ha una predefinita: perdendo Mod+B torna alla predefinita (nessuna), niente da salvare
    expect(resetShortcut(o, 'fmt.bold', cmds, true)).toEqual({});
    const p = assignShortcut({}, 'fmt.italic', 'Mod+J', cmds, true);
    expect(resetShortcut(assignShortcut(p, 'file.save', 'Mod+I', cmds, true), 'fmt.italic', cmds, true)).toEqual({ 'file.save': null });
  });
  it('stato salvato letto con prudenza', () => {
    expect(normalizeOverrides(null)).toEqual({});
    expect(normalizeOverrides({ a: 'Mod+K', b: null, c: 3, d: '' })).toEqual({ a: 'Mod+K', b: null });
  });
});

describe('tasti gestiti dall\'editor', () => {
  it('nuove scorciatoie e predefinite tolte ai comandi dell\'editor', () => {
    const keys = editorManagedKeys(cmds, { 'fmt.bold': 'Mod+Shift+B', 'file.save': null }, true);
    expect([...keys].sort()).toEqual(['Meta+B', 'Meta+Shift+B']);
  });
});
