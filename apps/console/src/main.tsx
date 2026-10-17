import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppProviders, AppRoutes } from './App';
// Fonts (D4): Figtree in the weights the type roles use (SIL OFL 1.1), and the kit's bundled
// Mehr Nastaliq Web and KFGQPC Uthmanic Script HAFS. Licences: packages/ui/assets/fonts.
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/figtree/800.css';
import './fonts.css';
import './styles.css';

// Public configuration only. The API origin is the one value the console needs; the dev server
// proxies to the contract mock when it is empty (see vite.config.ts).
const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

createRoot(root).render(
  <StrictMode>
    <AppProviders apiBaseUrl={apiBaseUrl}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
);
