/**
 * Сохранение текущего тура в localStorage — чтобы случайный F5 (или засыпание
 * ноутбука) не убивал игру на глазах у зала.
 *
 * Почему отдельный модуль, а не просто JSON.stringify всего состояния:
 *
 * 1) РАЗМЕР. В hostSession лежит вся игра целиком — а в каждом туре у игры
 *    есть массив карточек, и в каждой карточке 24 ПОЛНЫХ трека (обложка,
 *    ссылка на превью, ссылка на MP3, теги). Игра на 2 тура по 100 карточек —
 *    это ~3.7 МБ JSON, на 3 тура по 150 — уже ~7 МБ. Лимит localStorage в
 *    Safari и Chrome — 5 МБ на домен, поэтому setItem падал с
 *    QuotaExceededError («The quota has been exceeded.»), а так как это
 *    происходило внутри useEffect — React ронял всё приложение в
 *    ErrorBoundary прямо посреди тура.
 *    Поэтому сохраняем СЛЕПОК: игру/плейлист — только id и название, в
 *    клетках карточек — только id/название/исполнителя (больше во время тура
 *    и не нужно: id для авто-бинго и проверки карточки, название — показать в
 *    сетке). Полные объекты возвращаются из базы после загрузки (rehydrate).
 *
 * 2) БЕЗОПАСНОСТЬ. Любое обращение к localStorage может бросить исключение:
 *    в Safari — SecurityError, если запрещены «данные сайтов», и
 *    QuotaExceededError в приватном режиме. Сохранение игры — вещь
 *    вспомогательная, она НИКОГДА не должна ронять приложение, поэтому здесь
 *    всё обёрнуто в try/catch.
 */
import type { BingoCard, Game, Playlist, Round, Track } from '../types';

const KEY = 'muzbingo_host_session';
const VERSION = 2;

export interface HostSessionSnapshot {
  hostSession: { game: Game; round: Round; playlist: Playlist };
  shuffledTracks: Track[];
  playedTrackIds: (string | number)[];
  currentHostTrackIndex: number;
  hideTrackInfo: boolean;
}

/** Что реально уходит в localStorage */
interface StoredCell { id: Track['id']; title: string; artist: string }
interface StoredCard { id: string; cells: (StoredCell | { isFreeSpace: true })[] }
interface StoredSnapshot {
  v: number;
  game: { id: string; name: string };
  round: { id: string; name: string; playlistId: string; winCondition: Round['winCondition']; cards?: StoredCard[] };
  playlist: { id: string; name: string };
  shuffledTracks: Track[];
  playedTrackIds: (string | number)[];
  currentHostTrackIndex: number;
  hideTrackInfo: boolean;
}

/** Safari бросает SecurityError на само обращение к localStorage, если сайту запрещены данные */
function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function isQuotaError(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  return e.name === 'QuotaExceededError'        // Safari / Chrome
      || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' // Firefox
      || e.code === 22 || e.code === 1014;       // старые движки без имени
}

const slimCard = (card: BingoCard): StoredCard => ({
  id: card.id,
  cells: card.cells.map(cell =>
    'isFreeSpace' in cell ? cell : { id: cell.id, title: cell.title, artist: cell.artist }
  ),
});

function toStored(s: HostSessionSnapshot, withCards: boolean): StoredSnapshot {
  const { game, round, playlist } = s.hostSession;
  return {
    v: VERSION,
    game: { id: game.id, name: game.name },
    round: {
      id: round.id, name: round.name, playlistId: round.playlistId, winCondition: round.winCondition,
      cards: withCards ? (round.cards || []).map(slimCard) : undefined,
    },
    playlist: { id: playlist.id, name: playlist.name },
    shuffledTracks: s.shuffledTracks,
    playedTrackIds: s.playedTrackIds,
    currentHostTrackIndex: s.currentHostTrackIndex,
    hideTrackInfo: s.hideTrackInfo,
  };
}

export type SaveResult = 'ok' | 'ok-without-cards' | 'failed';

/**
 * Пишет слепок тура. Если места всё равно не хватило — пробует без карточек
 * (карточки всё равно лежат в базе и вернутся после перезагрузки), и только
 * потом сдаётся. Исключений наружу не бросает никогда.
 */
export function saveHostSession(s: HostSessionSnapshot): SaveResult {
  const ls = store();
  if (!ls) return 'failed';

  const attempts: { result: SaveResult; build: () => StoredSnapshot }[] = [
    { result: 'ok',               build: () => toStored(s, true)  },
    { result: 'ok-without-cards', build: () => toStored(s, false) },
  ];

  for (const attempt of attempts) {
    try {
      ls.setItem(KEY, JSON.stringify(attempt.build()));
      return attempt.result;
    } catch (e) {
      if (!isQuotaError(e)) break;
      // Старое (большое) значение само занимает квоту — убираем перед новой попыткой
      try { ls.removeItem(KEY); } catch { /* не важно */ }
    }
  }

  clearHostSession();
  console.warn('[MuzBingo] не удалось сохранить тур в localStorage — восстановление после F5 недоступно');
  return 'failed';
}

export function clearHostSession(): void {
  try { store()?.removeItem(KEY); } catch { /* не важно */ }
}

/**
 * Читает слепок. Понимает и старый формат (v1, до слепков), чтобы игра,
 * начатая до обновления сайта, пережила деплой.
 */
export function loadHostSession(): HostSessionSnapshot | null {
  const ls = store();
  if (!ls) return null;

  let raw: string | null = null;
  try { raw = ls.getItem(KEY); } catch { return null; }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    // v1 — целиком сохранённые объекты
    const hostSession = parsed?.v >= 2
      ? {
          // rounds/tracks во время тура нигде не читаются; полные объекты
          // подставит rehydrate после загрузки из базы
          game:     { ...parsed.game, rounds: [] } as Game,
          round:    parsed.round as Round,
          playlist: { ...parsed.playlist, tracks: [] } as Playlist,
        }
      : parsed?.hostSession;

    if (!hostSession?.game || !hostSession?.round) { clearHostSession(); return null; }

    return {
      hostSession,
      shuffledTracks: parsed.shuffledTracks || [],
      playedTrackIds: parsed.playedTrackIds || [],
      currentHostTrackIndex: parsed.currentHostTrackIndex || 0,
      hideTrackInfo: parsed.hideTrackInfo ?? true,
    };
  } catch {
    clearHostSession();
    return null;
  }
}
