import { useEffect, useState } from 'react';
import { CONTACTS } from './config';

const TZ = 'Asia/Almaty';

export type EventItem = {
  id: number;
  starts_at: string;
  venue: string | null;
};

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
            {events.map((ev, i) => (
              <EventCard
                key={ev.id}
                event={ev}
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
  onPick,
}: {
  event: EventItem;
  accent: string;
  onPick: () => void;
}) {
  const p = partsOf(event.starts_at);
  return (
    <div className="group relative overflow-hidden rounded-3xl bg-ink-card border border-white/10 p-6 hover:border-magenta/50 hover:-translate-y-1 transition flex flex-col">
      <span className={`block h-1.5 w-10 rounded-full ${accent} mb-5`} />
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
