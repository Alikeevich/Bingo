// Полифилл Buffer для @react-pdf/renderer — должен встать до любых импортов, которые его используют
import { Buffer } from 'buffer';
if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}
if (typeof (globalThis as any).global === 'undefined') {
  (globalThis as any).global = globalThis;
}
if (typeof (globalThis as any).process === 'undefined') {
  (globalThis as any).process = { env: {} };
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
