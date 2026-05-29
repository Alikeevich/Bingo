import { useEffect, useState } from 'react';
import { OCCASIONS } from './config';
import { BookingPayload } from './bookingMessage';

export type BookingMode = 'game' | 'franchise';

type Props = {
  mode: BookingMode;
  onClose: () => void;
};

const inputCls =
  'w-full rounded-2xl bg-ink-soft border border-white/10 px-4 py-3.5 text-cream placeholder-white/35 ' +
  'outline-none transition focus:border-magenta focus:ring-2 focus:ring-magenta/40 text-base';

const labelCls = 'block text-sm font-semibold text-cream/70 mb-1.5';

export default function BookingModal({ mode, onClose }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+7 ');
  const [date, setDate] = useState('');
  const [people, setPeople] = useState('');
  const [occasion, setOccasion] = useState(OCCASIONS[0]);
  const [city, setCity] = useState('');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  // Закрытие по Esc + блокировка скролла фона
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

  const isFranchise = mode === 'franchise';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError('Заполни имя и телефон — остальное по желанию.');
      return;
    }
    setError('');
    setStatus('sending');

    const payload: BookingPayload = isFranchise
      ? { mode, name, phone, city, comment }
      : { mode, name, phone, date, people, occasion, comment };

    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('bad status');
      setStatus('sent');
    } catch {
      setStatus('idle');
      setError('Не удалось отправить заявку. Попробуй ещё раз или напиши нам напрямую.');
    }
  };

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
              Заявка отправлена
            </h3>
            <p className="text-cream/70 leading-relaxed mb-7 max-w-sm mx-auto">
              Спасибо! Мы получили твои контакты. Владелец свяжется с тобой в ближайшее время и
              подтвердит {isFranchise ? 'детали по франшизе' : 'дату и детали игры'}.
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
                {isFranchise ? 'Франшиза' : 'Бронь игры'}
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-cream leading-tight">
                {isFranchise ? 'Открой MuzBingo в своём городе' : 'Забронируй игру за минуту'}
              </h3>
              <p className="text-cream/60 mt-2 text-sm">
                Оставь контакты — дальше мы свяжемся с тобой сами.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className={labelCls}>Как тебя зовут?</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
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

              {isFranchise ? (
                <>
                  <div>
                    <label className={labelCls}>Город</label>
                    <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Где хочешь запустить?" />
                  </div>
                  <div>
                    <label className={labelCls}>Пара слов о себе</label>
                    <textarea
                      className={inputCls + ' resize-none'}
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Опыт в ивентах, бар/площадка, амбиции…"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Дата</label>
                      <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Сколько вас?</label>
                      <input
                        className={inputCls}
                        value={people}
                        onChange={(e) => setPeople(e.target.value)}
                        placeholder="напр. 12"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Повод</label>
                    <select className={inputCls} value={occasion} onChange={(e) => setOccasion(e.target.value)}>
                      {OCCASIONS.map((o) => (
                        <option key={o} value={o} className="bg-ink-soft">
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Комментарий (необязательно)</label>
                    <textarea
                      className={inputCls + ' resize-none'}
                      rows={2}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Площадка, пожелания по музыке…"
                    />
                  </div>
                </>
              )}

              {error && <p className="text-magenta text-sm font-semibold">{error}</p>}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full rounded-full bg-lime px-7 py-4 font-display text-lg font-extrabold text-ink hover:scale-[1.02] active:scale-95 transition shadow-lg shadow-lime/20 disabled:opacity-60 disabled:hover:scale-100"
              >
                {status === 'sending' ? 'Отправляем…' : 'Отправить заявку'}
              </button>
              <p className="text-center text-xs text-cream/40">
                Нажимая, ты соглашаешься, что мы свяжемся с тобой по указанным контактам
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
