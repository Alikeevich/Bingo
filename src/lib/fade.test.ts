import { describe, it, expect } from 'vitest';
import { clampFadeSec, loadFadeSettings, fadeInMs, fadeOutLeadSec } from './fade';

const mem = (raw: string | null) => ({ getItem: () => raw });

describe('настройка плавности', () => {
  it('держит значения в пределах 0–5 с шагом 0.5', () => {
    expect(clampFadeSec(2.3)).toBe(2.5);
    expect(clampFadeSec(9)).toBe(5);
    expect(clampFadeSec(-1)).toBe(0);
    expect(clampFadeSec('abc')).toBe(0);
  });

  it('битая запись в браузере не ломает пульт', () => {
    expect(loadFadeSettings(mem('{oops'))).toEqual({ inSec: 0, outSec: 0 });
    expect(loadFadeSettings(mem(null))).toEqual({ inSec: 0, outSec: 0 });
    expect(loadFadeSettings(mem('{"inSec":3,"outSec":99}'))).toEqual({ inSec: 3, outSec: 5 });
  });
});

describe('появление звука', () => {
  it('без настройки — короткие 60 мс против щелчка', () => {
    expect(fadeInMs({ inSec: 0, outSec: 0 })).toBe(60);
  });
  it('по настройке ведущего', () => {
    expect(fadeInMs({ inSec: 2, outSec: 0 }, 30)).toBe(2000);
  });
  it('на коротком фрагменте занимает не больше половины', () => {
    expect(fadeInMs({ inSec: 5, outSec: 0 }, 6)).toBe(3000);
  });
});

describe('затухание перед концом фрагмента', () => {
  it('без настройки и без авто-хода — не затухаем', () => {
    expect(fadeOutLeadSec({ inSec: 0, outSec: 0 }, 30, false)).toBeNull();
  });
  it('без настройки при авто-ходе — 180 мс, чтобы переход был без щелчка', () => {
    expect(fadeOutLeadSec({ inSec: 0, outSec: 0 }, 30, true)).toBe(0.18);
  });
  it('настройка ведущего работает и без авто-хода', () => {
    expect(fadeOutLeadSec({ inSec: 0, outSec: 3 }, 30, false)).toBe(3);
  });
  it('на коротком фрагменте занимает не больше половины', () => {
    expect(fadeOutLeadSec({ inSec: 0, outSec: 5 }, 4, true)).toBe(2);
  });
});
