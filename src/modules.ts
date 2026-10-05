// Registrazione dei moduli: comandi, viste, pannelli e dialoghi.
import { registerAppCommands } from './commands/appCommands';
import { registerEditorCommands } from './commands/editorCommands';
import './shell/RibbonWidgets';
import { registerComments } from './comments';
import { registerVersions } from './versions';
import { registerResources } from './resources';
import { registerExport } from './export';
import { registerTemplates } from './layout/templatesModule';
import { registerDialog } from './shell/DialogHost';
import { DocSettingsDialog } from './layout/DocSettingsDialog';
import { registerRevision } from './revision';
import { RecensioDialog } from './recensio/ui';
import { ReviewDialog } from './review/ReviewDialog';

let done = false;

export function registerAll() {
  if (done) return;
  done = true;
  registerAppCommands();
  registerEditorCommands();
  registerComments();
  registerRevision();
  registerVersions();
  registerResources();
  registerExport();
  registerTemplates();
  registerDialog('docSettings', DocSettingsDialog);
  registerDialog('recensio', RecensioDialog);
  registerDialog('review', ReviewDialog);
}

// accesso agli store per le prove nel browser (solo sviluppo)
if (import.meta.env.DEV) {
  void Promise.all([import('./versions/store'), import('./state/workspace'), import('./comments/store'), import('./versions/actions'), import('./platform'), import('./export/run')]).then(
    ([v, w, c, a, p, x]) => {
      (window as unknown as Record<string, unknown>).__alexandria = { versions: v.useVersions, ws: w.useWorkspace, comments: c.useComments, actions: a, platform: p.platform, exportTo: x.exportTo };
    },
  );
}
