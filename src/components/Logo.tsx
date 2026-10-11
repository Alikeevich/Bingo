// Логотип MuzBingo. WebP (~30 КБ) для современных браузеров, PNG — запасной.
// Исходник в высоком разрешении лежит в assets-src/logo-original.png: на сайт его
// не отдаём — 400 КБ ради картинки высотой 40px заметно тормозили загрузку на телефонах.
export default function Logo({ className = 'h-9 w-auto' }: { className?: string }) {
  return (
    <picture>
      <source srcSet="/logo.webp" type="image/webp" />
      <img src="/logo.png" alt="MuzBingo" className={className} width={480} height={290} decoding="async" />
    </picture>
  );
}
