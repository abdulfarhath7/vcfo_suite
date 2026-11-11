import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../../src/ui/App';
import '../../src/ui/fonts.css';
import '../../src/ui/spectrum-tokens.css';
import '../../src/ui/panel.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
