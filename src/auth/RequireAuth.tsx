import { ReactNode } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';

function FullScreen({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-ink text-cream font-sans flex items-center justify-center px-5 text-center">{children}</div>;
}

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading, profileLoading, signOut } = useAuth();

  if (loading || (session && profileLoading && !profile)) {
    return (
      <FullScreen>
        <span className="font-display text-cream/60">Загрузка…</span>
      </FullScreen>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!profile?.approved) {
    return (
      <FullScreen>
        <div className="max-w-md">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-magenta/20 text-magenta font-display font-black text-2xl">
            ?
          </div>
          <h1 className="font-display font-black text-3xl mb-3">Аккаунт на одобрении</h1>
          <p className="text-cream/65 leading-relaxed mb-7">
            Спасибо за регистрацию! Доступ к инструменту откроет владелец вручную — обычно это
            быстро. Мы свяжемся с тобой, как только всё будет готово.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/" className="rounded-full bg-magenta px-7 py-3.5 font-display font-bold text-white hover:scale-[1.03] active:scale-95 transition">
              На главную
            </Link>
            <button
              onClick={() => signOut()}
              className="rounded-full border border-white/15 px-7 py-3.5 font-display font-bold text-cream hover:bg-white/5 transition"
            >
              Выйти
            </button>
          </div>
        </div>
      </FullScreen>
    );
  }

  return <>{children}</>;
}
