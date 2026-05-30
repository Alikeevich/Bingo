import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SignupModal from '../landing/SignupModal';
import EventsSection, { EventItem } from '../landing/EventsSection';
import Logo from '../components/Logo';
import { CONTACTS, OWNER_TELEGRAM, PARTNERS, EVENT_PHOTOS } from '../landing/config';

export default function Landing() {
  const navigate = useNavigate();
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  // Франшиза ведёт на регистрацию аккаунта (доступ к инструменту — после одобрения владельца).
  const openFranchise = () => navigate('/register');

  return (
    <div className="min-h-screen bg-ink text-cream font-sans overflow-x-hidden selection:bg-lime selection:text-ink">
      {/* фоновые цветовые пятна */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-magenta/25 blur-[120px]" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-grape/25 blur-[130px]" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-lime/10 blur-[120px]" />
      </div>

      <Nav />
      <Hero />
      <Marquee />
      <HowItWorks />
      <EventsSection onPick={setSelectedEvent} />
      <VibeGallery />
      <Stats />
      <Partners />
      <Franchise onFranchise={openFranchise} />
      <FinalCta />
      <InstagramPreview />
      <Footer />

      {/* липкая кнопка записи на мобилке — всегда в один тап */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-50 p-3 bg-gradient-to-t from-ink via-ink/95 to-transparent">
        <a
          href="#events"
          className="block text-center w-full rounded-full bg-magenta py-4 font-display text-lg font-extrabold text-white shadow-lg shadow-magenta/30 active:scale-95 transition"
        >
          Записаться на игру
        </a>
      </div>

      {selectedEvent && (
        <SignupModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

/* ---------- Nav ---------- */
function Nav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-ink/70 border-b border-white/5">
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center">
          <Logo className="h-9 w-auto" />
        </a>
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-cream/70">
          <a href="#how" className="hover:text-cream transition">Как играем</a>
          <a href="#events" className="hover:text-cream transition">Расписание</a>
          <a href="#franchise" className="hover:text-cream transition">Франшиза</a>
        </nav>
        <a
          href="#events"
          className="hidden sm:block rounded-full bg-lime px-5 py-2.5 font-display font-bold text-ink text-sm hover:scale-105 active:scale-95 transition"
        >
          Записаться
        </a>
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section id="top" className="relative mx-auto max-w-6xl px-5 pt-12 pb-16 sm:pt-20 sm:pb-24">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-6 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-4 py-1.5 text-sm font-semibold text-lime mb-6 animate-pop-in">
            <Equalizer />
            живая музыкальная вечеринка
          </div>
          <h1 className="font-display font-black leading-[0.95] text-[2.7rem] sm:text-6xl lg:text-7xl">
            Угадай трек.
            <br />
            Закрой карточку.
            <br />
            Кричи <span className="text-magenta">БИНГО!</span>
          </h1>
          <p className="mt-6 text-lg text-cream/70 max-w-md leading-relaxed">
            Это бинго, но вместо скучных чисел — твои любимые треки. Мы сами проводим игры в
            барах: приходи компанией, лови хиты на карточке и забирай призы.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              href="#events"
              className="rounded-full bg-magenta px-8 py-4 font-display text-lg font-extrabold text-white text-center hover:scale-[1.03] active:scale-95 transition shadow-lg shadow-magenta/30"
            >
              Записаться на игру
            </a>
            <a
              href="#how"
              className="rounded-full border border-white/15 px-8 py-4 font-display text-lg font-bold text-cream text-center hover:bg-white/5 transition"
            >
              Как это работает
            </a>
          </div>
          <p className="mt-4 text-sm text-cream/45">Выбери дату в расписании — займём за тобой места</p>
        </div>

        <div className="relative flex justify-center lg:justify-end">
          <BingoCardMock />
        </div>
      </div>
    </section>
  );
}

function Equalizer() {
  return (
    <span className="flex items-end gap-0.5 h-4">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-1 bg-lime rounded-full origin-bottom"
          style={{ height: '100%', animation: `eq-bounce 0.9s ease-in-out ${i * 0.15}s infinite` }}
        />
      ))}
    </span>
  );
}

function NoteIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="46%" height="46%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

function BingoCardMock() {
  const tints = [
    'text-magenta/70',
    'text-lime/70',
    'text-grape/80',
    'text-cream/40',
    'text-magenta/60',
    'text-lime/60',
    'text-grape/70',
    'text-cream/40',
    'text-magenta/70',
  ];
  const marked = new Set([0, 4, 5, 7]);
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[32px] bg-gradient-to-br from-magenta/30 to-lime/20 blur-2xl" />
      <div className="relative w-[280px] sm:w-[340px] rounded-[28px] bg-ink-card border-2 border-white/10 p-5 rotate-[4deg] shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <span className="font-display font-extrabold text-2xl tracking-tight">
            B<span className="text-magenta">I</span>N<span className="text-lime">G</span>O
          </span>
          <span className="text-xs text-cream/40 font-mono">#042</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {tints.map((t, i) => (
            <div
              key={i}
              className={`aspect-square rounded-2xl grid place-items-center transition ${
                marked.has(i)
                  ? 'bg-magenta text-white scale-95 shadow-inner'
                  : `bg-ink-soft border border-white/5 ${t}`
              }`}
            >
              {marked.has(i) ? (
                <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5l5 5L20 6" />
                </svg>
              ) : (
                <NoteIcon />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-4 -left-6 rotate-[-8deg] rounded-2xl bg-lime px-4 py-2 font-display font-extrabold text-ink shadow-xl text-sm">
        БИНГО!
      </div>
    </div>
  );
}

/* ---------- Marquee ---------- */
function Marquee() {
  const words = ['ТАНЦЫ', 'ПРИЗЫ', 'ХИТЫ', 'СМЕХ', 'ВЕЧЕРИНКА', 'БИНГО'];
  const strip = [...words, ...words];
  return (
    <div className="relative border-y border-white/10 bg-magenta/10 py-4 overflow-hidden">
      <div className="flex w-max animate-marquee whitespace-nowrap">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex items-center" aria-hidden={dup === 1}>
            {strip.map((w, i) => (
              <span key={i} className="flex items-center font-display font-extrabold text-2xl sm:text-3xl px-6">
                {w}
                <span className="mx-6 h-2.5 w-2.5 rotate-45 bg-magenta" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- How it works ---------- */
function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Выбираешь дату',
      text: 'Смотришь расписание игр на сайте и записываешься на ближайшую — за минуту.',
    },
    {
      n: '02',
      title: 'Приходишь на игру',
      text: 'Приезжаешь в указанный бар, получаешь карточку с обложками треков вместо чисел.',
    },
    {
      n: '03',
      title: 'Играешь и побеждаешь',
      text: 'Ведущий включает хиты — узнал, отметил. Собрал линию или всю карточку — кричишь БИНГО!',
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <SectionTitle kicker="как это работает" title="Три шага до вечеринки" />
      <div className="grid md:grid-cols-3 gap-5 mt-10">
        {steps.map((s) => (
          <div
            key={s.n}
            className="group relative overflow-hidden rounded-3xl bg-ink-card border border-white/10 p-7 hover:border-magenta/50 transition"
          >
            <span className="block font-display font-black text-6xl text-magenta mb-4">{s.n}</span>
            <h3 className="font-display font-extrabold text-xl mb-2">{s.title}</h3>
            <p className="text-cream/60 leading-relaxed">{s.text}</p>
            <span className="pointer-events-none absolute -bottom-6 -right-2 font-display font-black text-[7rem] leading-none text-white/[0.03] select-none">
              {s.n}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Stats ---------- */
function Stats() {
  const stats = [
    { num: '100+', label: 'игроков за раз' },
    { num: '1000+', label: 'треков в базе' },
    { num: '0', label: 'подготовки от тебя' },
    { num: '∞', label: 'эмоций' },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-10">
      <div className="rounded-[32px] bg-gradient-to-br from-magenta to-grape p-8 sm:p-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-display font-black text-4xl sm:text-5xl text-white">{s.num}</div>
              <div className="text-white/70 text-sm mt-1 font-semibold">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Franchise ---------- */
function Franchise({ onFranchise }: { onFranchise: () => void }) {
  return (
    <section id="franchise" className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <div className="relative overflow-hidden rounded-[32px] border-2 border-lime/30 bg-ink-card p-8 sm:p-14">
        <svg className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 text-lime/[0.07]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="50" cy="50" r="46" />
          <circle cx="50" cy="50" r="34" />
          <circle cx="50" cy="50" r="22" />
          <circle cx="50" cy="50" r="6" fill="currentColor" />
        </svg>
        <div className="relative max-w-xl">
          <SectionTitle kicker="франшиза" title="Открой MuzBingo в своём городе" align="left" />
          <p className="mt-5 text-cream/70 text-lg leading-relaxed">
            Готовый формат вечеринки, который уже любят. Дадим всё: сценарий, музыкальную базу,
            карточки, материалы и поддержку. Ты — зарабатываешь на эмоциях.
          </p>
          <button
            onClick={onFranchise}
            className="mt-8 rounded-full bg-lime px-8 py-4 font-display text-lg font-extrabold text-ink hover:scale-[1.03] active:scale-95 transition shadow-lg shadow-lime/20"
          >
            Зарегистрироваться по франшизе
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------- Final CTA ---------- */
function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24 text-center">
      <h2 className="font-display font-black text-4xl sm:text-6xl leading-tight">
        Готов <span className="text-magenta">сыграть</span>?
      </h2>
      <p className="mt-5 text-cream/60 text-lg max-w-md mx-auto">
        Места на ближайшие игры разлетаются быстро. Займи своё прямо сейчас.
      </p>
      <a
        href="#events"
        className="inline-block mt-8 rounded-full bg-magenta px-10 py-5 font-display text-xl font-extrabold text-white hover:scale-[1.03] active:scale-95 transition shadow-xl shadow-magenta/30"
      >
        Записаться на игру
      </a>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="border-t border-white/10 mt-10 pb-28 sm:pb-10">
      <div className="mx-auto max-w-6xl px-5 py-12 grid sm:grid-cols-2 gap-8">
        <div>
          <Logo className="h-11 w-auto mb-3" />
          <p className="text-cream/50 max-w-xs">
            Музыкальное бинго, которое превращает любой вечер в вечеринку. {CONTACTS.city}.
          </p>
        </div>
        <div className="sm:text-right space-y-2">
          <a href="#events" className="block font-display font-bold text-lime hover:underline">
            Записаться на игру
          </a>
          <div className="text-cream/60 space-y-1.5 text-sm">
            <p>
              <a href={`https://t.me/${OWNER_TELEGRAM}`} target="_blank" rel="noopener noreferrer" className="hover:text-cream">
                Telegram: @{OWNER_TELEGRAM}
              </a>
            </p>
            <p>
              <a href={`https://instagram.com/${CONTACTS.instagram}`} target="_blank" rel="noopener noreferrer" className="hover:text-cream">
                Instagram: @{CONTACTS.instagram}
              </a>
            </p>
            <p>{CONTACTS.phone}</p>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5 py-5 border-t border-white/5 flex items-center justify-between text-xs text-cream/30">
        <span>© {new Date().getFullYear()} MuzBingo</span>
        <Link to="/app" className="hover:text-cream/60 transition">
          Вход для ведущего
        </Link>
      </div>
    </footer>
  );
}

/* ---------- shared ---------- */
function SectionTitle({
  kicker,
  title,
  align = 'center',
}: {
  kicker: string;
  title: string;
  align?: 'center' | 'left';
}) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      <div className="inline-block rounded-full bg-white/5 px-4 py-1 text-xs font-bold uppercase tracking-widest text-magenta mb-3">
        {kicker}
      </div>
      <h2 className="font-display font-black text-3xl sm:text-5xl leading-tight">{title}</h2>
    </div>
  );
}

/* ---------- VibeGallery: бесконечная лента фоток с реальных игр ---------- */
function VibeGallery() {
  // Дублируем массив, чтобы анимация -50% давала бесшовный цикл.
  const strip = [...EVENT_PHOTOS, ...EVENT_PHOTOS];
  return (
    <section className="py-16 sm:py-24 overflow-hidden">
      <div className="mx-auto max-w-6xl px-5">
        <SectionTitle kicker="живьём" title="Так это выглядит вживую" />
      </div>
      <div className="mt-10 overflow-hidden">
        <div className="flex w-max gap-4 sm:gap-6 animate-marquee" style={{ animationDuration: '38s' }}>
          {strip.map((src, i) => (
            <div
              key={i}
              className="shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-ink-card shadow-xl shadow-black/40"
              style={{ transform: `rotate(${i % 2 === 0 ? -1.5 : 1.5}deg)` }}
            >
              <img
                src={src}
                alt="Атмосфера MuzBingo"
                className="h-56 sm:h-80 w-auto object-cover block"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Partners: с кем дружим (Instagram) ---------- */
function Partners() {
  const accents = ['bg-magenta', 'bg-lime', 'bg-grape'];
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <SectionTitle kicker="партнёры" title="С кем мы дружим" />
      <p className="text-center text-cream/55 mt-4 max-w-xl mx-auto">
        Они отдают свои сертификаты как призы на наших играх. Загляни — у них классно.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
        {PARTNERS.map((p, i) => (
          <a
            key={p.handle}
            href={`https://instagram.com/${p.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-3xl bg-ink-card border border-white/10 p-6 hover:border-magenta/50 hover:-translate-y-1 transition"
          >
            <span className={`block h-1.5 w-10 rounded-full ${accents[i % accents.length]} mb-4`} />
            <h3 className="font-display font-extrabold text-xl leading-tight">{p.name}</h3>
            <p className="text-cream/60 text-sm mt-2 leading-relaxed">{p.description}</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-lime font-mono text-sm truncate">@{p.handle}</span>
              <span className="text-cream/40 group-hover:text-cream transition text-sm font-semibold shrink-0 ml-3">
                Открыть
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------- InstagramPreview: реальные посты через виджет behold.so ---------- */
const BEHOLD_FEED_ID = 'GzEUPHsYPSduDQncGK09';

function InstagramPreview() {
  const igUrl = `https://instagram.com/${CONTACTS.instagram}`;

  // Скрипт behold.so грузим ровно один раз, только когда секция реально на экране,
  // чтобы не тащить виджет на /app и /login.
  useEffect(() => {
    const ID = 'behold-widget-script';
    if (document.getElementById(ID)) return;
    const s = document.createElement('script');
    s.id = ID;
    s.type = 'module';
    s.src = 'https://w.behold.so/widget.js';
    document.head.appendChild(s);
  }, []);

  return (
    <section className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
      <SectionTitle kicker="инстаграм" title="Подпишись и не пропусти" />
      <div className="mt-10 rounded-[32px] bg-ink-card border border-white/10 overflow-hidden">
        <div className="p-5 sm:p-7 flex items-center gap-4 sm:gap-5 border-b border-white/5">
          <div className="relative shrink-0">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full p-[3px] bg-gradient-to-tr from-magenta via-lime to-grape">
              <div className="h-full w-full rounded-full bg-ink-card grid place-items-center overflow-hidden">
                <img src="/logo.png" alt="MuzBingo" className="h-10 sm:h-12 w-auto" />
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-extrabold text-base sm:text-xl truncate">@{CONTACTS.instagram}</p>
            <p className="text-cream/55 text-xs sm:text-sm mt-0.5 leading-snug">
              Последние посты с наших игр
            </p>
          </div>
          <a
            href={igUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex rounded-full bg-magenta px-5 py-2.5 font-display font-bold text-white text-sm hover:scale-105 active:scale-95 transition shrink-0"
          >
            Подписаться
          </a>
        </div>

        <div className="p-4 sm:p-5 bg-white/[0.02]">
          <behold-widget feed-id={BEHOLD_FEED_ID}></behold-widget>
        </div>

        <div className="p-5 sm:p-6 flex items-center justify-between gap-3">
          <a
            href={igUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sm:hidden rounded-full bg-magenta px-5 py-2.5 font-display font-bold text-white text-sm shrink-0"
          >
            Подписаться
          </a>
          <a
            href={igUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-cream/60 hover:text-cream text-sm font-semibold"
          >
            Все посты в Instagram
          </a>
        </div>
      </div>
    </section>
  );
}
