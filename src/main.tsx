// Полифиллы для старых Safari (Object.hasOwn / .at) — обязательно первым импортом,
// иначе чанк инструмента падает и вместо интерфейса виден белый экран.
import './lib/polyfills';

if (typeof (globalThis as any).process === 'undefined') {
  (globalThis as any).process = { env: {} };
}

import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import Landing from './pages/Landing.tsx';
import './index.css';

// Вход, регистрация и пульт ведущего — отдельным модулем: лендинг для гостей
// не должен грузить Supabase, авторизацию и инструменты ведущего.
const AuthedRoutes = lazy(() => import('./AuthedRoutes.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/*"
          element={
            <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
              <AuthedRoutes />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
