// Ordem importa: sb-env define as chaves da sync ANTES de o motor carregar.
import './sb-env';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '../../design/tokens.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from './theme';
import { boot } from './store';
import { App } from './App';

applyTheme();
const root = createRoot(document.getElementById('root')!);
boot()
  .catch((e) => console.error('[apex] falha ao abrir', e))
  .finally(() => {
    root.render(<StrictMode><App /></StrictMode>);
  });

// Offline (Etapa 4): o service worker só existe no build publicado
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e) => console.warn('[apex] offline indisponível', e)); });
}
