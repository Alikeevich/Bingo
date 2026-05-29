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

import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.tsx';
import './index.css';

// Инструмент ведущего (вкладки, плеер, PDF-рендерер) грузим лениво — на лендинге он не нужен.
const App = lazy(() => import('./App.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/app/*"
          element={
            <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
              <App />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
