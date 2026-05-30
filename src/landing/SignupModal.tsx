import { useEffect, useState } from 'react';
import type { EventItem } from './EventsSection';

const TZ = 'Asia/Almaty';

const inputCls =
  'w-full rounded-2xl bg-ink-soft border border-white/10 px-4 py-3.5 text-cream placeholder-white/35 ' +
  'outline-none transition focus:border-magenta focus:ring-2 focus:ring-magenta/40 text-base';
const labelCls = 'block text-sm font-semibold text-cream/70 mb-1.5';

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('ru-RU', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  const time = d.toLocaleTimeString('ru-RU', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

export default function SignupModal({
  event,
  onClose,
}: {
  event: EventItem;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+7 ');
  const [people, setPeople] = useState('2');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введи имя.');
      return;
    }
    const digits = phone.replace(/\D/g, '').length;
    if (digits < 11) {
      setError('Введи полный номер телефона (11 цифр).');
      return;
    }
    setError('');
    setStatus('sending');
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          name: name.trim(),
          phone: phone.trim(),
          people_count: Math.max(1, Number(people) || 1),
        }),
      });
      if (!res.ok) throw new Error('bad');
      setStatus('sent');
    } catch {
      setStatus('idle');
      setError('Не удалось отправить. Попробуй ещё раз.');
    }
  };

  const dateLabel = formatEventDate(event.starts_at);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto no-scrollbar bg-ink-card border-t-2 sm:border-2 border-magenta/40 rounded-t-[28px] sm:rounded-[28px] p-6 sm:p-8 animate-pop-in shadow-2xl shadow-magenta/20">
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-white/5 text-cream/60 hover:bg-white/10 hover:text-cream transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {status === 'sent' ? (
          <div className="text-center py-8">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-lime">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#120A22" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5l5 5L20 6" />
              </svg>
            </div>
            <h3 className="font-display text-2xl font-extrabold text-cream mb-3">
              Готово, ждём!
            </h3>
            <p className="text-cream/70 leading-relaxed mb-7 max-w-sm mx-auto">
              Записали тебя на <span className="text-lime font-semibold">{dateLabel}</span>
              {event.venue ? <> · {event.venue}</> : null}. Если что-то изменится — позвоним.
            </p>
            <button
              onClick={onClose}
              className="rounded-full bg-magenta px-8 py-3.5 font-display font-bold text-white hover:scale-[1.03] active:scale-95 transition"
            >
              Отлично
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-magenta/15 text-magenta px-3 py-1 text-xs font-bold uppercase tracking-wide mb-3">
                Запись на игру
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-cream leading-tight">
                {dateLabel}
              </h3>
              {event.venue && (
                <p className="text-cream/60 mt-1 text-sm">{event.venue}</p>
              )}
              <p className="text-cream/55 mt-3 text-sm">
                Оставь контакты — придержим за тобой места.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className={labelCls}>Как тебя зовут?</label>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Имя"
                />
              </div>
              <div>
                <label className={labelCls}>Телефон</label>
                <input
                  className={inputCls}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 ___ ___ __ __"
                  inputMode="tel"
                />
              </div>
              <div>
                <label className={labelCls}>Сколько вас?</label>
                <input
                  className={inputCls}
                  value={people}
                  onChange={(e) => setPeople(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="напр. 4"
                  inputMode="numeric"
                />
              </div>

              {error && <p className="text-magenta text-sm font-semibold">{error}</p>}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full rounded-full bg-lime px-7 py-4 font-display text-lg font-extrabold text-ink hover:scale-[1.02] active:scale-95 transition shadow-lg shadow-lime/20 disabled:opacity-60 disabled:hover:scale-100"
              >
                {status === 'sending' ? 'Записываем…' : 'Записаться'}
              </button>
              <p className="text-center text-xs text-cream/40">
                Нажимая, ты соглашаешься, что мы свяжемся по указанному телефону
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
