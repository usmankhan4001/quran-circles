import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
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
