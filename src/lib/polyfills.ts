/**
 * Полифиллы для Safari старше 15.4 (macOS Monterey и раньше).
 *
 * Зачем: библиотеки в чанке инструмента ведущего (@react-pdf и его зависимости)
 * вызывают Object.hasOwn и Array.prototype.at. В старом Safari этих методов нет,
 * модуль падает при загрузке — и пользователь видит просто БЕЛЫЙ ЭКРАН,
 * без единого сообщения. Наш код их не использует, но чинить надо здесь:
 * файл импортируется первым, до ленивой загрузки инструмента.
 */

// Object.hasOwn — Safari 15.4+
if (!(Object as any).hasOwn) {
  (Object as any).hasOwn = (obj: object, key: PropertyKey): boolean =>
    Object.prototype.hasOwnProperty.call(obj, key);
}

// Array.prototype.at / String.prototype.at — Safari 15.4+
function atPolyfill(this: any, index: number) {
  const len = this.length;
  let i = Math.trunc(index) || 0;
  if (i < 0) i += len;
  if (i < 0 || i >= len) return undefined;
  return this[i];
}
if (!(Array.prototype as any).at) {
  Object.defineProperty(Array.prototype, 'at', {
    value: atPolyfill, writable: true, configurable: true,
  });
}
if (!(String.prototype as any).at) {
  Object.defineProperty(String.prototype, 'at', {
    value: atPolyfill, writable: true, configurable: true,
  });
}

// String.prototype.replaceAll — Safari 13.1+ (на всякий случай для совсем старых)
if (!(String.prototype as any).replaceAll) {
  Object.defineProperty(String.prototype, 'replaceAll', {
    value(this: string, search: any, replace: any) {
      if (Object.prototype.toString.call(search) === '[object RegExp]') {
        return this.replace(search, replace);
      }
      return this.split(search).join(replace);
    },
    writable: true, configurable: true,
  });
}

export {};
