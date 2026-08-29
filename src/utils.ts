import type { Track } from './types';

export const chunkArray = (arr: any[], size: number) =>
  arr.reduce((acc: any[], _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]),[]);

export const formatTime = (time: number) => {
  if (isNaN(time) || !isFinite(time)) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const getProxiedUrl = (url: string): string => {
  if (!url) return url;
  return url.replace('http://', 'https://');
};

// Разбивает строку артиста на отдельных исполнителей, чтобы фиты не обходили
// правило уникальности. "Justin Bieber, Daniel Caesar & Giveon (feat. X)" →
// ["justin bieber", "daniel caesar", "giveon", "x"].
export const splitArtists = (artist: string): string[] => {
  if (!artist) return [];
  return artist
    .toLowerCase()
    // убираем скобки вокруг feat-блоков, но оставляем их содержимое
    .replace(/[()[\]]/g, ' ')
    // слова-разделители соавторов → запятая
    .replace(/\b(feat|ft|featuring|with|vs|versus)\b\.?/gi, ',')
    // коллаб-«x» и «/» только в окружении пробелов (чтобы не ломать "Charli XCX", "AC/DC")
    .replace(/\s+x\s+/gi, ',')
    .replace(/\s+\/\s+/g, ',')
    .replace(/\s+и\s+/gi, ',')
    // однозначные символы-разделители
    .replace(/[&×;]/g, ',')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
};

// Множество всех артистов плейлиста (с учётом фитов) — для проверки пересечений.
export const playlistArtistSet = (tracks: { artist: string }[]): Set<string> => {
  const set = new Set<string>();
  for (const t of tracks) for (const a of splitArtists(t.artist)) set.add(a);
  return set;
};

// Есть ли у трека артист (или фит-артист), уже присутствующий в плейлисте.
export const sharesArtist = (artist: string, present: Set<string>): boolean =>
  splitArtists(artist).some((a) => present.has(a));

// Ключ «песни» для дедупа очереди воспроизведения. Deezer часто отдаёт одну и ту же
// песню с разными хвостами в названии — «Peaches», «Peaches (feat. …)», «… (Remastered)»,
// «… - Radio Edit». Срезаем скобки и хвосты после « - », берём главного артиста.
export const songKey = (title: string, artist: string): string => {
  const full = (title || '').toLowerCase().replace(/[^a-zа-яё0-9]+/gi, ' ').trim().replace(/\s+/g, ' ');
  const stripped = (title || '')
    .toLowerCase()
    .replace(/[([{].*$/, '')   // всё от первой открывающей скобки
    .replace(/\s-\s.*$/, '')   // хвост после " - " (Remastered, Radio Edit и т.п.)
    .replace(/\b(feat|ft|featuring|with)\b.*$/i, '') // на всякий случай — feat без скобок
    .replace(/[^a-zа-яё0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  // Если после срезки ничего не осталось (название целиком в скобках) — берём полное.
  const baseTitle = stripped || full;
  const primary = splitArtists(artist)[0] || (artist || '').trim().toLowerCase();
  return baseTitle + '|' + primary;
};
// ────────────────────────────────────────────────────────────────────────
// ОЧЕРЕДЬ ВОСПРОИЗВЕДЕНИЯ ТУРА
// ────────────────────────────────────────────────────────────────────────
// Один и тот же список используют И генератор карточек, И сам тур.
// Иначе в клетку попадает трек, которого в очереди нет, и карточка не
// закроется НИКОГДА (для условия «вся карточка» хватает одного такого трека,
// чтобы убить треть карточек).
//
// Порядок = порядок плейлиста (шафл на старте убран специально).
// Уникализируем дважды: по id И по «ключу песни» — одна и та же песня,
// попавшая в плейлист под разными id или с разными хвостами в названии
// (Peaches / Peaches (feat. …) / … - Radio Edit), не должна звучать дважды.
// Плейлист хранит СНАПШОТ трека на момент добавления, поэтому подмешиваем
// свежую запись из базы по id (там мог появиться полный MP3, обрезка,
// исправленное название).
export const buildPlayQueue = (playlistTracks: Track[], dbTracks: Track[] = []): Track[] => {
  const freshById = new Map(dbTracks.map((t) => [String(t.id), t]));
  const seenIds = new Set<string>();
  const seenSongs = new Set<string>();
  const queue: Track[] = [];
  for (const raw of playlistTracks || []) {
    const id = String(raw.id);
    if (seenIds.has(id)) continue;
    const fresh = freshById.get(id);
    const t: Track = fresh ? { ...raw, ...fresh } : raw;
    const key = songKey(t.title, t.artist);
    if (seenSongs.has(key)) continue;
    seenIds.add(id);
    seenSongs.add(key);
    queue.push(t);
  }
  return queue;
};

// ────────────────────────────────────────────────────────────────────────
// ОТМЕЧЕНА ЛИ КЛЕТКА КАРТОЧКИ
// ────────────────────────────────────────────────────────────────────────
// Сравниваем не только по id, но и по «ключу песни». Одна и та же песня легко
// оказывается в базе под разными id: трек перезалили, добавили второй раз,
// добавили версию «(Remastered)». В карточку попал один id, в туре прозвучал
// другой — ведущий песню сыграл, гость честно закрыл клетку, а система считала
// её незакрытой, и человек «не выигрывал» при живом бинго.
export const buildCellMatcher = (
  queue: Track[],
  playedIds: Set<string>
): ((cell: Track | { isFreeSpace: true }) => boolean) => {
  const playedSongs = new Set<string>();
  for (const t of queue) {
    if (playedIds.has(String(t.id))) playedSongs.add(songKey(t.title, t.artist));
  }
  return (cell) => {
    if ('isFreeSpace' in cell) return true;
    if (playedIds.has(String(cell.id))) return true;
    return playedSongs.has(songKey(cell.title, cell.artist));
  };
};
