import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/figtree/800.css';
import '../fonts.css';
import './showcase.css';
import { ShowcaseApp } from './ShowcaseApp';

const root = document.getElementById('showcase-root');
if (!root) throw new Error('Missing #showcase-root');

createRoot(root).render(
  <StrictMode>
    <ShowcaseApp />
  </StrictMode>,
);
