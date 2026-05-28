import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { Music, ListMusic, LayoutTemplate, PartyPopper, CheckCircle2, Globe, Database, Loader2, X, Scissors } from 'lucide-react';
import { Track, Playlist, Game, Round, Template, BingoCard, Tag } from './types';
import { migrateTemplate } from './lib/migrateTemplate';
import AudioTrimmer from './components/AudioTrimmer';

// Вкладки
import GamesTab from './components/tabs/GamesTab';
import PlaylistsTab from './components/tabs/PlaylistsTab';
import TemplatesTab from './components/tabs/TemplatesTab';
import GlobalSearchTab from './components/tabs/GlobalSearchTab';
import MyDatabaseTab from './components/tabs/MyDatabaseTab';

// Экраны
import PrintView from './components/screens/PrintView';
import HostScreen from './components/screens/HostScreen';
import Projector from './components/screens/Projector';

export default function App() {
  const [activeTab, setActiveTab] = useState<'games' | 'playlists' | 'mydatabase' | 'global_search' | 'templates'>('games');

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  
  const [dbTracks, setDbTracks] = useState<Track[]>([]);
  const [dbTags, setDbTags] = useState<Tag[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Скрытый второй <audio>, который пре-буферит следующий трек пока играет текущий.
  // Только preload — звук с него не идёт.
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  // Кеш промисов refresh Deezer-URL по track.id — чтобы параллельные вызовы (togglePlay + prefetchTrack)
  // не делали 2 одинаковых запроса к Deezer API.
  const refreshPromisesRef = useRef<Map<string, Promise<string | null>>>(new Map());
  // Активный фрагмент (preview_start / preview_end в секундах) текущего проигрываемого трека.
  // Хранится в ref чтобы onTimeUpdate (статичный хендлер) знал актуальные границы без re-attach.
  const currentSegmentRef = useRef<{ start?: number; end?: number; finished?: boolean }>({});
  // Интервал плавного изменения громкости (fade-in / fade-out)
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Флаг что fade-out уже запущен для текущего трека (чтобы не запускать повторно каждый onTimeUpdate)
  const fadeOutStartedRef = useRef(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | number | null>(null);
  // true когда текущий трек на паузе (но всё ещё «загружен»). Нужно чтобы resume
  // продолжал с той же секунды, а не перезагружал трек с начала.
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(false);

  const [hostSession, setHostSession] = useState<{ game: Game; round: Round; playlist: Playlist } | null>(null);
  const [shuffledTracks, setShuffledTracks] = useState<Track[]>([]);
  const [playedTrackIds, setPlayedTrackIds] = useState<Set<string | number>>(new Set());
  const [currentHostTrackIndex, setCurrentHostTrackIndex] = useState<number>(0);
  const [hideTrackInfo, setHideTrackInfo] = useState(true);
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [autoWinners, setAutoWinners] = useState<string[]>([]);

  const [printViewCards, setPrintViewCards] = useState<{ cards: BingoCard[]; template: Template } | null>(null);
  const [trackToAdd, setTrackToAdd] = useState<Track | null>(null); 
  const [toast, setToast] = useState<string | null>(null);

  // Стейты модалки сохранения/редактирования
  const [trackToAddToDb, setTrackToAddToDb] = useState<Track | null>(null);
  // true когда модалка открыта через onEditTrack (правка существующей записи),
  // false когда через handleUploadCustomFile или setTrackToAddToDb из Global Search.
  // Нужно для дедупа: при правке исключаем себя из сравнения, при добавлении — нет.
  const [isEditingTrack, setIsEditingTrack] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedArtist, setEditedArtist] = useState('');
  // Подтверждение дубликата (in-app, вместо нативного confirm)
  const [dupWarning, setDupWarning] = useState<Track | null>(null);
  const [editedPreviewStart, setEditedPreviewStart] = useState(0);
  const [editedPreviewEnd,   setEditedPreviewEnd]   = useState(0);
  const [customFileUrl, setCustomFileUrl] = useState<string | null>(null);
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [selectedTagsForNewTrack, setSelectedTagsForNewTrack] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isUploadingMp3, setIsUploadingMp3] = useState(false);

  useEffect(() => {
    fetchPlaylists();
    fetchGames();
    fetchTemplates();
    fetchDatabase();

    const savedSessionStr = localStorage.getItem('muzbingo_host_session');
    if (savedSessionStr) {
      try {
        const parsed = JSON.parse(savedSessionStr);
        if (parsed?.hostSession) {
          setHostSession(parsed.hostSession);
          setShuffledTracks(parsed.shuffledTracks || []);
          setPlayedTrackIds(new Set(parsed.playedTrackIds || []));
          setCurrentHostTrackIndex(parsed.currentHostTrackIndex || 0);
          setHideTrackInfo(parsed.hideTrackInfo ?? true);
          showToast('Игра восстановлена после обновления страницы!');
        }
      } catch (e) { localStorage.removeItem('muzbingo_host_session'); }
    }
  }, []);

  useEffect(() => {
    if (trackToAddToDb) {
      setEditedTitle(trackToAddToDb.title);
      setEditedArtist(trackToAddToDb.artist);
      setEditedPreviewStart(trackToAddToDb.previewStart ?? 0);
      setEditedPreviewEnd(trackToAddToDb.previewEnd ?? 0);
      // глушим глобальный плеер чтобы не пересекался со встроенным в триммер
      audioRef.current?.pause();
      setPlayingTrackId(null);
    } else {
      setEditedTitle('');
      setEditedArtist('');
      setEditedPreviewStart(0);
      setEditedPreviewEnd(0);
    }
  }, [trackToAddToDb]);

  // blob-URL для нового MP3 (источник для AudioTrimmer)
  useEffect(() => {
    if (!customFile) { setCustomFileUrl(null); return; }
    const url = URL.createObjectURL(customFile);
    setCustomFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [customFile]);

  useEffect(() => {
    if (hostSession) {
      localStorage.setItem('muzbingo_host_session', JSON.stringify({
        hostSession, shuffledTracks, playedTrackIds: Array.from(playedTrackIds), currentHostTrackIndex, hideTrackInfo,
      }));
    } else {
      localStorage.removeItem('muzbingo_host_session');
    }
  }, [hostSession, shuffledTracks, playedTrackIds, currentHostTrackIndex, hideTrackInfo]);

  // Пре-кеш следующего трека при изменении автоплея или индекса — для бесшовного перехода
  useEffect(() => {
    if (isAutoPlay && hostSession && currentHostTrackIndex < shuffledTracks.length - 1) {
      prefetchTrack(shuffledTracks[currentHostTrackIndex + 1]);
    }
  }, [isAutoPlay, hostSession, currentHostTrackIndex, shuffledTracks]);

  useEffect(() => {
    if (!hostSession?.round.cards || playedTrackIds.size === 0) return setAutoWinners([]);
    const condition = hostSession.round.winCondition;
    const linesIndices = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],[0,6,12,18,24],[4,8,12,16,20]];
    const winners = hostSession.round.cards.filter(card => {
      const matches = card.cells.map(cell => 'isFreeSpace' in cell ? true : playedTrackIds.has(cell.id));
      let linesCount = 0;
      linesIndices.forEach(line => { if (line.every(idx => matches[idx])) linesCount++; });
      if (condition === '1_line' && linesCount >= 1) return true;
      if (condition === '2_lines' && linesCount >= 2) return true;
      if (condition === 'full' && matches.every(m => m)) return true;
      return false;
    });
    setAutoWinners(winners.map(w => w.id));
  }, [playedTrackIds, hostSession]);

  const fetchPlaylists = async () => {
    const { data } = await supabase.from('playlists').select('*').order('created_at', { ascending: false });
    if (data) setPlaylists(data);
  };
  const fetchGames = async () => {
    const { data } = await supabase.from('games').select('*').order('created_at', { ascending: false });
    if (data) setGames(data);
  };
  const fetchTemplates = async () => {
    const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (data) setTemplates(data.map(migrateTemplate));
  };

  const fetchDatabase = async () => {
    const { data: tracksData } = await supabase.from('tracks').select('*').order('created_at', { ascending: false });
    const { data: tagsData } = await supabase.from('tags').select('*').order('name', { ascending: true });
    
    if (tracksData) {
      const mappedTracks: Track[] = tracksData.map(t => ({
        id: t.id, title: t.title, artist: t.artist, cover: t.cover,
        preview: t.preview, isCustom: t.is_custom, tags: t.tags,
        previewStart: t.preview_start != null ? Number(t.preview_start) : undefined,
        previewEnd:   t.preview_end   != null ? Number(t.preview_end)   : undefined,
      }));
      setDbTracks(mappedTracks);
    }
    if (tagsData) setDbTags(tagsData);
  };

  const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(null), 3000); };

  // ─── ПЛЕЕР: помощники для плавных переходов ───────────────────────────

  // Плавно меняет громкость аудио-элемента от `from` к `to` за `durationMs`
  const fadeVolume = (audio: HTMLAudioElement, from: number, to: number, durationMs: number) => {
    if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }
    const steps = 12;
    const stepMs = Math.max(8, durationMs / steps);
    const totalSteps = Math.max(1, Math.round(durationMs / stepMs));
    let i = 0;
    audio.volume = Math.max(0, Math.min(1, from));
    fadeIntervalRef.current = setInterval(() => {
      i++;
      const p = i / totalSteps;
      const v = from + (to - from) * p;
      audio.volume = Math.max(0, Math.min(1, v));
      if (i >= totalSteps) {
        audio.volume = Math.max(0, Math.min(1, to));
        if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }
      }
    }, stepMs);
  };

  // Проверяет URL Deezer по exp= токену и при необходимости обновляет через API.
  // Возвращает свежий URL или null если трек больше не доступен.
  // Кеширует параллельные вызовы для одного track.id.
  const refreshDeezerUrl = async (track: Track): Promise<string | null> => {
    const url = track.preview;
    if (!url) return null;
    // если нет токена expiry — считаем URL валидным
    if (!url.includes('exp=')) return url;
    const expMatch = url.match(/exp=(\d+)/);
    const exp = expMatch ? parseInt(expMatch[1]) : 0;
    // 10 секунд запаса, чтобы не успеть протухнуть пока браузер качает
    if (exp - 10 > Date.now() / 1000) return url;

    const key = String(track.id);
    const cached = refreshPromisesRef.current.get(key);
    if (cached) return cached;

    const promise = (async (): Promise<string | null> => {
      try {
        const res = await fetch(`/api/deezer/track/${track.id}`);
        const data = await res.json();
        if (data?.preview && typeof data.preview === 'string' && data.preview.length > 0) {
          const fresh: string = data.preview;
          // 1) в supabase tracks (fire-and-forget)
          supabase.from('tracks').update({ preview: fresh }).eq('id', String(track.id)).then(() => {});
          // 2) в стейте Моей Базы
          setDbTracks(prev => prev.map(t => String(t.id) === String(track.id) ? { ...t, preview: fresh } : t));
          // 3) в текущей host-сессии (важно — иначе следующий togglePlay снова с протухшим)
          setShuffledTracks(prev => prev.map(t => String(t.id) === String(track.id) ? { ...t, preview: fresh } : t));
          return fresh;
        }
        return null; // Deezer убрал превью — трек больше не играбелен
      } catch (e) {
        console.warn('refreshDeezerUrl failed for', track.id, e);
        return null;
      } finally {
        // через секунду удаляем из кеша (на случай если опять протухнет через время)
        setTimeout(() => refreshPromisesRef.current.delete(key), 1000);
      }
    })();

    refreshPromisesRef.current.set(key, promise);
    return promise;
  };

  // Резолвит готовый-к-воспроизведению URL для трека. Для Deezer — через refresh, для кастомных — из supabase storage.
  const resolveTrackUrl = async (track: Track): Promise<string | null> => {
    if (track.isCustom) {
      return supabase.storage.from('audio-tracks').getPublicUrl(String(track.id)).data.publicUrl;
    }
    return refreshDeezerUrl(track);
  };

  // Пре-кеширует следующий трек на скрытом audio-элементе — браузер скачает данные в фоне.
  // Для Deezer-треков с протухшим URL — заранее делает refresh, чтобы preload-элемент не упёрся в 403.
  const prefetchTrack = async (track: Track | undefined) => {
    const el = preloadAudioRef.current;
    if (!el || !track || !track.preview) return;
    const url = await resolveTrackUrl(track);
    if (!url) return; // трек недоступен, нет смысла грузить
    if (el.src && el.src.endsWith(url)) return;
    try { el.src = url; el.load(); } catch {}
  };

  const togglePlay = async (track: Track) => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (playingTrackId === track.id) {
      if (audioEl.paused) {
        // RESUME — продолжаем с текущей секунды, НЕ перезагружаем трек
        if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }
        audioEl.volume = 1;
        setIsPaused(false);
        audioEl.play().catch(console.error);
      } else {
        // PAUSE — оставляем playingTrackId, чтобы следующий клик продолжил с места
        audioEl.pause();
        setIsPaused(true);
      }
      return;
    }
    // Сбрасываем активный fade и флаги
    if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }
    fadeOutStartedRef.current = false;
    audioEl.pause();
    setPlayingTrackId(track.id);
    setIsPaused(false);

    // Запоминаем границы фрагмента для этого трека (использует onTimeUpdate глобального handler)
    currentSegmentRef.current = {
      start: typeof track.previewStart === 'number' && track.previewStart > 0 ? track.previewStart : undefined,
      end:   typeof track.previewEnd   === 'number' && track.previewEnd   > 0 ? track.previewEnd   : undefined,
      finished: false,
    };

    try {
      const currentUrl = await resolveTrackUrl(track);
      if (!currentUrl) {
        // Трек неиграбелен (Deezer убрал превью) — пропускаем и переходим к следующему в автоплее
        showToast(`«${track.title}» больше не доступен в Deezer`);
        setPlayingTrackId(null);
        if (isAutoPlay && hostSession && currentHostTrackIndex < shuffledTracks.length - 1) {
          setTimeout(() => playHostTrack(currentHostTrackIndex + 1), 400);
        }
        return;
      }
      // БЕЗ cache-buster — чтобы HTTP-кеш браузера хитил при повторном проигрывании
      // и чтобы preload-элемент мог подгреть тот же самый URL заранее.
      audioEl.src = currentUrl;
      audioEl.load();
      // Когда метаданные подгрузились — сикаем на старт фрагмента (если задан)
      const onMeta = () => {
        const s = currentSegmentRef.current.start;
        if (typeof s === 'number') {
          try { audioEl.currentTime = s; } catch {}
        }
        audioEl.removeEventListener('loadedmetadata', onMeta);
      };
      audioEl.addEventListener('loadedmetadata', onMeta);
      // Короткий fade-in (60мс) — звук не прыгает с тишины во весь объём
      audioEl.volume = 0;
      audioEl.play().then(() => fadeVolume(audioEl, 0, 1, 60)).catch(err => { console.error(err); setPlayingTrackId(null); });
    } catch (err) { console.error(err); setPlayingTrackId(null); }
  };

  // Что делать когда трек дошёл до конца (или до preview_end)
  const handleTrackFinished = () => {
    setPlayingTrackId(null);
    setIsPaused(false);
    if (isAutoPlay && hostSession && currentHostTrackIndex < shuffledTracks.length - 1) {
      playHostTrack(currentHostTrackIndex + 1);
      setHideTrackInfo(true);
    }
  };

  const startHostSession = (game: Game, round: Round) => {
    const playlist = playlists.find(p => p.id === round.playlistId);
    if (!playlist) return showToast('Плейлист не найден!');
    // Берём треки в том порядке, который задан в плейлисте — пользователь может
    // отдельно «перемешать» в Плейлистах, если хочет. Авто-шафл на старте убрали
    // чтобы случайные комбинации не давали бинго на рандомных карточках.
    setShuffledTracks([...playlist.tracks]);
    setPlayedTrackIds(new Set());
    setCurrentHostTrackIndex(0);
    setHideTrackInfo(true);
    setAutoWinners([]);
    setHostSession({ game, round, playlist });
  };

  const playHostTrack = (index: number) => {
    if (index < 0 || index >= shuffledTracks.length) return;
    setCurrentHostTrackIndex(index);
    const track = shuffledTracks[index];
    setPlayedTrackIds(prev => new Set(prev).add(track.id));
    togglePlay(track);
    // Параллельно — пре-кешим СЛЕДУЮЩИЙ трек, чтобы переход был мгновенным
    if (isAutoPlay) prefetchTrack(shuffledTracks[index + 1]);
  };

  const endHostSession = () => { if (confirm('Точно завершить тур?')) setHostSession(null); };

  const audioHandlers = {
    onTimeUpdate: (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const el = e.currentTarget;
      const t  = el.currentTime;
      setCurrentTime(t);
      const seg = currentSegmentRef.current;
      const effectiveEnd = typeof seg.end === 'number' && seg.end > 0
        ? seg.end
        : (Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0);

      // Достигли конца — пауза + переход на следующий
      if (!seg.finished && effectiveEnd > 0 && t >= effectiveEnd) {
        seg.finished = true;
        el.pause();
        handleTrackFinished();
        return;
      }

      // За 180мс до конца (если впереди ещё есть треки в hostSession+autoPlay) запускаем fade-out
      if (
        !fadeOutStartedRef.current &&
        effectiveEnd > 0 &&
        effectiveEnd - t < 0.18 &&
        isAutoPlay && hostSession &&
        currentHostTrackIndex < shuffledTracks.length - 1
      ) {
        fadeOutStartedRef.current = true;
        fadeVolume(el, el.volume, 0, 150);
      }
    },
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLAudioElement>) => setDuration(e.currentTarget.duration),
    onEnded: () => {
      currentSegmentRef.current.finished = true;
      handleTrackFinished();
    },
    onError: () => {
      // Самая частая причина — 403 от Deezer (URL протух) или сетевая ошибка.
      // Помечаем как «закончившийся» чтобы автоплей перешёл к следующему.
      if (currentSegmentRef.current.finished) return;
      currentSegmentRef.current.finished = true;
      const t = hostSession
        ? shuffledTracks[currentHostTrackIndex]
        : dbTracks.find(x => String(x.id) === String(playingTrackId));
      const name = t?.title ?? 'трек';
      showToast(`Не удалось проиграть «${name}» — пропускаю`);
      setPlayingTrackId(null);
      if (isAutoPlay && hostSession && currentHostTrackIndex < shuffledTracks.length - 1) {
        setTimeout(() => playHostTrack(currentHostTrackIndex + 1), 400);
      }
    },
  };

  // --- ЛОГИКА ТЕГОВ ---
  const handleAddTag = async (tagName: string) => {
    const name = tagName.trim();
    if (!name) return;
    if (selectedTagsForNewTrack.some(t => t.toLowerCase() === name.toLowerCase())) {
      setNewTagInput('');
      return;
    }
    const existingDbTag = dbTags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existingDbTag) {
      setSelectedTagsForNewTrack([...selectedTagsForNewTrack, existingDbTag.name]);
    } else {
      const colors = ['#ef4444', '#f97316', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const { data, error } = await supabase.from('tags').insert([{ name, color: randomColor }]).select();
      if (data) {
         setDbTags([...dbTags, data[0]]);
         setSelectedTagsForNewTrack([...selectedTagsForNewTrack, data[0].name]);
      } else if (error) { showToast('Ошибка создания тега'); }
    }
    setNewTagInput('');
  };

  // --- ЗАГРУЗКА И ПАРСИНГ КАСТОМНОГО ФАЙЛА ---
  const handleUploadCustomFile = (file: File) => {
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const parts = nameWithoutExt.split(' - ');
    let artist = 'Свой трек';
    let title = nameWithoutExt;
    
    if (parts.length > 1) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    setCustomFile(file);
    setIsEditingTrack(false);
    setTrackToAddToDb({
      id: `custom_pending_${Date.now()}`,
      title: title,
      artist: artist,
      cover: 'https://placehold.co/400x400/8b5cf6/ffffff?text=MP3',
      preview: '',
      isCustom: true,
      tags: []
    });
    setSelectedTagsForNewTrack([]);
    setNewTagInput('');
  };

  // --- СОХРАНЕНИЕ / ОБНОВЛЕНИЕ ТРЕКА В БАЗУ ---
  const saveTrackToDb = async (overrideDuplicate = false) => {
    if (!trackToAddToDb) return;

    // Дедупликация:
    //   1) Полный матч — название + исполнитель совпадают (lowercase, лишние пробелы выкинуты).
    //   2) Слабый матч — только название (исполнитель может отличаться, например Deezer
    //      отдаёт «Dobro», а в БД лежит «Добро»). Тоже показываем модалку — пользователь решит.
    if (!overrideDuplicate) {
      const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      const incomingTitle  = norm(editedTitle  || trackToAddToDb.title);
      const incomingArtist = norm(editedArtist || trackToAddToDb.artist);
      // При редактировании существующей записи — исключаем её саму из сравнения.
      // При добавлении нового (включая повторный «add to base» того же Deezer-трека) — сравниваем со всеми.
      const otherTracks = isEditingTrack
        ? dbTracks.filter(t => String(t.id) !== String(trackToAddToDb.id))
        : dbTracks;
      const strongDup = otherTracks.find(t =>
        norm(t.title)  === incomingTitle &&
        norm(t.artist) === incomingArtist
      );
      const weakDup = strongDup ?? otherTracks.find(t => norm(t.title) === incomingTitle);
      if (weakDup) {
        setDupWarning(weakDup);
        return;
      }
    }

    let finalTags = [...selectedTagsForNewTrack];

    // Подхватываем недописанный тег
    const pendingTag = newTagInput.trim();
    if (pendingTag) {
      const existing = dbTags.find(t => t.name.toLowerCase() === pendingTag.toLowerCase());
      if (existing) {
        if (!finalTags.includes(existing.name)) finalTags.push(existing.name);
      } else {
        const colors = ['#ef4444', '#f97316', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
        const { data: newTagData } = await supabase
          .from('tags')
          .insert([{ name: pendingTag, color: colors[Math.floor(Math.random() * colors.length)] }])
          .select();
        if (newTagData) {
          setDbTags(prev => [...prev, newTagData[0]]);
          finalTags.push(newTagData[0].name);
        }
      }
    }

    let previewUrl = trackToAddToDb.preview;
    let safeId = String(trackToAddToDb.id);
    let isCustomTrack = trackToAddToDb.isCustom || false;

    // Загрузка MP3 на Storage, если есть файл
    if (customFile) {
      setIsUploadingMp3(true);
      const ext = customFile.name.split('.').pop() || 'mp3';
      const safeName = `custom_${Date.now()}.${ext}`;
      
      const { data, error: uploadError } = await supabase.storage
        .from('audio-tracks')
        .upload(safeName, customFile, { upsert: true });

      if (uploadError) {
        console.error(uploadError);
        showToast('Ошибка загрузки файла');
        setIsUploadingMp3(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('audio-tracks').getPublicUrl(data.path);
      previewUrl = urlData.publicUrl;
      safeId = safeName;
      isCustomTrack = true;
    }

    const newTrackRow = {
      id: safeId,
      title: editedTitle.trim() || trackToAddToDb.title,
      artist: editedArtist.trim() || trackToAddToDb.artist,
      cover: trackToAddToDb.cover,
      preview: previewUrl,
      is_custom: isCustomTrack,
      tags: finalTags,
      preview_start: editedPreviewStart > 0 ? editedPreviewStart : null,
      preview_end:   editedPreviewEnd   > 0 ? editedPreviewEnd   : null,
    };

    const { data, error } = await supabase.from('tracks').upsert(newTrackRow).select();
    setIsUploadingMp3(false);

    if (error) { showToast('Ошибка сохранения'); return; }
    
    if (data) {
       setDbTracks(prev => {
         const filtered = prev.filter(t => String(t.id) !== String(data[0].id));
         const addedTrack: Track = {
           id: data[0].id, title: data[0].title, artist: data[0].artist,
           cover: data[0].cover, preview: data[0].preview, isCustom: data[0].is_custom, tags: data[0].tags,
           previewStart: data[0].preview_start != null ? Number(data[0].preview_start) : undefined,
           previewEnd:   data[0].preview_end   != null ? Number(data[0].preview_end)   : undefined,
         };
         return [addedTrack, ...filtered];
       });
       showToast('Трек сохранен!');
    }
    setTrackToAddToDb(null);
    setCustomFile(null);
    setSelectedTagsForNewTrack([]);
    setNewTagInput('');
  };

  const deleteTrackFromDb = async (trackId: string | number) => {
    if (!confirm('Удалить трек из вашей Базы?')) return;
    await supabase.from('tracks').delete().eq('id', String(trackId));
    setDbTracks(prev => prev.filter(t => String(t.id) !== String(trackId)));
    showToast('Трек удален');
  };

  const deleteTagFromDb = async (tag: Tag) => {
    const affected = dbTracks.filter(t => (t.tags || []).includes(tag.name));
    const msg = affected.length > 0
      ? `Удалить тег «${tag.name}»? Он отвязан от ${affected.length} ${affected.length === 1 ? 'трека' : 'треков'}.`
      : `Удалить тег «${tag.name}»?`;
    if (!confirm(msg)) return;

    // 1) чистим тег у всех треков (батчем — параллельно, ок для небольших объёмов)
    if (affected.length > 0) {
      await Promise.all(affected.map(t => {
        const cleaned = (t.tags || []).filter(n => n !== tag.name);
        return supabase.from('tracks').update({ tags: cleaned }).eq('id', String(t.id));
      }));
      setDbTracks(prev => prev.map(t => (t.tags || []).includes(tag.name)
        ? { ...t, tags: (t.tags || []).filter(n => n !== tag.name) }
        : t));
    }

    // 2) удаляем сам тег
    const { error } = await supabase.from('tags').delete().eq('id', tag.id);
    if (error) return showToast('Ошибка удаления тега: ' + error.message);

    setDbTags(prev => prev.filter(t => t.id !== tag.id));
    showToast('Тег удалён');
  };

  if (printViewCards) return <PrintView printViewCards={printViewCards} setPrintViewCards={setPrintViewCards} />;

  if (hostSession) {
    if (isProjectorMode) {
      return (
        <>
          <audio ref={audioRef} preload="auto" crossOrigin="anonymous" {...audioHandlers} />
          <audio ref={preloadAudioRef} preload="auto" crossOrigin="anonymous" muted aria-hidden="true" style={{ display: 'none' }} />
          <Projector currentTrack={shuffledTracks[currentHostTrackIndex]} hideTrackInfo={hideTrackInfo} autoWinners={autoWinners} setIsProjectorMode={setIsProjectorMode} setHideTrackInfo={setHideTrackInfo} />
        </>
      );
    }
    return (
      <>
        <audio ref={audioRef} preload="auto" crossOrigin="anonymous" {...audioHandlers} />
        <audio ref={preloadAudioRef} preload="auto" crossOrigin="anonymous" muted aria-hidden="true" style={{ display: 'none' }} />
        <HostScreen
          hostSession={hostSession} shuffledTracks={shuffledTracks} playedTrackIds={playedTrackIds} currentHostTrackIndex={currentHostTrackIndex} hideTrackInfo={hideTrackInfo} autoWinners={autoWinners} playingTrackId={playingTrackId} isPaused={isPaused} currentTime={currentTime} duration={duration} isAutoPlay={isAutoPlay} setIsAutoPlay={setIsAutoPlay} setHideTrackInfo={setHideTrackInfo} setIsProjectorMode={setIsProjectorMode} playHostTrack={playHostTrack} endHostSession={endHostSession} setAutoWinners={setAutoWinners} togglePlay={togglePlay} audioRef={audioRef}
        />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white font-sans selection:bg-purple-500 overflow-hidden relative">
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" {...audioHandlers} />
      {/* Скрытый второй элемент — только для пре-кеша следующего трека (звук не воспроизводится) */}
      <audio ref={preloadAudioRef} preload="auto" crossOrigin="anonymous" muted aria-hidden="true" style={{ display: 'none' }} />

      {toast && (
        <div className="absolute top-6 right-6 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl font-bold flex items-center gap-3 z-[300] animate-in slide-in-from-top-4">
          <CheckCircle2 size={20} />{toast}
        </div>
      )}

      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-10 flex-shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-gray-800/50">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg"><Music size={24} className="text-white" /></div>
          <span className="text-xl font-black tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">MuzBingo</span>
        </div>
        <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
          <button onClick={() => setActiveTab('games')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'games' ? 'bg-purple-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}><PartyPopper size={20} /> Мероприятия</button>
          <div className="h-px bg-gray-800 my-2 mx-4" />
          <button onClick={() => setActiveTab('mydatabase')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'mydatabase' ? 'bg-purple-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}><Database size={20} /> Моя База</button>
          <button onClick={() => setActiveTab('global_search')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'global_search' ? 'bg-purple-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}><Globe size={20} /> Глобальный Поиск</button>
          <div className="h-px bg-gray-800 my-2 mx-4" />
          <button onClick={() => setActiveTab('playlists')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'playlists' ? 'bg-purple-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}><ListMusic size={20} /> Плейлисты</button>
          <button onClick={() => setActiveTab('templates')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'templates' ? 'bg-purple-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}><LayoutTemplate size={20} /> Шаблоны</button>
        </nav>
      </aside>

      <main className="flex-1 overflow-hidden p-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-gray-950">
        {activeTab === 'games' && <GamesTab games={games} setGames={setGames} playlists={playlists} templates={templates} showToast={showToast} startHostSession={startHostSession} setPrintViewCards={setPrintViewCards} />}
        {activeTab === 'mydatabase' && (
          <MyDatabaseTab
            dbTracks={dbTracks} dbTags={dbTags} playingTrackId={playingTrackId} isPaused={isPaused} togglePlay={togglePlay}
            setTrackToAdd={setTrackToAdd} deleteTrackFromDb={deleteTrackFromDb}
            deleteTagFromDb={deleteTagFromDb}
            onUploadCustomFile={handleUploadCustomFile}
            onEditTrack={(track) => {
              setIsEditingTrack(true);
              setTrackToAddToDb(track);
              setSelectedTagsForNewTrack(track.tags || []);
              setNewTagInput('');
            }}
          />
        )}
        {activeTab === 'global_search' && (
          <GlobalSearchTab
            playingTrackId={playingTrackId} isPaused={isPaused} togglePlay={togglePlay} setTrackToAdd={setTrackToAdd}
            setTrackToAddToDb={(t) => { setIsEditingTrack(false); setTrackToAddToDb(t); setSelectedTagsForNewTrack([]); setNewTagInput(''); }}
          />
        )}
        {activeTab === 'playlists' && <PlaylistsTab playlists={playlists} setPlaylists={setPlaylists} playingTrackId={playingTrackId} isPaused={isPaused} togglePlay={togglePlay} showToast={showToast} />}
        {activeTab === 'templates' && <TemplatesTab templates={templates} setTemplates={setTemplates} showToast={showToast} />}
      </main>

      {/* --- МОДАЛКА: СОХРАНЕНИЕ / РЕДАКТИРОВАНИЕ ТРЕКА В БАЗУ --- */}
      {trackToAddToDb && (() => {
        // Источник аудио для триммера: blob от нового MP3 или публичный URL из supabase при правке кастомного
        const trimmerSrc =
          customFileUrl ??
          (trackToAddToDb.isCustom
            ? supabase.storage.from('audio-tracks').getPublicUrl(String(trackToAddToDb.id)).data.publicUrl
            : null);

        return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Database size={20} className="text-purple-400"/>
                {customFile ? 'Загрузка MP3' : 'Сохранить в Базу'}
              </h3>
              <button onClick={() => { setTrackToAddToDb(null); setCustomFile(null); }} className="text-gray-400"><X size={24}/></button>
            </div>

            <div className="flex items-center gap-4 mb-6 p-4 bg-gray-950 rounded-xl">
              <img src={trackToAddToDb.cover} className="w-14 h-14 rounded-md object-cover" alt="" />
              <div className="overflow-hidden flex-1 space-y-2">
                {/* РЕДАКТИРУЕМЫЕ ПОЛЯ */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-0.5">Название трека</label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={e => setEditedTitle(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-purple-500 outline-none"
                    placeholder="Название трека"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-0.5">Исполнитель</label>
                  <input
                    type="text"
                    value={editedArtist}
                    onChange={e => setEditedArtist(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-purple-500 outline-none"
                    placeholder="Исполнитель"
                  />
                </div>
              </div>
            </div>

            {/* ─── ТРИММЕР АУДИО (только для кастомных MP3) ─── */}
            {trimmerSrc && (
              <div className="mb-6">
                <label className="text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
                  <Scissors size={14} className="text-purple-400"/>
                  Фрагмент трека для игры
                </label>
                <AudioTrimmer
                  src={trimmerSrc}
                  start={editedPreviewStart}
                  end={editedPreviewEnd}
                  onChange={(s, e) => { setEditedPreviewStart(s); setEditedPreviewEnd(e); }}
                />
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  В игре трек начнётся с зелёной метки и автоматически остановится на красной.
                  Сбрось чтобы играть с начала до конца.
                </p>
              </div>
            )}

            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-400 mb-2">Жанр или категория:</label>
              
              <div className="flex flex-wrap gap-2 mb-3 bg-gray-950 p-3 rounded-xl border border-gray-800 items-center min-h-[50px]">
                {selectedTagsForNewTrack.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 text-white rounded-lg text-xs font-medium shadow-md">
                    {tag}
                    <button onClick={() => setSelectedTagsForNewTrack(prev => prev.filter(t => t !== tag))} className="hover:text-red-300 transition ml-1"><X size={12} /></button>
                  </span>
                ))}
                <input 
                  type="text" 
                  value={newTagInput} 
                  onChange={e => setNewTagInput(e.target.value)} 
                  placeholder={selectedTagsForNewTrack.length === 0 ? "Напишите тег и нажмите Enter..." : "Добавить еще..."}
                  className="flex-1 bg-transparent border-none outline-none text-sm min-w-[150px] text-white" 
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(newTagInput); } }} 
                />
              </div>

              {dbTags.length > 0 && (
                <>
                  <div className="text-xs text-gray-500 mb-2 font-medium">Или выберите из существующих:</div>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                    {dbTags.filter(t => !selectedTagsForNewTrack.includes(t.name)).map(tag => (
                      <button key={tag.id} onClick={() => handleAddTag(tag.name)} className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs font-medium text-gray-400 hover:border-gray-500 hover:text-gray-200 transition">
                        + {tag.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-4">
              <button onClick={() => { setTrackToAddToDb(null); setCustomFile(null); }} disabled={isUploadingMp3} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 transition rounded-xl font-bold disabled:opacity-50">Отмена</button>
              <button onClick={() => saveTrackToDb()} disabled={isUploadingMp3 || !editedTitle.trim() || !editedArtist.trim()} className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 transition rounded-xl font-bold shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 disabled:opacity-50">
                {isUploadingMp3 ? <Loader2 size={18} className="animate-spin" /> : 'В Мою Базу'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* --- МОДАЛКА: ПРЕДУПРЕЖДЕНИЕ О ДУБЛИКАТЕ --- */}
      {dupWarning && (() => {
        const normForCheck = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
        const incomingArtist = normForCheck(editedArtist || trackToAddToDb?.artist || '');
        const sameArtist = normForCheck(dupWarning.artist) === incomingArtist;
        return (
        <div className="fixed inset-0 bg-black/85 z-[70] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-gray-900 border border-yellow-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                <span className="text-yellow-400 text-xl">⚠</span>
              </div>
              <h3 className="text-lg font-bold">
                {sameArtist ? 'Такой трек уже есть в базе' : 'Возможно дубликат — название совпадает'}
              </h3>
            </div>

            <div className="bg-gray-950 rounded-xl p-4 mb-4 border border-gray-800">
              <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Уже в базе:</div>
              <div className="flex items-center gap-3">
                <img src={dupWarning.cover} className="w-12 h-12 rounded object-cover shrink-0" alt="" />
                <div className="overflow-hidden">
                  <div className="font-bold truncate">{dupWarning.title}</div>
                  <div className="text-sm text-gray-400 truncate">{dupWarning.artist}</div>
                </div>
              </div>
              {dupWarning.tags && dupWarning.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {dupWarning.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-purple-600/20 text-purple-300 rounded">{tag}</span>
                  ))}
                </div>
              )}
              {!sameArtist && trackToAddToDb && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-yellow-500 mb-2">Хочешь добавить:</div>
                  <div className="flex items-center gap-3">
                    <img src={trackToAddToDb.cover} className="w-12 h-12 rounded object-cover shrink-0" alt="" />
                    <div className="overflow-hidden">
                      <div className="font-bold truncate">{editedTitle || trackToAddToDb.title}</div>
                      <div className="text-sm text-gray-400 truncate">{editedArtist || trackToAddToDb.artist}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              {sameArtist
                ? 'Лучше нажми «Отмена» и отредактируй уже сохранённый трек (карандашик в Моей Базе) — добавь там нужный жанр. Если это правда другая версия (live, ремикс) — жми «Сохранить дубль».'
                : 'Название одинаковое, а исполнитель пишется иначе (часто бывает: латиница vs кириллица). Если это один и тот же трек — жми «Отмена» и подправь исполнителя у существующего трека в Моей Базе. Если разные песни с одинаковым названием — жми «Сохранить дубль».'}
            </p>

            <div className="flex gap-3">
              <button onClick={() => setDupWarning(null)}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold transition">
                Отмена
              </button>
              <button onClick={() => { setDupWarning(null); saveTrackToDb(true); }}
                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold transition">
                Сохранить дубль
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* --- МОДАЛКА ДОБАВЛЕНИЯ В ПЛЕЙЛИСТ --- */}
      {trackToAdd && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[50] p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">Добавить в плейлист</h3><button onClick={() => setTrackToAdd(null)} className="text-gray-400 hover:text-white"><X size={24}/></button></div>
            <div className="flex items-center gap-4 mb-6 p-4 bg-gray-950 rounded-xl"><img src={trackToAdd.cover} className="w-12 h-12 rounded-md object-cover" alt="" /><div className="overflow-hidden"><p className="font-bold truncate">{trackToAdd.title}</p><p className="text-sm text-gray-400">{trackToAdd.artist}</p></div></div>
            {playlists.length === 0 ? (
               <div className="text-center py-6 text-gray-500">Нет плейлистов. Создайте их во вкладке "Плейлисты".</div>
            ) : (
              <div className="max-h-60 overflow-y-auto pr-2 flex flex-col gap-2 custom-scrollbar">{playlists.map(p => { 
                const isAdded = p.tracks.some(t => t.id === trackToAdd.id || t.artist.toLowerCase() === trackToAdd.artist.toLowerCase()); 
                return (
                  <button key={p.id} onClick={async () => {
                    if (isAdded) return;
                    const newTracks = [...p.tracks, trackToAdd];
                    setPlaylists(playlists.map(pl => pl.id === p.id ? { ...pl, tracks: newTracks } : pl));
                    await supabase.from('playlists').update({ tracks: newTracks }).eq('id', p.id);
                    showToast('Трек добавлен!');
                    setTrackToAdd(null);
                  }} disabled={isAdded} className={`flex justify-between p-4 rounded-xl border text-left ${isAdded ? 'bg-gray-800/50 border-gray-800 opacity-50' : 'bg-gray-800 border-gray-700 hover:border-purple-500'}`}>
                    <span className="font-bold truncate pr-4">{p.name}</span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {p.tracks.some(t => t.id === trackToAdd.id) ? 'Уже добавлен' : p.tracks.some(t => t.artist.toLowerCase() === trackToAdd.artist.toLowerCase()) ? `Исполнитель есть` : `${p.tracks.length} треков`}
                    </span>
                  </button>
                ); 
              })}</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}