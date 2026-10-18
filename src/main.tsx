import React from 'react';
import ReactDOM from 'react-dom/client';
// caratteri inclusi: solo gli alfabeti latini (italiano, inglese e lingue europee occidentali)
import '@fontsource/libertinus-serif/latin-400.css';
import '@fontsource/libertinus-serif/latin-ext-400.css';
import '@fontsource/libertinus-serif/latin-400-italic.css';
import '@fontsource/libertinus-serif/latin-ext-400-italic.css';
import '@fontsource/libertinus-serif/latin-700.css';
import '@fontsource/libertinus-serif/latin-ext-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
// nome dell'app: carattere da macchina da scrivere (Courier Prime, OFL)
import '@fontsource/courier-prime/latin-400.css';
import './styles/tokens.css';
import './styles/column.css';
import App from './column/App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// accesso agli store per le prove nel browser (solo sviluppo)
if (import.meta.env.DEV) {
  void Promise.all([import('./column/store'), import('./column/ui'), import('./column/editor/editorRef'), import('./platform'), import('./column/timer/store')]).then(([s, u, e, p, tm]) => {
    (window as unknown as Record<string, unknown>).__column = { store: s.useColumn, ui: u.useUi, editor: e.getEditor, platform: p.platform, timer: tm.useTimer };
  });
}
