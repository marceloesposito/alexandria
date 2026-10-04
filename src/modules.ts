// Registrazione dei moduli: comandi, viste, pannelli e dialoghi.
import { registerAppCommands } from './commands/appCommands';
import { registerEditorCommands } from './commands/editorCommands';
import './shell/RibbonWidgets';
import { registerComments } from './comments';
import { registerVersions } from './versions';
import { registerResources } from './resources';
import { registerDialog } from './shell/DialogHost';
import { DocSettingsDialog } from './layout/DocSettingsDialog';

let done = false;

export function registerAll() {
  if (done) return;
  done = true;
  registerAppCommands();
  registerEditorCommands();
  registerComments();
  registerVersions();
  registerResources();
  registerDialog('docSettings', DocSettingsDialog);
}

// accesso agli store per le prove nel browser (solo sviluppo)
if (import.meta.env.DEV) {
  void Promise.all([import('./versions/store'), import('./state/workspace'), import('./comments/store'), import('./versions/actions')]).then(
    ([v, w, c, a]) => {
      (window as unknown as Record<string, unknown>).__alexandria = { versions: v.useVersions, ws: w.useWorkspace, comments: c.useComments, actions: a };
    },
  );
}
