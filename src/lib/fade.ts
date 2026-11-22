// Плавное появление и затухание звука в игре. Ведущий настраивает их прямо в пульте
// (0–5 секунд), настройка живёт в браузере ведущего и переживает перезагрузку.

export interface FadeSettings {
  /** Секунды плавного появления в начале трека, 0 — без него */
  inSec: number;
  /** Секунды затухания перед концом фрагмента, 0 — без него */
  outSec: number;
}

export const FADE_MAX_SEC = 5;
export const FADE_STEP_SEC = 0.5;
const STORAGE_KEY = 'muzbingo.fade';

// Без настройки звук всё равно не стартует щелчком: 60 мс появления,
// а при авто-ходе — 180 мс затухания перед переходом к следующему треку.
const CLICK_GUARD_IN_MS = 60;
const AUTO_ADVANCE_OUT_SEC = 0.18;

export const DEFAULT_FADE: FadeSettings = { inSec: 0, outSec: 0 };

/** Приводит значение к сетке 0..5 с шагом 0.5; мусор превращается в 0. */
export function clampFadeSec(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  const snapped = Math.round(n / FADE_STEP_SEC) * FADE_STEP_SEC;
  return Math.min(FADE_MAX_SEC, Math.max(0, snapped));
}

export function loadFadeSettings(storage: Pick<Storage, 'getItem'> | undefined): FadeSettings {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FADE;
    const parsed = JSON.parse(raw);
    return { inSec: clampFadeSec(parsed?.inSec), outSec: clampFadeSec(parsed?.outSec) };
  } catch {
    return DEFAULT_FADE;
  }
}

export function saveFadeSettings(storage: Pick<Storage, 'setItem'> | undefined, s: FadeSettings): void {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* приватный режим — не критично */ }
}

// Короткий фрагмент не должен целиком состоять из появления и затухания:
// каждому достаётся не больше половины длины фрагмента.
const capToHalf = (sec: number, segLengthSec: number) =>
  segLengthSec > 0 ? Math.min(sec, segLengthSec / 2) : sec;

/** Длительность появления звука в миллисекундах. */
export function fadeInMs(s: FadeSettings, segLengthSec = 0): number {
  if (s.inSec <= 0) return CLICK_GUARD_IN_MS;
  return Math.round(capToHalf(s.inSec, segLengthSec) * 1000);
}

/**
 * За сколько секунд до конца фрагмента начинать затухание; null — не затухать.
 * Своё затухание работает всегда. Без него — только короткое перед авто-переходом,
 * чтобы следующий трек не начинался со щелчка.
 */
export function fadeOutLeadSec(s: FadeSettings, segLengthSec: number, autoAdvance: boolean): number | null {
  if (s.outSec > 0) return capToHalf(s.outSec, segLengthSec);
  return autoAdvance ? AUTO_ADVANCE_OUT_SEC : null;
}
