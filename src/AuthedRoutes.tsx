// Всё, что требует Supabase и входа: вход, регистрация, пульт ведущего.
// Вынесено в отдельный модуль и грузится лениво — лендинг для гостей
// не тянет клиент Supabase и авторизацию (~350 КБ исходников).
import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import Login from './pages/Login';
import Register from './pages/Register';

import { registerOfflineCache } from './lib/offlineCache';

// Офлайн-кэш аудио нужен только ведущему — гостям лендинга Service Worker не ставим
registerOfflineCache();

// Пульт ведущего (вкладки, плеер) — ещё одним отдельным чанком
const App = lazy(() => import('./App'));

export default function AuthedRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/app/*"
          element={
            <RequireAuth>
              <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
                <App />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
