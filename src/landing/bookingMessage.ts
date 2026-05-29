export type BookingPayload = {
  mode: 'game' | 'franchise';
  name: string;
  phone: string;
  date?: string;
  people?: string;
  occasion?: string;
  city?: string;
  comment?: string;
};

// Текст уведомления, который бот отправляет владельцу. Без эмодзи.
export function formatBookingMessage(p: BookingPayload): string {
  if (p.mode === 'franchise') {
    return [
      'Новая заявка на ФРАНШИЗУ MuzBingo',
      '',
      `Имя: ${p.name}`,
      `Телефон: ${p.phone}`,
      p.city && `Город: ${p.city}`,
      p.comment && `О себе: ${p.comment}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    'Новая заявка на игру MuzBingo',
    '',
    `Имя: ${p.name}`,
    `Телефон: ${p.phone}`,
    p.date && `Дата: ${p.date}`,
    p.people && `Гостей: ${p.people}`,
    p.occasion && `Повод: ${p.occasion}`,
    p.comment && `Комментарий: ${p.comment}`,
  ]
    .filter(Boolean)
    .join('\n');
}
