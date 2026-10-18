import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppProviders, AppRoutes } from './App';
// Fonts: Plus Jakarta Sans for Latin text, as on the showcase (owner override of D17,
// 2026-10-18; SIL OFL 1.1, from Fontsource), and the kit's own Mehr Nastaliq Web for Urdu and
// KFGQPC Uthmanic Script HAFS for Quran text. Licences: packages/ui/assets/fonts.
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
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
