import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AuthShell, { authInputCls, authLabelCls } from '../auth/AuthShell';

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !email.trim() || !password) {
      setError('Заполни имя, телефон, email и пароль.');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.');
      return;
    }
    setError('');
    setBusy(true);
    const { error, needsConfirm } = await signUp({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      phone: phone.trim(),
      city: city.trim(),
    });
    setBusy(false);
    if (error) {
      setError(error.includes('already') ? 'Такой email уже зарегистрирован.' : error);
      return;
    }
    if (needsConfirm) {
      setConfirmSent(true);
      return;
    }
    navigate('/app');
  };

  if (confirmSent) {
    return (
      <AuthShell title="Почти готово" subtitle="Остался один шаг.">
        <div className="rounded-3xl bg-ink-card border border-white/10 p-6">
          <p className="text-cream/80 leading-relaxed">
            Мы отправили письмо на <span className="text-lime font-semibold">{email}</span>. Подтверди
            почту по ссылке из письма. После этого владелец одобрит доступ — и ты сможешь войти.
          </p>
          <Link
            to="/login"
            className="inline-block mt-6 rounded-full bg-magenta px-7 py-3.5 font-display font-bold text-white hover:scale-[1.03] active:scale-95 transition"
          >
            Перейти ко входу
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Франшиза MuzBingo" subtitle="Заведи аккаунт — после одобрения откроем доступ к инструменту.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={authLabelCls}>Как тебя зовут?</label>
          <input className={authInputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Имя и фамилия" autoComplete="name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={authLabelCls}>Телефон</label>
            <input className={authInputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 ___ ___" inputMode="tel" />
          </div>
          <div>
            <label className={authLabelCls}>Город</label>
            <input className={authInputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Город запуска" />
          </div>
        </div>
        <div>
          <label className={authLabelCls}>Email</label>
          <input className={authInputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" autoComplete="email" />
        </div>
        <div>
          <label className={authLabelCls}>Пароль</label>
          <input type="password" className={authInputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="минимум 6 символов" autoComplete="new-password" />
        </div>

        {error && <p className="text-magenta text-sm font-semibold">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-lime px-7 py-4 font-display text-lg font-extrabold text-ink hover:scale-[1.02] active:scale-95 transition shadow-lg shadow-lime/20 disabled:opacity-60 disabled:hover:scale-100"
        >
          {busy ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
        </button>
        <p className="text-center text-xs text-cream/40">
          После регистрации доступ к инструменту открывает владелец вручную.
        </p>
      </form>

      <p className="text-cream/60 mt-6 text-sm">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="text-lime font-semibold hover:underline">
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}
