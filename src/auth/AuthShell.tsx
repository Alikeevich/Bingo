import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

export const authInputCls =
  'w-full rounded-2xl bg-ink-soft border border-white/10 px-4 py-3.5 text-cream placeholder-white/35 ' +
  'outline-none transition focus:border-magenta focus:ring-2 focus:ring-magenta/40 text-base';

export const authLabelCls = 'block text-sm font-semibold text-cream/70 mb-1.5';

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink text-cream font-sans flex flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-magenta/25 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-grape/20 blur-[130px]" />
      </div>

      <header className="px-5 h-16 flex items-center">
        <Link to="/" className="flex items-center">
          <Logo className="h-9 w-auto" />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <h1 className="font-display font-black text-3xl sm:text-4xl leading-tight mb-2">{title}</h1>
          <p className="text-cream/60 mb-8">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
