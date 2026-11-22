import { describe, it, expect } from 'vitest';
import { parseAddGame, splitForTelegram } from '../api/telegram';

describe('/addgame', () => {
  it('разбирает город, место и цену', () => {
    expect(parseAddGame("2026-11-21 20:00 экибастуз | Harat's Pub | 5 000 тг")).toEqual({
      startsAt: '2026-11-21T15:00:00.000Z', city: 'Экибастуз', venue: "Harat's Pub", price: 5000,
    });
  });

  it('старый формат без «|» — Астана, всё остальное считается местом', () => {
    expect(parseAddGame('2026-11-22 19:30 Barley')).toMatchObject({ city: 'Астана', venue: 'Barley', price: null });
  });

  it('несуществующая дата не превращается молча в другой день', () => {
    // JS превращает 31 февраля в 3 марта — игра ушла бы в календарь не тем числом
    expect(parseAddGame('2026-02-31 20:00 Астана | Barley')).toEqual({ error: expect.any(String) });
    expect(parseAddGame('2026-11-21 24:30 Астана | Barley')).toEqual({ error: expect.any(String) });
  });
});

describe('длинные ответы бота', () => {
  it('короткий текст уходит одним сообщением', () => {
    expect(splitForTelegram('a\nb')).toEqual(['a\nb']);
  });

  it('список из сотни записей режется по строкам, ни одна не теряется и не рвётся', () => {
    const lines = Array.from({ length: 120 }, (_, i) => `  [#${i}] Гость номер ${i} · +7 701 000 00 ${String(i).padStart(2, '0')} · 3 чел.`);
    const parts = splitForTelegram(lines.join('\n'));
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(4000);
    expect(parts.join('\n').split('\n')).toEqual(lines);
  });
});
