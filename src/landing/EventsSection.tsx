import { useEffect, useMemo, useState } from 'react';
import { CONTACTS } from './config';

const TZ = 'Asia/Almaty';

export type EventItem = {
  id: number;
  starts_at: string;
  venue: string | null;
  city?: string | null;
};

export const DEFAULT_CITY = 'Астана';
export const cityOf = (e: EventItem) => (e.city || DEFAULT_CITY).trim();
const CITY_KEY = 'muzbingo_city';

function partsOf(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('ru-RU', { timeZone: TZ, day: 'numeric' }),
    month: d.toLocaleDateString('ru-RU', { timeZone: TZ, month: 'long' }),
    weekday: d.toLocaleDateString('ru-RU', { timeZone: TZ, weekday: 'long' }),
    time: d.toLocaleTimeString('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }),
  };
}

const ACCENTS = ['bg-magenta', 'bg-lime', 'bg-grape'];

export default function EventsSection({ onPick }: { onPick: (e: EventItem) => void }) {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState(false);
  // Выбранный город запоминаем — гость из Экибастуза не должен каждый раз переключать
  const [city, setCity] = useState<string>(() => {
    try { return localStorage.getItem(CITY_KEY) || 'all'; } catch { return 'all'; }
  });
  const pickCity = (c: string) => {
    setCity(c);
    try { localStorage.setItem(CITY_KEY, c); } catch { /* приватный режим */ }
  };

  useEffect(() => {
    let alive = true;
    fetch('/api/events')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad'))))
      .then((data) => {
        if (!alive) return;
        setEvents(Array.isArray(data?.events) ? data.events : []);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  // Города берём из самих игр — новый город появится на сайте, как только его добавят в боте
  const cities = useMemo(() => {
    const set = new Set((events || []).map(cityOf));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [events]);
  const multiCity = cities.length > 1;
  // Если сохранённого города больше нет в расписании — показываем все
  const activeCity = city !== 'all' && cities.includes(city) ? city : 'all';
  const shown = (events || []).filter((e) => activeCity === 'all' || cityOf(e) === activeCity);

  return (
    <section id="events" className="mx-auto max-w-6xl px-5 py-16 sm:py-24 scroll-mt-20">
      <div className="text-center">
        <div className="inline-block rounded-full bg-white/5 px-4 py-1 text-xs font-bold uppercase tracking-widest text-magenta mb-3">
          расписание
        </div>
        <h2 className="font-display font-black text-3xl sm:text-5xl leading-tight">
          Ближайшие игры
        </h2>
        <p className="text-cream/60 mt-4 max-w-md mx-auto">
          Выбери дату — мы запишем тебя и придержим места.
        </p>
      </div>

      {multiCity && (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {['all', ...cities].map((c) => (
            <button
              key={c}
              onClick={() => pickCity(c)}
              className={`rounded-full px-5 py-2.5 font-display font-bold text-sm transition ${
                activeCity === c ? 'bg-lime text-ink' : 'bg-white/5 text-cream/70 hover:bg-white/10'
              }`}
            >
              {c === 'all' ? 'Все города' : c}
            </button>
          ))}
        </div>
      )}

      <div className="mt-10">
        {events === null && !error && (
          <p className="text-center text-cream/50">Загружаем расписание…</p>
        )}

        {error && (
          <p className="text-center text-cream/50">
            Не удалось загрузить расписание. Обнови страницу.
          </p>
        )}

        {events && events.length === 0 && <EmptyState />}

        {events && events.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((ev, i) => (
              <EventCard
                key={ev.id}
                event={ev}
                showCity={multiCity}
                accent={ACCENTS[i % ACCENTS.length]}
                onPick={() => onPick(ev)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function EventCard({
  event,
  accent,
  showCity,
  onPick,
}: {
  event: EventItem;
  accent: string;
  showCity: boolean;
  onPick: () => void;
}) {
  const p = partsOf(event.starts_at);
  return (
    <div className="group relative overflow-hidden rounded-3xl bg-ink-card border border-white/10 p-6 hover:border-magenta/50 hover:-translate-y-1 transition flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <span className={`block h-1.5 w-10 rounded-full ${accent}`} />
        {showCity && (
          <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cream/70">
            {cityOf(event)}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="font-display font-black text-6xl leading-none">{p.day}</span>
        <span className="font-display font-bold text-xl text-cream/70 lowercase">{p.month}</span>
      </div>
      <p className="mt-2 text-cream/60 capitalize">{p.weekday}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-mono text-lime font-semibold">{p.time}</span>
        {event.venue && <span className="text-cream/55">· {event.venue}</span>}
      </div>
      <button
        onClick={onPick}
        className="mt-6 rounded-full bg-lime px-6 py-3 font-display font-extrabold text-ink hover:scale-[1.03] active:scale-95 transition self-start"
      >
        Записаться
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center max-w-md mx-auto rounded-3xl bg-ink-card border border-white/10 p-8">
      <p className="font-display font-bold text-xl mb-2">Скоро объявим даты</p>
      <p className="text-cream/60 leading-relaxed mb-5">
        Следи в нашем Instagram — там анонсируем все игры первыми.
      </p>
      <a
        href={`https://instagram.com/${CONTACTS.instagram}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-full bg-magenta px-6 py-3 font-display font-bold text-white hover:scale-105 active:scale-95 transition"
      >
        @{CONTACTS.instagram}
      </a>
    </div>
  );
}
