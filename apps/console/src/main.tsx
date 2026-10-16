import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppProviders, AppRoutes } from './App';
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
