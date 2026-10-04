// Registrazione dei moduli: comandi, viste, pannelli e dialoghi.
import { registerAppCommands } from './commands/appCommands';
import { registerEditorCommands } from './commands/editorCommands';
import './shell/RibbonWidgets';

let done = false;

export function registerAll() {
  if (done) return;
  done = true;
  registerAppCommands();
  registerEditorCommands();
}
