import { describe, it, expect } from 'vitest';
import { evaluateCard, findCardByNumber } from './cardBuilder';

// Отмеченные клетки задаём индексами 0..24; центр (12) — свободная клетка.
const marked = (...idx: number[]) => {
  const set = new Set(idx);
  return Array.from({ length: 25 }, (_, i) => i === 12 || set.has(i));
};

describe('evaluateCard', () => {
  it('одна закрытая строка — победа при условии «1 линия»', () => {
    const r = evaluateCard(marked(0, 1, 2, 3, 4), '1_line');
    expect(r.linesCount).toBe(1);
    expect(r.isWinner).toBe(true);
  });

  it('центральный ряд закрывается четырьмя клетками благодаря свободной', () => {
    expect(evaluateCard(marked(10, 11, 13, 14), '1_line').isWinner).toBe(true);
  });

  it('одной линии мало для «2 линий», двух хватает', () => {
    expect(evaluateCard(marked(0, 1, 2, 3, 4), '2_lines').isWinner).toBe(false);
    // первая строка + первый столбец
    expect(evaluateCard(marked(0, 1, 2, 3, 4, 5, 10, 15, 20), '2_lines')).toMatchObject({ linesCount: 2, isWinner: true });
  });

  it('«вся карточка» не засчитывается, пока открыта хотя бы одна клетка', () => {
    const all = Array.from({ length: 25 }, (_, i) => i);
    expect(evaluateCard(marked(...all.filter(i => i !== 24)), 'full').isWinner).toBe(false);
    expect(evaluateCard(marked(...all), 'full').isWinner).toBe(true);
  });

  it('неизвестное условие (старые данные) никого не объявляет победителем', () => {
    const all = Array.from({ length: 25 }, (_, i) => i);
    expect(evaluateCard(marked(...all), 'whatever' as any).isWinner).toBe(false);
  });
});

describe('findCardByNumber', () => {
  const cards = [{ id: '7', cells: [] }, { id: '120', cells: [] }];
  it('находит карточку, как бы ведущий ни набрал номер', () => {
    expect(findCardByNumber(cards, '7')?.id).toBe('7');
    expect(findCardByNumber(cards, ' #7 ')?.id).toBe('7');
    expect(findCardByNumber(cards, '007')?.id).toBe('7');
    expect(findCardByNumber(cards, '№120')?.id).toBe('120');
  });
  it('не путает разные номера', () => {
    expect(findCardByNumber(cards, '12')).toBeUndefined();
    expect(findCardByNumber(cards, '')).toBeUndefined();
  });
});
