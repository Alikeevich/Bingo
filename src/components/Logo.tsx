// Логотип MuzBingo. Файл лежит в public/logo.png и отдаётся по пути /logo.png.
export default function Logo({ className = 'h-9 w-auto' }: { className?: string }) {
  return <img src="/logo.png" alt="MuzBingo" className={className} />;
}
