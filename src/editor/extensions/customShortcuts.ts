// Scorciatoie cambiate dall'utente dentro l'editor. Le predefinite di formattazione le esegue la keymap
// di TipTap; quando l'utente le cambia, questo plugin (prima delle keymap) esegue la scorciatoia nuova
// e ferma quella vecchia, che altrimenti TipTap continuerebbe a eseguire.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { allCommands, commandForKey, eventShortcut, getShortcutOverrides, isMac, runCommand, shortcutAllowed } from '../../commands/registry';
import { editorManagedKeys, type ShortcutOverrides } from '../../commands/shortcuts';

let cache: { overrides: ShortcutOverrides; count: number; keys: Set<string> } | null = null;

function managedKeys(): Set<string> {
  const overrides = getShortcutOverrides();
  const cmds = allCommands();
  if (!cache || cache.overrides !== overrides || cache.count !== cmds.length) cache = { overrides, count: cmds.length, keys: editorManagedKeys(cmds, overrides, isMac) };
  return cache.keys;
}

export const CustomShortcuts = Extension.create({
  name: 'customShortcuts',
  priority: 1100,
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('customShortcuts'),
        props: {
          handleKeyDown(_view, e) {
            const keys = managedKeys();
            if (!keys.size) return false;
            const key = eventShortcut(e);
            if (!keys.has(key)) return false;
            const cmd = commandForKey(key);
            if (cmd && shortcutAllowed(cmd.id)) void runCommand(cmd.id);
            // anche senza comando: la scorciatoia tolta non deve piu' fare niente
            e.preventDefault();
            return true;
          },
        },
      }),
    ];
  },
});
