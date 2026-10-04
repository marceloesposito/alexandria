import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/libertinus-serif/400.css';
import '@fontsource/libertinus-serif/400-italic.css';
import '@fontsource/libertinus-serif/600.css';
import '@fontsource/libertinus-serif/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import 'katex/dist/katex.min.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/editor.css';
import { registerAll } from './modules';
import App from './App';

registerAll();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
