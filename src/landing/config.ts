// Заявки на бронь/франшизу уходят владельцу через Telegram-бота.
// Токен бота и chat_id владельца задаются в env-переменных (НЕ здесь, чтобы не палить токен на клиенте):
//   TELEGRAM_BOT_TOKEN — токен бота из BotFather
//   TELEGRAM_CHAT_ID   — chat_id владельца (написать боту /start, затем взять id из getUpdates)
// Локально — в .env.local, в проде — в Vercel → Settings → Environment Variables.

// ⚠️ ЗАПОЛНИ: публичный Telegram-контакт владельца для футера (БЕЗ @).
export const OWNER_TELEGRAM = 'muzbingo';

// Контакты для футера (плейсхолдеры — поправь)
export const CONTACTS = {
  phone: '+7 (700) 000-00-00',
  instagram: 'muzbingo',
  city: 'Павлодар, Казахстан',
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
