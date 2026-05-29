import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AuthShell, { authInputCls, authLabelCls } from '../auth/AuthShell';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Введи email и пароль.');
      return;
    }
    setError('');
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) {
      setError('Неверный email или пароль.');
      return;
    }
    navigate('/app');
  };

  return (
    <AuthShell title="С возвращением" subtitle="Войди в кабинет MuzBingo, чтобы вести игры.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={authLabelCls}>Email</label>
          <input className={authInputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" autoComplete="email" />
        </div>
        <div>
          <label className={authLabelCls}>Пароль</label>
          <input type="password" className={authInputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </div>

        {error && <p className="text-magenta text-sm font-semibold">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-lime px-7 py-4 font-display text-lg font-extrabold text-ink hover:scale-[1.02] active:scale-95 transition shadow-lg shadow-lime/20 disabled:opacity-60 disabled:hover:scale-100"
        >
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>

      <p className="text-cream/60 mt-6 text-sm">
        Нет аккаунта?{' '}
        <Link to="/register" className="text-lime font-semibold hover:underline">
          Зарегистрироваться по франшизе
        </Link>
      </p>
    </AuthShell>
  );
}
