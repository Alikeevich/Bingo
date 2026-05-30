// Заявки на бронь/франшизу уходят владельцу через Telegram-бота.
// Токен бота и chat_id владельца задаются в env-переменных (НЕ здесь, чтобы не палить токен на клиенте):
//   TELEGRAM_BOT_TOKEN — токен бота из BotFather
//   TELEGRAM_CHAT_ID   — chat_id владельца (написать боту /start, затем взять id из getUpdates)
// Локально — в .env.local, в проде — в Vercel → Settings → Environment Variables.

// ⚠️ ЗАПОЛНИ: публичный Telegram-контакт владельца для футера (БЕЗ @).
export const OWNER_TELEGRAM = 'kazheke_12';

// Контакты для футера (плейсхолдеры — поправь)
export const CONTACTS = {
  phone: '+7 (775) 000-30-07',
  instagram: 'muzbingo_astana',
  city: 'Астана, Казахстан',
};

// Поводы для игры — показываются в форме брони и в секции «для кого»
export const OCCASIONS = [
  'День рождения',
  'Корпоратив',
  'Вечер с друзьями',
  'Свидание / пара',
  'Девичник / мальчишник',
  'Другое',
];

// Фотографии с реальных игр (лежат в public/, отдаются по /1.jpg .. /8.jpg)
export const EVENT_PHOTOS = ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg', '/6.jpg', '/7.jpg', '/8.jpg'];

export type Partner = {
  name: string;
  handle: string; // Instagram username без @
  description: string;
};

// Партнёры — призы / коллаборации на играх. Описания — короткие, можно править.
export const PARTNERS: Partner[] = [
  {
    name: 'Dr. Joys',
    handle: 'drjoysoriginal',
    description: 'Бренд интимного здоровья и заботы о себе.',
  },
  {
    name: 'FitLab',
    handle: 'fitlabkz',
    description: 'Женская фитнес-студия — занятия для тех, кто заботится о теле.',
  },
  {
    name: 'CashPro',
    handle: 'cashpro.kz',
    description: 'Подарочные сертификаты и денежные подарки — современный способ дарить.',
  },
  {
    name: 'Drum Avenue',
    handle: 'drum_avenue_astana',
    description: 'Школа игры на барабанах — от первого ритма до сцены.',
  },
  {
    name: 'Sound Era',
    handle: 'sound_era_astana',
    description: 'Студия вокала — поставим голос и научим петь.',
  },
  {
    name: 'Victoria · psy',
    handle: 'victoria__psy',
    description: 'Психолог-сексолог. Онлайн-сессии о близости, честности и внутреннем комфорте.',
  },
];
