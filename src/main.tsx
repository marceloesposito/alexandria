import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/libertinus-serif/400.css';
import '@fontsource/libertinus-serif/400-italic.css';
import '@fontsource/libertinus-serif/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles/tokens.css';
import './styles/folium.css';
import App from './folium/App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// accesso agli store per le prove nel browser (solo sviluppo)
if (import.meta.env.DEV) {
  void Promise.all([import('./folium/store'), import('./folium/ui'), import('./folium/editor/editorRef'), import('./platform'), import('./folium/timer/store')]).then(([s, u, e, p, tm]) => {
    (window as unknown as Record<string, unknown>).__folium = { store: s.useFolium, ui: u.useUi, editor: e.getEditor, platform: p.platform, timer: tm.useTimer };
  });
}
