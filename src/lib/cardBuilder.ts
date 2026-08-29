import { BingoCard, Round, Track } from '../types';

// 5 рядов + 5 столбцов + 2 диагонали. Индексы клеток 0..24, центр (12) — FREE.
export const WIN_LINES: number[][] = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
  [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
  [0,6,12,18,24],[4,8,12,16,20],
];

export type Cells = (Track | { isFreeSpace: true })[];

/**
 * На каком индексе очереди карточка ВПЕРВЫЕ выполнит условие победы.
 * playIndexOf: id трека → позиция в очереди. Свободная клетка отмечена всегда.
 */
export function winIndexForCard(
  cells: Cells,
  playIndexOf: Map<string, number>,
  condition: Round['winCondition']
): number {
  const cellPlay = cells.map(c =>
    'isFreeSpace' in c ? -1 : (playIndexOf.get(String((c as Track).id)) ?? Infinity)
  );
  const lineDoneAt = WIN_LINES.map(line => Math.max(...line.map(i => cellPlay[i])));
  const sorted = [...lineDoneAt].sort((a, b) => a - b);
  if (condition === '1_line')  return sorted[0];
  if (condition === '2_lines') return sorted[1];
  if (condition === '3_lines') return sorted[2];
  return Math.max(...cellPlay);   // full — когда отмечены все 24
}

// Сколько линий должно закрыться к моменту победы
const linesNeeded = (condition: Round['winCondition']): number =>
  condition === '1_line' ? 1 : condition === '2_lines' ? 2 : condition === '3_lines' ? 3 : 0;

/**
 * Раньше какого хода победа невозможна физически.
 * «Вся карточка» = 24 песни, значит минимум 24-я песня очереди.
 * Линия = 5 клеток (или 4 + FREE), две линии = 9-10 клеток и т.д.
 */
export function minWinIndex(condition: Round['winCondition']): number {
  if (condition === 'full') return 23;
  return linesNeeded(condition) * 5 - 1;
}

/**
 * Позже какого хода победа невозможна.
 * «Вся карточка» — до самого конца очереди. Для линий нужно, чтобы ОСТАЛЬНЫЕ
 * линии закрылись позже, а для этого достаточно нескольких клеток с «поздними»
 * треками, расставленных так, чтобы задеть каждую линию (см. LATE_BUDGET).
 */
const LATE_BUDGET = 7;
export function maxWinIndex(condition: Round['winCondition'], queueLength: number): number {
  if (condition === 'full') return queueLength - 1;
  return queueLength - 1 - LATE_BUDGET;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Ряды и столбцы без центра — из них берём непересекающиеся «победные» линии
const CLEAN_LINES = [
  [0,1,2,3,4],[5,6,7,8,9],[15,16,17,18,19],[20,21,22,23,24],   // ряды 0,1,3,4
  [0,5,10,15,20],[1,6,11,16,21],[3,8,13,18,23],[4,9,14,19,24], // столбцы 0,1,3,4
];

/**
 * Собирает карточку, которая закроется РОВНО на треке с индексом target.
 *
 * Идея: победная линия набирается из треков «до target» плюс сам target,
 * остальные клетки — из треков «после target», тогда ни одна другая линия
 * раньше закрыться не может (любая другая линия пересекается с победной
 * максимум в одной клетке). Для 2/3 линий берём непересекающиеся ряды/столбцы:
 * первые закрываются раньше, последняя — ровно на target.
 *
 * Сначала пробуем «живой» вариант, где часть лишних клеток тоже из ранних
 * треков (карточка выглядит естественно и заполняется по ходу игры), и
 * проверяем результат. Если не сходится — гарантированная раскладка.
 */
export function buildCardForWinIndex(
  queue: Track[],
  condition: Round['winCondition'],
  target: number,
  playIndexOf: Map<string, number>
): Cells | null {
  if (target < minWinIndex(condition) || target > maxWinIndex(condition, queue.length)) return null;

  const early = queue.slice(0, target);
  const targetTrack = queue[target];
  const late = queue.slice(target + 1);
  const need = linesNeeded(condition);

  const attempt = (naturalness: number): Cells | null => {
    const cells: (Track | { isFreeSpace: true } | null)[] = new Array(25).fill(null);
    cells[12] = { isFreeSpace: true };
    const earlyPool = shuffle(early);
    const latePool = shuffle(late);
    const takeEarly = () => earlyPool.pop();
    const takeLate  = () => latePool.pop();

    if (condition === 'full') {
      // вся карточка: 23 ранних трека + сам target
      if (earlyPool.length < 23) return null;
      const idx = shuffle([...Array(25).keys()].filter(i => i !== 12));
      cells[idx[0]] = targetTrack;
      for (let k = 1; k < idx.length; k++) cells[idx[k]] = takeEarly()!;
    } else {
      const lines = shuffle(CLEAN_LINES).slice(0, need);
      if (lines.length < need) return null;
      // все линии кроме последней закрываются раньше target
      for (let li = 0; li < need - 1; li++) {
        for (const i of lines[li]) {
          const t = takeEarly();
          if (!t) return null;
          cells[i] = t;
        }
      }
      // последняя линия: target + ранние
      const winLine = shuffle(lines[need - 1]);
      cells[winLine[0]] = targetTrack;
      for (let k = 1; k < winLine.length; k++) {
        const t = takeEarly();
        if (!t) return null;
        cells[winLine[k]] = t;
      }
      // Чтобы НИ ОДНА другая линия не закрылась раньше, в каждой из них должна
      // быть хотя бы одна клетка с «поздним» треком. Клеток на это нужно мало:
      // одна клетка сидит сразу в ряду, столбце и (иногда) диагонали. Жадно
      // выбираем такие клетки, остальное можно заполнять чем угодно — поэтому
      // победу можно назначить почти на любую песню тура.
      const winCells = new Set<number>(lines.flat());
      const freeIdx = [...Array(25).keys()].filter(i => i !== 12 && !winCells.has(i));
      const blocked = new Set<number>();
      const isWinLine = (l: number[]) => lines.some(w => w.every(x => l.includes(x)) || l.every(x => w.includes(x)));
      const mustBlock = WIN_LINES.map((l, li) => ({ l, li })).filter(({ l }) => !isWinLine(l));
      const lateCells = new Set<number>();
      for (;;) {
        const open = mustBlock.filter(({ li }) => !blocked.has(li));
        if (open.length === 0) break;
        let best = -1, bestScore = 0;
        for (const i of freeIdx) {
          if (lateCells.has(i)) continue;
          const score = open.filter(({ l }) => l.includes(i)).length;
          if (score > bestScore) { bestScore = score; best = i; }
        }
        if (best < 0) return null;                    // нечем перекрыть — раскладка невозможна
        lateCells.add(best);
        open.forEach(({ l, li }) => { if (l.includes(best)) blocked.add(li); });
      }
      for (const i of lateCells) {
        const t = takeLate();
        if (!t) return null;
        cells[i] = t;
      }
      // оставшиеся клетки: смесь ранних и поздних — карточка выглядит живой
      for (let i = 0; i < 25; i++) {
        if (cells[i]) continue;
        const useEarly = Math.random() < naturalness && earlyPool.length > 0;
        const t = useEarly ? takeEarly() : (takeLate() || takeEarly());
        if (!t) return null;
        cells[i] = t;
      }
    }

    if (cells.some(c => c === null)) return null;
    const result = cells as Cells;
    return winIndexForCard(result, playIndexOf, condition) === target ? result : null;
  };

  // сначала «живые» раскладки, потом строгая (все лишние клетки — поздние треки)
  for (const naturalness of [0.45, 0.45, 0.3, 0.3, 0.15, 0.15, 0]) {
    for (let tries = 0; tries < 30; tries++) {
      const cells = attempt(naturalness);
      if (cells) return cells;
    }
  }
  return null;
}

/** Случайная карточка — режим «автоматически», как было до настройки моментов победы */
export function buildRandomCells(uniqueTracks: Track[]): Cells {
  const cardTracks = shuffle(uniqueTracks).slice(0, 24);
  return [...cardTracks.slice(0, 12), { isFreeSpace: true }, ...cardTracks.slice(12, 24)];
}

export interface GeneratedCard extends BingoCard { winAt: number }
