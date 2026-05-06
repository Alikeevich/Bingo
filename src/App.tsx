import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { 
  Music, LayoutDashboard, ListMusic, Database, 
  LayoutTemplate, Plus, Search, PlayCircle, PauseCircle,
  X, FolderPlus, Trash2, ChevronLeft, CheckCircle2, Loader2, Flame,
  Calendar, Trophy, PlusCircle, Palette, Eye, Save, 
  Play, SkipForward, SkipBack, EyeOff, ListChecks, Power,
  PartyPopper, Shuffle, MonitorPlay, Minimize, Printer, SearchCheck,
  Upload, Download, UploadCloud, HardDriveDownload, Timer
} from 'lucide-react';

interface Track {
  id: number | string;
  title: string;
  artist: string;
  cover: string;
  preview: string;
  isCustom?: boolean;
}
interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  created_at?: string;
}
interface BingoCard {
  id: string;
  cells: (Track | { isFreeSpace: true })[];
}
interface Round {
  id: string;
  name: string;
  playlistId: string;
  winCondition: '1_line' | '2_lines' | 'full';
  cards?: BingoCard[];
}
interface Game {
  id: string;
  name: string;
  rounds: Round[];
  created_at?: string;
}
interface TemplateConfig {
  bgColor: string;
  textColor: string;
  accentColor: string;
  gridColor: string;
  cardTitle: string;
  showArtist: boolean;
  centerText: string;
  footerText: string;
  showQR: boolean;
  layout: '1' | '2' | '4';
  backgroundImageUrl?: string;
  qrUrl?: string;
}
interface Template {
  id: string;
  name: string;
  config: TemplateConfig;
  created_at?: string;
}

const chunkArray = (arr: any[], size: number) =>
  arr.reduce((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);

const formatTime = (time: number) => {
  if (isNaN(time) || !isFinite(time)) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const getProxiedUrl = (url: string): string => {
  if (!url) return url;
  // Просто заменяем http на https и возвращаем прямую ссылку
  return url.replace('http://', 'https://');
};

const FILTERS = [
  { name: 'Топ Чарт',     type: 'chart',  id: '0',   icon: 'flame' },
  { name: 'Поп',           type: 'chart',  id: '132'               },
  { name: 'Рок',           type: 'chart',  id: '152'               },
  { name: 'Хип-Хоп',      type: 'chart',  id: '116'               },
  { name: 'Электронная',   type: 'chart',  id: '106'               },
  { name: 'R&B',           type: 'chart',  id: '165'               },
  { name: 'Русские хиты',  type: 'search', query: 'русские хиты'   },
  { name: 'Дискотека 80х', type: 'search', query: 'disco 80s hits' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'games' | 'playlists' | 'database' | 'templates'>('games');

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [activeFilterRef, setActiveFilterRef] = useState<typeof FILTERS[0] | null>(null);
  const ITEMS_PER_PAGE = 50;
  const activeQueryRef = useRef<{ type: 'chart'; id: string; name: string } | { type: 'search'; query: string; name: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState('Топ Чарт');
  const [isUploadingMp3, setIsUploadingMp3] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState<{ current: number; total: number } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | number | null>(null);
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

  const [cardGeneratorSetup, setCardGeneratorSetup] = useState<{ game: Game; round: Round } | null>(null);
  const [cardsCount, setCardsCount] = useState<number>(20);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [printViewCards, setPrintViewCards] = useState<{ cards: BingoCard[]; template: Template } | null>(null);

  const [isBingoVerifyModalOpen, setIsBingoVerifyModalOpen] = useState(false);
  const [verifyCardId, setVerifyCardId] = useState('');
  const [verifyResult, setVerifyResult] = useState<{
    card: BingoCard;
    matches: boolean[];
    linesCount: number;
    isWinner: boolean;
  } | null>(null);

  const [viewingPlaylist, setViewingPlaylist] = useState<Playlist | null>(null);
  const [isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [trackToAdd, setTrackToAdd] = useState<Track | null>(null);

  const [viewingGame, setViewingGame] = useState<Game | null>(null);
  const [isCreateGameModalOpen, setIsCreateGameModalOpen] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [isAddRoundModalOpen, setIsAddRoundModalOpen] = useState(false);
  const [newRound, setNewRound] = useState<Partial<Round>>({ winCondition: '1_line' });

  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<Template>>({
    name: '',
    config: {
      bgColor: '#1e1b4b', textColor: '#ffffff', accentColor: '#8b5cf6',
      gridColor: '#2e1065', cardTitle: 'MUZ BINGO', showArtist: true,
      centerText: 'FREE SPACE', footerText: 'MuzBingo', showQR: true, layout: '2',
    },
  });

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaylists();
    fetchGames();
    fetchTemplates();
    loadChartByGenre();

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
      } catch (e) {
        localStorage.removeItem('muzbingo_host_session');
      }
    }
  }, []);

  useEffect(() => {
    if (hostSession) {
      localStorage.setItem('muzbingo_host_session', JSON.stringify({
        hostSession, shuffledTracks,
        playedTrackIds: Array.from(playedTrackIds),
        currentHostTrackIndex, hideTrackInfo,
      }));
    } else {
      localStorage.removeItem('muzbingo_host_session');
    }
  }, [hostSession, shuffledTracks, playedTrackIds, currentHostTrackIndex, hideTrackInfo]);

  useEffect(() => {
    if (!hostSession?.round.cards || playedTrackIds.size === 0) {
      setAutoWinners([]);
      return;
    }
    
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
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProjectorMode) {
        if (e.key === 'Escape') setIsProjectorMode(false);
        if (e.code === 'Space') { e.preventDefault(); setHideTrackInfo(prev => !prev); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProjectorMode]);

  useEffect(() => {
    if (!hostSession?.round.cards || playedTrackIds.size === 0) return;
    const condition = hostSession.round.winCondition;
    const linesIndices = [
      [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
      [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
      [0,6,12,18,24],[4,8,12,16,20],
    ];
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

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

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
    if (data) setTemplates(data);
  };

  const parseDeezerTracks = (data: any[]) =>
    data.filter((t: any) => t.preview).map((t: any) => ({
      id: t.id, title: t.title, artist: t.artist.name,
      cover: t.album.cover_xl || t.album.cover_medium,
      preview: t.preview, isCustom: false,
    }));

  const loadChartByGenre = async (genreId: string, filterName: string, page = 0) => {
    setIsSearching(true);
    setActiveFilter(filterName);
    setSearchQuery('');
    setCurrentPage(page);
    activeQueryRef.current = { type: 'chart', id: genreId, name: filterName };
    try {
      const res = await fetch(`/api/deezer/chart/${genreId}/tracks?limit=${ITEMS_PER_PAGE}&index=${page * ITEMS_PER_PAGE}`);
      const data = await res.json();
      if (data.data) {
        setSearchResults(parseDeezerTracks(data.data));
        setHasNextPage(data.data.length === ITEMS_PER_PAGE);
      }
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };
  
  const searchDeezer = async (query: string, filterName?: string, page = 0) => {
    if (!query) return;
    setIsSearching(true);
    setActiveFilter(filterName || '');
    setCurrentPage(page);
    activeQueryRef.current = { type: 'search', query, name: filterName || '' };
    try {
      const res = await fetch(`/api/deezer/search?q=${encodeURIComponent(query)}&limit=${ITEMS_PER_PAGE}&index=${page * ITEMS_PER_PAGE}`);
      const data = await res.json();
      if (data.data) {
        setSearchResults(parseDeezerTracks(data.data));
        setHasNextPage(data.data.length === ITEMS_PER_PAGE);
      }
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };
  
  const loadTopChart = () => loadChartByGenre('0', 'Топ Чарт', 0);
  
  const goToPage = (page: number) => {
    const q = activeQueryRef.current;
    if (!q) return;
    if (q.type === 'chart') loadChartByGenre(q.id, q.name, page);
    else searchDeezer(q.query, q.name, page);
    // скролл наверх списка
    document.querySelector('.custom-scrollbar')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); searchDeezer(searchQuery); };

  const cachePlaylistForOffline = async (playlist: Playlist) => {
    try {
      const cache = await caches.open('muzbingo-audio-v1');
      let count = 0;
      setOfflineProgress({ current: 0, total: playlist.tracks.length });
      for (const track of playlist.tracks) {
        if (!track.preview) { count++; continue; }
        const proxyUrl = getProxiedUrl(track.preview);
        const existing = await cache.match(proxyUrl).catch(() => null);
        if (!existing) {
          try {
            const resp = await fetch(proxyUrl);
            if (resp.ok) await cache.put(proxyUrl, resp);
          } catch (e) { console.warn('Ошибка кэширования:', track.title, e); }
        }
        count++;
        setOfflineProgress({ current: count, total: playlist.tracks.length });
      }
      showToast('Плейлист загружен для офлайн-игры!');
      setTimeout(() => setOfflineProgress(null), 2000);
    } catch (e) {
      showToast('Ошибка кэширования. Проверьте консоль.');
      setOfflineProgress(null);
    }
  };

  const togglePlay = async (track: Track) => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (playingTrackId === track.id) {
      if (audioEl.paused) {
        audioEl.play().catch(console.error);
      } else {
        audioEl.pause();
        setPlayingTrackId(null);
      }
      return;
    }

    audioEl.pause();
    setPlayingTrackId(track.id);

    try {
      let currentUrl = track.preview;

      // 1. Если это твой кастомный трек из Supabase
      if (track.isCustom) {
        // Генерируем чистую публичную ссылку заново, чтобы не использовать старую из БД
        const { data } = supabase.storage.from('audio-tracks').getPublicUrl(String(track.id));
        currentUrl = data.publicUrl;
      } 
      // 2. Если это трек из Deezer
      else {
        const isExpired = currentUrl.includes('exp=') && 
                          Date.now() / 1000 > parseInt(currentUrl.match(/exp=(\d+)/)?.[1] || '0');
        
        if (isExpired) {
          console.log("Ссылка Deezer истекла, обновляем...");
          const res = await fetch(`/api/deezer/track/${track.id}`);
          const data = await res.json();
          if (data.preview) currentUrl = data.preview;
        }
      }

      // Добавляем timestamp к ссылке, чтобы обойти жесткое кэширование браузером 403 ошибки
      const finalUrl = currentUrl.includes('?') ? `${currentUrl}&t=${Date.now()}` : `${currentUrl}?t=${Date.now()}`;

      audioEl.src = finalUrl;
      audioEl.load();
      
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.error('Ошибка воспроизведения:', err);
          showToast('Ошибка доступа к файлу (403). Проверьте настройки Storage.');
          setPlayingTrackId(null);
        });
      }
    } catch (err) {
      console.error('Критическая ошибка плеера:', err);
      setPlayingTrackId(null);
    }
  };

  const uploadCustomTracks = async (e: React.ChangeEvent<HTMLInputElement>, playlistId: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingMp3(true);
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    let newTracks = [...playlist.tracks];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop() || 'mp3';
      const safeName = `custom_${Date.now()}_${i}.${ext}`;
      try {
        const { data, error } = await supabase.storage.from('audio-tracks').upload(safeName, file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('audio-tracks').getPublicUrl(data.path);
        newTracks.push({
          id: safeName, title: file.name.replace(`.${ext}`, ''),
          artist: 'Свой трек', cover: 'https://placehold.co/400x400/8b5cf6/ffffff?text=MP3',
          preview: urlData.publicUrl, isCustom: true,
        });
      } catch (err: any) { showToast(`Ошибка загрузки ${file.name}: ${err.message}`); }
    }
    setPlaylists(playlists.map(p => p.id === playlistId ? { ...p, tracks: newTracks } : p));
    if (viewingPlaylist?.id === playlistId) setViewingPlaylist({ ...viewingPlaylist, tracks: newTracks });
    await supabase.from('playlists').update({ tracks: newTracks }).eq('id', playlistId);
    setIsUploadingMp3(false);
    showToast('Треки успешно добавлены!');
    e.target.value = '';
  };

  const generateCards = async () => {
    if (!cardGeneratorSetup || !selectedTemplateId) return;
    const { game, round } = cardGeneratorSetup;
    const playlist = playlists.find(p => p.id === round.playlistId);
    if (!playlist || playlist.tracks.length < 24) return showToast('Ошибка: в плейлисте меньше 24 треков!');
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;
    const newCards: BingoCard[] = [];
    const startId = 1000 + (round.cards?.length || 0) + 1;
    for (let i = 0; i < cardsCount; i++) {
      const shuffled = [...playlist.tracks].sort(() => Math.random() - 0.5);
      const cardTracks = shuffled.slice(0, 24);
      const cells: any[] = [...cardTracks.slice(0, 12), { isFreeSpace: true }, ...cardTracks.slice(12, 24)];
      newCards.push({ id: String(startId + i), cells });
    }
    const updatedRounds = game.rounds.map(r => r.id === round.id ? { ...r, cards: [...(r.cards || []), ...newCards] } : r);
    const updatedGame = { ...game, rounds: updatedRounds };
    setGames(games.map(g => g.id === game.id ? updatedGame : g));
    if (viewingGame?.id === game.id) setViewingGame(updatedGame);
    await supabase.from('games').update({ rounds: updatedRounds }).eq('id', game.id);
    setCardGeneratorSetup(null);
    setPrintViewCards({ cards: newCards, template });
  };

  const handleVerifyCard = () => {
    if (!verifyCardId.trim()) return;
    if (!hostSession?.round.cards?.length) return showToast('В этом туре ещё не сгенерированы карточки!');
    const card = hostSession.round.cards.find(c => c.id === verifyCardId.trim());
    if (!card) return showToast(`Карточка #${verifyCardId} не найдена!`);
    const matches = card.cells.map(cell => 'isFreeSpace' in cell ? true : playedTrackIds.has(cell.id));
    const linesIndices = [
      [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
      [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
      [0,6,12,18,24],[4,8,12,16,20],
    ];
    let linesCount = 0;
    linesIndices.forEach(line => { if (line.every(idx => matches[idx])) linesCount++; });
    const cond = hostSession.round.winCondition;
    const isWinner = (cond === '1_line' && linesCount >= 1) || (cond === '2_lines' && linesCount >= 2) || (cond === 'full' && matches.every(m => m));
    setVerifyResult({ card, matches, linesCount, isWinner });
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setIsCreatePlaylistModalOpen(false);
    const { data } = await supabase.from('playlists').insert([{ name: newPlaylistName, tracks: [] }]).select();
    if (data?.[0]) { setPlaylists([data[0], ...playlists]); showToast('Плейлист создан!'); }
    setNewPlaylistName('');
  };

  const deletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Точно удалить плейлист?')) {
      setPlaylists(playlists.filter(p => p.id !== id));
      if (viewingPlaylist?.id === id) setViewingPlaylist(null);
      if (hostSession?.playlist.id === id) setHostSession(null);
      await supabase.from('playlists').delete().eq('id', id);
      showToast('Плейлист удалён');
    }
  };

  const addTrackToPlaylist = async (playlistId: string) => {
    if (!trackToAdd) return;
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    const newTracks = [...playlist.tracks, trackToAdd];
    setPlaylists(playlists.map(p => p.id === playlistId ? { ...p, tracks: newTracks } : p));
    setTrackToAdd(null);
    showToast('Трек добавлен!');
    await supabase.from('playlists').update({ tracks: newTracks }).eq('id', playlistId);
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string | number) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    const newTracks = playlist.tracks.filter(t => t.id !== trackId);
    setPlaylists(playlists.map(p => p.id === playlistId ? { ...p, tracks: newTracks } : p));
    if (viewingPlaylist?.id === playlistId) setViewingPlaylist({ ...viewingPlaylist, tracks: newTracks });
    await supabase.from('playlists').update({ tracks: newTracks }).eq('id', playlistId);
  };

  const createGame = async () => {
    if (!newGameName.trim()) return;
    setIsCreateGameModalOpen(false);
    const { data } = await supabase.from('games').insert([{ name: newGameName, rounds: [] }]).select();
    if (data?.[0]) { setGames([data[0], ...games]); showToast('Игра создана!'); }
    setNewGameName('');
  };

  const deleteGame = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Удалить мероприятие со всеми его турами?')) {
      setGames(games.filter(g => g.id !== id));
      if (viewingGame?.id === id) setViewingGame(null);
      if (hostSession?.game.id === id) setHostSession(null);
      await supabase.from('games').delete().eq('id', id);
      showToast('Мероприятие удалено');
    }
  };

  const addRoundToGame = async () => {
    if (!viewingGame || !newRound.name || !newRound.playlistId) return;
    const roundToAdd: Round = {
      id: crypto.randomUUID(), name: newRound.name,
      playlistId: newRound.playlistId, winCondition: newRound.winCondition as any, cards: [],
    };
    const updatedGame = { ...viewingGame, rounds: [...viewingGame.rounds, roundToAdd] };
    setGames(games.map(g => g.id === viewingGame.id ? updatedGame : g));
    setViewingGame(updatedGame);
    setIsAddRoundModalOpen(false);
    setNewRound({ winCondition: '1_line' });
    await supabase.from('games').update({ rounds: updatedGame.rounds }).eq('id', viewingGame.id);
    showToast('Тур добавлен!');
  };

  const deleteRound = async (roundId: string) => {
    if (!viewingGame) return;
    if (confirm('Удалить тур? Все карточки будут удалены.')) {
      const updatedRounds = viewingGame.rounds.filter(r => r.id !== roundId);
      const updatedGame = { ...viewingGame, rounds: updatedRounds };
      setGames(games.map(g => g.id === viewingGame.id ? updatedGame : g));
      setViewingGame(updatedGame);
      if (hostSession?.round.id === roundId) setHostSession(null);
      await supabase.from('games').update({ rounds: updatedRounds }).eq('id', viewingGame.id);
      showToast('Тур удалён');
    }
  };

  const uploadTemplateBackground = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const fileName = `template_bg_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('template-backgrounds').upload(fileName, file, { upsert: true });
    if (error) { showToast('Ошибка загрузки: ' + error.message); return null; }
    const { data: urlData } = supabase.storage.from('template-backgrounds').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const downloadDesignGuide = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2480" height="3508" viewBox="0 0 2480 3508"><rect width="2480" height="3508" fill="#f3f4f6"/><rect x="150" y="150" width="2180" height="3200" fill="none" stroke="#9ca3af" stroke-width="4" stroke-dasharray="20,20"/><rect x="150" y="150" width="2180" height="250" fill="#fca5a5" opacity="0.6" rx="20"/><text x="1240" y="310" font-family="sans-serif" font-size="90" font-weight="black" font-style="italic" text-anchor="middle" fill="#991b1b">ЗАГОЛОВОК (TITLE)</text><rect x="150" y="450" width="2180" height="2500" fill="#86efac" opacity="0.6" rx="20"/><text x="1240" y="1660" font-family="sans-serif" font-size="140" font-weight="black" text-anchor="middle" fill="#166534">СЕТКА ТРЕКОВ (5x5)</text><rect x="150" y="3110" width="300" height="240" fill="#fcd34d" opacity="0.6" rx="15"/><text x="180" y="3195" font-family="sans-serif" font-size="60" font-weight="bold" fill="#854d0e">ID: #1042</text><rect x="1980" y="3000" width="350" height="350" fill="#93c5fd" opacity="0.6" rx="20"/><text x="2155" y="3190" font-family="sans-serif" font-size="60" font-weight="bold" text-anchor="middle" fill="#1e3a8a">QR-КОД</text></svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'MuzBingo_Design_Guide_A4.svg'; a.click();
    URL.revokeObjectURL(url);
  };

  const saveTemplate = async () => {
    if (!editingTemplate.name) return showToast('Введите название шаблона');
    const { data } = await supabase.from('templates').insert([{ name: editingTemplate.name, config: editingTemplate.config }]).select();
    if (data) { setTemplates([data[0], ...templates]); setIsCreateTemplateModalOpen(false); showToast('Шаблон сохранён!'); }
  };

  const deleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Удалить шаблон?')) {
      setTemplates(templates.filter(t => t.id !== id));
      await supabase.from('templates').delete().eq('id', id);
      showToast('Шаблон удалён');
    }
  };

  const startHostSession = (game: Game, round: Round) => {
    const playlist = playlists.find(p => p.id === round.playlistId);
    if (!playlist) return showToast('Плейлист не найден!');
    const shuffled = [...playlist.tracks].sort(() => Math.random() - 0.5);
    setShuffledTracks(shuffled);
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
  };

  const reshuffleTracks = () => {
    if (playedTrackIds.size > 0) {
      if (!confirm('Перемешать оставшиеся треки?')) return;
      const unplayed = shuffledTracks.filter(t => !playedTrackIds.has(t.id));
      const played = shuffledTracks.filter(t => playedTrackIds.has(t.id));
      setShuffledTracks([...played, ...unplayed.sort(() => Math.random() - 0.5)]);
    } else {
      setShuffledTracks([...shuffledTracks].sort(() => Math.random() - 0.5));
    }
  };

  const endHostSession = () => { if (confirm('Точно завершить тур?')) setHostSession(null); };

  // Единый обработчик для <audio> — используется во всех ветках рендера
  const audioHandlers = {
    onTimeUpdate: (e: React.SyntheticEvent<HTMLAudioElement>) => setCurrentTime(e.currentTarget.currentTime),
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLAudioElement>) => setDuration(e.currentTarget.duration),
    onEnded: () => {
      setPlayingTrackId(null);
      if (isAutoPlay && hostSession && currentHostTrackIndex < shuffledTracks.length - 1) {
        playHostTrack(currentHostTrackIndex + 1);
        setHideTrackInfo(true);
      }
    },
  };

  // ================= РЕНДЕР: PRINT VIEW =================
  if (printViewCards) {
    const { cards, template } = printViewCards;
    const layoutNum = parseInt(template.config.layout || '1');
    const pages = chunkArray(cards, layoutNum);
    return (
      <div className="bg-gray-200 min-h-screen text-black print:bg-white overflow-y-auto z-[200] relative font-sans print:m-0 print:p-0">
        <div className="fixed top-0 left-0 right-0 bg-gray-900 text-white p-4 flex justify-between items-center z-50 print:hidden shadow-lg border-b border-gray-800">
          <div className="flex items-center gap-4">
            <button onClick={() => setPrintViewCards(null)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition font-medium"><ChevronLeft size={20} /> Назад</button>
            <div><div className="font-bold">Генерация карточек</div><div className="text-sm text-gray-400">Сгенерировано {cards.length} шт. Шаблон: {template.name}</div></div>
          </div>
          <button onClick={() => window.print()} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition"><Printer size={20} /> Распечатать (A4)</button>
        </div>
        <div className="pt-24 print:pt-0 pb-20 print:pb-0 flex flex-col items-center gap-8 print:block">
          {pages.map((pageCards: BingoCard[], pageIndex: number) => (
            <div key={pageIndex} className="w-[210mm] h-[297mm] bg-white shadow-2xl print:shadow-none print:w-full print:h-screen print:page-break-after-always overflow-hidden">
              <div className={`w-full h-full p-[10mm] gap-[10mm] ${layoutNum === 1 ? 'flex flex-col' : layoutNum === 2 ? 'grid grid-cols-1 grid-rows-2' : 'grid grid-cols-2 grid-rows-2'}`}>
                {pageCards.map((card) => (
                  <div key={card.id} style={{ backgroundColor: template.config.bgColor, color: template.config.textColor, backgroundImage: template.config.backgroundImageUrl ? `url(${template.config.backgroundImageUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} className="relative flex flex-col rounded-xl overflow-hidden p-6 print:p-4 border-2 border-dashed border-gray-300">
                    <div style={{ color: template.config.accentColor, borderColor: `${template.config.accentColor}44` }} className={`text-center font-black border-b-4 uppercase italic tracking-tighter ${layoutNum === 4 ? 'text-2xl mb-2 pb-2 border-b-2' : 'text-5xl mb-6 pb-4'}`}>{template.config.cardTitle}</div>
                    <div className="grid grid-cols-5 gap-1.5 print:gap-1 flex-1">
                      {card.cells.map((cell, i) => {
                        const isFree = 'isFreeSpace' in cell;
                        return (
                          <div key={i} style={{ backgroundColor: template.config.gridColor }} className="rounded-lg border border-white/10 flex flex-col items-center justify-center text-center p-1.5 print:p-1 overflow-hidden">
                            {isFree
                              ? <div style={{ color: template.config.accentColor }} className={`font-black uppercase leading-tight ${layoutNum === 4 ? 'text-xs' : 'text-xl'}`}>{template.config.centerText}</div>
                              : <><div className={`font-bold leading-tight opacity-90 line-clamp-3 break-words w-full px-0.5 ${layoutNum === 4 ? 'text-[8px]' : 'text-[13px]'}`}>{(cell as Track).title}</div>{template.config.showArtist && <div style={{ color: template.config.accentColor }} className={`font-medium leading-tight opacity-90 italic mt-0.5 line-clamp-2 break-words w-full px-0.5 ${layoutNum === 4 ? 'text-[6px]' : 'text-[11px]'}`}>{(cell as Track).artist}</div>}</>}
                          </div>
                        );
                      })}
                    </div>
                    <div className={`mt-4 flex justify-between items-end ${layoutNum === 4 ? 'mt-2' : ''}`}>
                      <div className="flex flex-col bg-white/50 p-1 rounded-md"><div className={`opacity-80 uppercase font-bold tracking-widest ${layoutNum === 4 ? 'text-[8px]' : 'text-sm'}`}>ID: #{card.id}</div><div className={`opacity-70 font-medium ${layoutNum === 4 ? 'text-[6px]' : 'text-xs'}`}>{template.config.footerText}</div></div>
                      {template.config.showQR && (
                        <div className={`bg-white/90 border border-white/20 flex items-center justify-center p-1 ${layoutNum === 4 ? 'w-10 h-10 rounded-md' : 'w-16 h-16 rounded-xl'}`}>
                          {template.config.qrUrl ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(template.config.qrUrl)}`} className="w-full h-full object-contain mix-blend-multiply" alt="QR" /> : <div className={`font-bold opacity-50 text-center leading-none text-black ${layoutNum === 4 ? 'text-[5px]' : 'text-[8px]'}`}>МЕСТО ДЛЯ<br />QR КОДА</div>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ================= РЕНДЕР: ЭКРАН ВЕДУЩЕГО =================
// ================= РЕНДЕР: ЭКРАН ВЕДУЩЕГО =================
  if (hostSession) {
    const currentTrack = shuffledTracks[currentHostTrackIndex];
    const isPlaying = playingTrackId === currentTrack?.id;

    if (isProjectorMode) {
      return (
        <div className="fixed inset-0 bg-black text-white z-[100] flex flex-col items-center justify-center animate-in fade-in duration-500 group overflow-hidden">
          <audio ref={audioRef} preload="auto" crossOrigin="anonymous" {...audioHandlers} />

          {/* БАННЕР БИНГО НА ПРОЕКТОРЕ */}
          {autoWinners.length > 0 && (
            <div className="absolute top-10 flex items-center gap-4 bg-green-600 text-white px-10 py-4 rounded-full font-black text-4xl shadow-[0_0_80px_rgba(34,197,94,0.8)] z-[200] animate-bounce border-4 border-white">
              <PartyPopper size={40} /> БИНГО У КАРТОЧЕК: {autoWinners.join(', ')}!
            </div>
          )}
          
          <button onClick={() => setIsProjectorMode(false)} className="absolute top-8 right-8 p-4 bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-all text-white z-50"><Minimize size={32} /></button>
          <div className="text-center">
             <img src={currentTrack?.cover} className={`w-[45vh] h-[45vh] mx-auto rounded-[3rem] mb-10 transition-all duration-700 ${hideTrackInfo ? 'blur-[80px] scale-90 opacity-50' : 'shadow-[0_0_100px_rgba(139,92,246,0.3)]'}`} />
             <h1 className={`text-7xl font-black mb-4 transition-all duration-500 ${hideTrackInfo ? 'text-gray-800 blur-sm' : 'text-white'}`}>{hideTrackInfo ? 'Угадай трек!' : currentTrack?.title}</h1>
             <p className={`text-4xl transition-all duration-500 ${hideTrackInfo ? 'text-gray-900 blur-sm' : 'text-purple-400 font-bold'}`}>{hideTrackInfo ? 'Исполнитель' : currentTrack?.artist}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-gray-950 text-white z-50 flex flex-col font-sans animate-in zoom-in-95 duration-300">
        <audio ref={audioRef} preload="auto" crossOrigin="anonymous" {...audioHandlers} />

        {/* ХЕДЕР ВЕДУЩЕГО */}
        <div className="h-20 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-8 shadow-xl relative z-20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg"><PartyPopper size={28} className="text-white" /></div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider">{hostSession.game.name}</h2>
              <p className="text-gray-400 text-sm font-medium">{hostSession.round.name} • {hostSession.round.winCondition === 'full' ? 'Бинго' : hostSession.round.winCondition === '2_lines' ? '2 Линии' : '1 Линия'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center mr-4">
              <div className="text-3xl font-black text-purple-400">{playedTrackIds.size} <span className="text-gray-600 text-xl">/ {shuffledTracks.length}</span></div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Сыграно</div>
            </div>
            <div className="h-10 w-px bg-gray-800 mr-2" />
            <button onClick={() => setIsProjectorMode(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-lg"><MonitorPlay size={20} /> Проектор</button>
            <button onClick={() => { setVerifyCardId(''); setVerifyResult(null); setIsBingoVerifyModalOpen(true); }} className="bg-green-600 hover:bg-green-500 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-lg"><CheckCircle2 size={20} /> БИНГО!</button>
            <button onClick={endHostSession} className="p-3 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition ml-2"><Power size={24} /></button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          {/* ЛЕВАЯ ЧАСТЬ (ОСНОВНАЯ) */}
          <div className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 to-gray-950 overflow-hidden">
            
            {/* АВТО БАННЕР БИНГО (ВНУТРИ ЦЕНТРАЛЬНОЙ ЧАСТИ) */}
            {autoWinners.length > 0 && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-green-500 text-white px-8 py-3 rounded-full font-black text-2xl shadow-[0_0_50px_rgba(34,197,94,0.4)] z-[30] animate-bounce cursor-pointer" onClick={() => setAutoWinners([])}>
                <PartyPopper size={28} /> ЕСТЬ БИНГО: {autoWinners.join(', ')}!
              </div>
            )}

            {/* ВЕРХНЯЯ ЗОНА: ОБЛОЖКА И ТЕКСТ (Занимает всё свободное место) */}
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              {currentTrack && (
                <div className="w-full flex flex-col items-center">
                  <div className={`relative w-72 h-72 md:w-80 md:h-80 rounded-3xl overflow-hidden shadow-2xl mb-8 transition-all duration-700 ${isPlaying ? 'scale-105 shadow-purple-900/40' : ''}`}>
                    <img src={currentTrack.cover} alt="cover" className={`w-full h-full object-cover transition-all duration-500 ${hideTrackInfo ? 'blur-3xl scale-110 opacity-60' : ''}`} />
                    {hideTrackInfo && <div className="absolute inset-0 flex items-center justify-center"><Music size={100} className="text-white/20" /></div>}
                  </div>
                  <div className="text-center mb-4">
                    <h1 className={`text-4xl font-black mb-2 transition-all duration-300 ${hideTrackInfo ? 'text-gray-700 blur-sm select-none' : 'text-white'}`}>
                      {hideTrackInfo ? '???????? ???????' : currentTrack.title}
                    </h1>
                    <p className={`text-xl transition-all duration-300 ${hideTrackInfo ? 'text-gray-800 blur-sm select-none' : 'text-purple-400 font-medium'}`}>
                      {hideTrackInfo ? '?????????' : currentTrack.artist}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* НИЖНЯЯ ЗОНА: ПАНЕЛЬ УПРАВЛЕНИЯ (Прижата к низу) */}
            <div className="w-full bg-gray-900/60 backdrop-blur-xl border-t border-gray-800 p-8 shrink-0">
              <div className="max-w-4xl mx-auto flex flex-col gap-6">
                
                {/* ПРОГРЕСС БАР И АВТО-ПЕРЕХОД */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 w-12">{formatTime(currentTime)}</span>
                    <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden relative mx-4">
                      <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-300 ease-linear" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-500 w-12 text-right">{formatTime(duration)}</span>
                  </div>
                </div>

                {/* КНОПКИ УПРАВЛЕНИЯ */}
                <div className="flex items-center justify-between">
                  {/* Левая группа: Настройки */}
                  <div className="w-48">
                    <label className="flex items-center gap-3 cursor-pointer group" title="Автоматически включать следующий трек">
                      <div className={`relative w-12 h-6 transition-all duration-300 rounded-full ${isAutoPlay ? 'bg-purple-600' : 'bg-gray-800 border border-gray-700'}`}>
                        <div className={`absolute top-[3px] w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${isAutoPlay ? 'translate-x-7' : 'translate-x-1'}`} />
                      </div>
                      <input type="checkbox" checked={isAutoPlay} onChange={e => setIsAutoPlay(e.target.checked)} className="hidden" />
                      <span className={`text-xs font-black uppercase tracking-widest transition-colors ${isAutoPlay ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-400'}`}>Авто-ход</span>
                    </label>
                  </div>

                  {/* Центральная группа: Плеер */}
                  <div className="flex items-center gap-6">
                    <button onClick={() => setHideTrackInfo(!hideTrackInfo)} className={`w-14 h-14 rounded-full flex items-center justify-center transition ${hideTrackInfo ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                      {hideTrackInfo ? <EyeOff size={24} /> : <Eye size={24} />}
                    </button>
                    <button onClick={() => playHostTrack(currentHostTrackIndex - 1)} disabled={currentHostTrackIndex === 0} className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center text-white hover:bg-gray-700 disabled:opacity-30 transition"><SkipBack size={28} /></button>
                    
                    <button
                      onClick={() => {
                        if (isPlaying) { audioRef.current?.pause(); setPlayingTrackId(null); }
                        else { playHostTrack(currentHostTrackIndex); }
                      }}
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition transform hover:scale-105 shadow-2xl ${isPlaying ? 'bg-orange-600 shadow-orange-900/40' : 'bg-purple-600 shadow-purple-900/40'}`}
                    >
                      {isPlaying ? <PauseCircle size={44} /> : <Play size={44} className="ml-1" />}
                    </button>

                    <button onClick={() => { playHostTrack(currentHostTrackIndex + 1); setHideTrackInfo(true); }} disabled={currentHostTrackIndex === shuffledTracks.length - 1} className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center text-white hover:bg-gray-700 disabled:opacity-30 transition"><SkipForward size={28} /></button>
                    <div className="w-14" /> {/* Заглушка для баланса */}
                  </div>

                  {/* Правая группа: Статистика (просто для симметрии) */}
                  <div className="w-48 text-right">
                     <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">Осталось</span>
                     <span className="text-xl font-black text-gray-400">{shuffledTracks.length - playedTrackIds.size}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ПРАВАЯ ЧАСТЬ (СПИСОК) */}
          <div className="w-[400px] bg-gray-900 border-l border-gray-800 flex flex-col z-10 shrink-0">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3"><ListChecks className="text-purple-400" /><h3 className="text-lg font-bold">Очередь</h3></div>
              <button onClick={reshuffleTracks} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition"><Shuffle size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
              {shuffledTracks.map((track, index) => {
                const isPlayed = playedTrackIds.has(track.id);
                const isCurrent = currentHostTrackIndex === index;
                return (
                  <button key={track.id} onClick={() => { setCurrentHostTrackIndex(index); setHideTrackInfo(true); }} className={`w-full text-left p-3 rounded-xl flex items-center gap-4 transition border ${isCurrent ? 'bg-purple-900/30 border-purple-500 shadow-lg' : isPlayed ? 'bg-gray-900 border-gray-800 opacity-50 grayscale' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                    <div className="w-6 font-bold text-center text-xs text-gray-500">{index + 1}</div>
                    <img src={track.cover} className="w-10 h-10 rounded-lg object-cover" alt="" />
                    <div className="flex-1 overflow-hidden">
                      <div className={`font-bold truncate text-sm ${isCurrent ? 'text-purple-400' : 'text-white'}`}>{track.title}</div>
                      <div className="text-[11px] text-gray-500 truncate">{track.artist}</div>
                    </div>
                    {isCurrent && isPlaying && <Loader2 size={16} className="text-purple-400 animate-spin" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* --- МОДАЛКА ПРОВЕРКИ БИНГО --- */}
        {isBingoVerifyModalOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className={`bg-gray-900 p-8 rounded-3xl w-full border border-gray-800 text-center animate-in zoom-in-95 ${verifyResult ? 'max-w-xl' : 'max-w-md'}`}>
              {!verifyResult ? (
                <>
                  <Trophy size={64} className="mx-auto text-yellow-500 mb-6" />
                  <h2 className="text-3xl font-black mb-2">ПРОВЕРКА БИНГО</h2>
                  <p className="text-gray-400 mb-8">Введите ID карточки ({hostSession.round.winCondition === 'full' ? 'Вся карточка' : hostSession.round.winCondition === '2_lines' ? 'Две линии' : 'Одна линия'})</p>
                  <input autoFocus type="text" value={verifyCardId} onChange={e => setVerifyCardId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerifyCard()} placeholder="#ID (напр. 1042)" className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-4 px-6 text-2xl font-black text-center text-white mb-6 focus:border-purple-500 outline-none uppercase tracking-widest" />
                  <div className="flex gap-4">
                    <button onClick={() => setIsBingoVerifyModalOpen(false)} className="flex-1 py-4 bg-gray-800 rounded-xl font-bold hover:bg-gray-700 transition">Отмена</button>
                    <button onClick={handleVerifyCard} className="flex-1 py-4 bg-green-600 rounded-xl font-bold hover:bg-green-500 transition text-white flex items-center justify-center gap-2"><SearchCheck size={24} /> Проверить</button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-between w-full mb-6 pb-6 border-b border-gray-800">
                    <div className="text-left">
                      <div className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-1">Карточка #{verifyResult.card.id}</div>
                      <div className="text-xl font-black">Линий: <span className={verifyResult.linesCount > 0 ? 'text-purple-400' : 'text-gray-500'}>{verifyResult.linesCount}</span></div>
                    </div>
                    {verifyResult.isWinner
                      ? <div className="px-4 py-2 bg-green-500/20 text-green-400 rounded-xl font-black text-2xl flex items-center gap-2 animate-pulse"><CheckCircle2 /> БИНГО!</div>
                      : <div className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl font-bold text-lg">Нет Бинго</div>}
                  </div>
                  <div className="grid grid-cols-5 gap-2 mb-8 w-full max-w-[400px]">
                    {verifyResult.card.cells.map((cell: any, i: number) => (
                      <div key={i} className={`aspect-square rounded-xl flex flex-col items-center justify-center p-1 border-2 ${verifyResult.matches[i] ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                        {'isFreeSpace' in cell ? <span className="font-black text-xs uppercase">FREE</span> : <span className="font-bold text-[8px] leading-tight text-center line-clamp-3">{(cell as Track).title}</span>}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 w-full">
                    <button onClick={() => setIsBingoVerifyModalOpen(false)} className="flex-1 py-4 bg-gray-800 rounded-xl font-bold hover:bg-gray-700 transition">Закрыть</button>
                    <button onClick={() => { setVerifyCardId(''); setVerifyResult(null); }} className="flex-1 py-4 bg-purple-600 rounded-xl font-bold hover:bg-purple-500 transition text-white">Проверить другую</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= РЕНДЕР ВКЛАДОК =================
  const renderGamesTab = () => {
    if (viewingGame) {
      const currentGame = games.find(g => g.id === viewingGame.id) || viewingGame;
      return (
        <div className="animate-in slide-in-from-right-8 duration-300 flex flex-col h-full">
          <button onClick={() => setViewingGame(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition w-fit"><ChevronLeft size={20} /> Назад к списку игр</button>
          <div className="flex items-end justify-between mb-8 border-b border-gray-800 pb-8">
            <div>
              <h1 className="text-4xl font-black mb-2">{currentGame.name}</h1>
              <div className="flex items-center gap-4 text-gray-400"><Calendar size={16} /> {new Date(currentGame.created_at || Date.now()).toLocaleDateString('ru-RU')}<span className="w-1 h-1 bg-gray-600 rounded-full" /><span>{currentGame.rounds.length} туров</span></div>
            </div>
            <button onClick={e => deleteGame(currentGame.id, e)} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition font-bold"><Trash2 size={20} /> Удалить мероприятие</button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 pb-10 custom-scrollbar">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Туры</h2>
              <button onClick={() => setIsAddRoundModalOpen(true)} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"><PlusCircle size={18} /> Добавить тур</button>
            </div>
            {currentGame.rounds.length === 0
              ? <div className="text-center py-20 text-gray-500 bg-gray-900/50 rounded-2xl border border-dashed border-gray-800">В этой игре пока нет туров.</div>
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {currentGame.rounds.map((round, index) => {
                    const playlist = playlists.find(p => p.id === round.playlistId);
                    const cardsCountLabel = round.cards?.length ? `${round.cards.length} карточек` : 'Нет карточек';
                    const conditionText = round.winCondition === 'full' ? 'Бинго' : round.winCondition === '2_lines' ? '2 Линии' : '1 Линия';
                    return (
                      <div key={round.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col group relative shadow-lg">
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-purple-400 font-bold bg-purple-500/10 px-3 py-1.5 rounded-lg text-sm flex gap-2 items-center">Тур {index + 1} <span className="text-gray-400 text-xs font-normal">({conditionText})</span></span>
                          <button onClick={() => deleteRound(round.id)} className="text-gray-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                        </div>
                        <h3 className="text-2xl font-black mb-2 truncate">{round.name}</h3>
                        <p className="text-gray-400 text-sm mb-2 flex items-center gap-2"><ListMusic size={16} /> {playlist ? `${playlist.name} (${playlist.tracks.length} треков)` : 'Плейлист удалён'}</p>
                        <p className="text-gray-500 text-sm mb-6 flex items-center gap-2"><LayoutTemplate size={16} /> {cardsCountLabel}</p>
                        <div className="mt-auto flex gap-3">
                          <button onClick={() => startHostSession(currentGame, round)} disabled={!playlist} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"><Play size={20} fill="currentColor" /> Играть</button>
                          <button onClick={() => { if (templates.length > 0 && !selectedTemplateId) setSelectedTemplateId(templates[0].id); setCardGeneratorSetup({ game: currentGame, round }); }} disabled={!playlist || playlist.tracks.length < 24} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"><Printer size={20} /> Карточки</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      );
    }
    return (
      <div className="animate-in fade-in duration-300">
        <h1 className="text-3xl font-bold mb-2">Мероприятия</h1>
        <p className="text-gray-400 mb-8">Создавайте игры, добавляйте в них туры и генерируйте карточки для гостей.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div onClick={() => setIsCreateGameModalOpen(true)} className="bg-gray-900/50 border-2 border-dashed border-gray-700 rounded-2xl h-56 flex flex-col items-center justify-center text-gray-400 hover:border-purple-500 hover:text-purple-400 transition cursor-pointer"><PartyPopper size={40} className="mb-4" /><span className="font-bold text-lg">Создать игру</span></div>
          {games.map(game => (
            <div key={game.id} onClick={() => setViewingGame(game)} className="bg-gray-900 border border-gray-800 rounded-2xl h-56 p-6 flex flex-col hover:border-purple-500/50 transition cursor-pointer relative shadow-lg group">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-auto text-purple-400"><PartyPopper size={24} /></div>
              <button onClick={e => deleteGame(game.id, e)} className="absolute top-4 right-4 p-2 text-gray-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
              <div><h3 className="font-bold text-xl mb-1 truncate">{game.name}</h3><p className="text-sm text-gray-500">{game.rounds?.length || 0} туров</p></div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDatabaseTab = () => (
    <div className="animate-in fade-in duration-300 flex flex-col h-full">
      <h1 className="text-3xl font-bold mb-2">База Песен</h1>
      <p className="text-gray-400 mb-6">Ищите треки через API Deezer и собирайте их в плейлисты</p>
      <form onSubmit={handleSearchSubmit} className="flex gap-4 mb-4">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} /><input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Исполнитель, трек или жанр..." className="w-full bg-gray-900 border border-gray-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-purple-500 transition" /></div>
        <button type="submit" disabled={isSearching} className="bg-purple-600 hover:bg-purple-500 px-8 rounded-xl font-bold transition disabled:opacity-50 min-w-[120px] flex items-center justify-center">{isSearching ? <Loader2 className="animate-spin" size={20} /> : 'Найти'}</button>
      </form>
      <div className="flex flex-wrap gap-2 mb-8">
      {FILTERS.map(f => (
        <button
          key={f.name}
          onClick={() => {
            if (f.type === 'chart') {
              loadChartByGenre(f.id!, f.name);
            } else {
              setSearchQuery(f.query!);
              searchDeezer(f.query!, f.name);
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition ${
            activeFilter === f.name
              ? f.name === 'Топ Чарт'
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                : 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          {f.name === 'Топ Чарт' && <Flame size={16} />}
          {f.name}
        </button>
      ))}
    </div>
    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
      {isSearching && searchResults.length === 0
        ? <div className="flex flex-col items-center justify-center h-40 text-gray-500">
            <Loader2 className="animate-spin mb-4" size={32} /><p>Ищем музыку...</p>
          </div>
        : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              {searchResults.map(track => {
                const isPlaying = playingTrackId === track.id;
                return (
                  <div key={track.id} className={`bg-gray-900 p-3 rounded-xl flex gap-3 items-center border transition group ${isPlaying ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'border-gray-800 hover:border-gray-600'}`}>
                    <div className="relative w-14 h-14 rounded-md overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => togglePlay(track)}>
                      <img src={track.cover} alt="cover" className={`w-full h-full object-cover transition-transform ${isPlaying ? 'scale-110 blur-[2px]' : ''}`} />
                      <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{isPlaying ? <PauseCircle size={28} className="text-purple-400" /> : <PlayCircle size={28} className="text-white" />}</div>
                    </div>
                    <div className="flex-1 overflow-hidden"><h4 className={`font-bold truncate text-sm ${isPlaying ? 'text-purple-400' : 'text-white'}`}>{track.title}</h4><p className="text-xs text-gray-400 truncate">{track.artist}</p></div>
                    <button onClick={() => setTrackToAdd(track)} className="p-2 bg-gray-800 rounded-lg hover:bg-purple-600 transition flex-shrink-0 text-gray-400 hover:text-white"><Plus size={18} /></button>
                  </div>
                );
              })}
            </div>
    
            {/* ПАГИНАЦИЯ */}
            {searchResults.length > 0 && (
              <div className="flex items-center justify-between border-t border-gray-800 pt-6 pb-2">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 0 || isSearching}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} /> Назад
                </button>
    
                <div className="text-center">
                  <div className="text-white font-bold">Страница {currentPage + 1}</div>
                  <div className="text-gray-500 text-xs">
                    {currentPage * ITEMS_PER_PAGE + 1}–{Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalResults)} из {totalResults.toLocaleString()}
                  </div>
                </div>
    
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={(currentPage + 1) * ITEMS_PER_PAGE >= totalResults || isSearching}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Вперёд <ChevronLeft size={18} className="rotate-180" />
                </button>
              </div>
            )}
          </>
        )}
    </div>
    </div>
  );

  const renderPlaylistsTab = () => {
    if (viewingPlaylist) {
      const currentPlaylist = playlists.find(p => p.id === viewingPlaylist.id) || viewingPlaylist;
      const isReadyForGame = currentPlaylist.tracks.length >= 24;
      return (
        <div className="animate-in slide-in-from-right-8 duration-300 flex flex-col h-full">
          <button onClick={() => setViewingPlaylist(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition w-fit"><ChevronLeft size={20} /> Назад к списку</button>
          <div className="flex items-end justify-between mb-8 border-b border-gray-800 pb-8">
            <div>
              <h1 className="text-4xl font-black mb-2">{currentPlaylist.name}</h1>
              <div className="flex items-center gap-4">
                <span className="text-gray-400">{currentPlaylist.tracks.length} треков</span>
                {isReadyForGame ? <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium flex items-center gap-1"><CheckCircle2 size={16} /> Готов к генерации Бинго</span> : <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">Нужно минимум 24 трека (сейчас {currentPlaylist.tracks.length})</span>}
              </div>
            </div>
            <div className="flex gap-4">
              <label className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition shadow-lg">
                {isUploadingMp3 ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
                <span>Загрузить свои MP3</span>
                <input type="file" multiple accept="audio/mpeg,audio/mp3,audio/wav" className="hidden" onChange={e => uploadCustomTracks(e, currentPlaylist.id)} disabled={isUploadingMp3} />
              </label>
              <button onClick={() => cachePlaylistForOffline(currentPlaylist)} disabled={currentPlaylist.tracks.length === 0} className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-50"><HardDriveDownload size={20} /> Офлайн Кэш</button>
            </div>
          </div>
          {offlineProgress && (
            <div className="mb-6 bg-blue-900/30 border border-blue-500/50 rounded-xl p-4 flex items-center justify-between">
              <div className="font-bold text-blue-400 flex items-center gap-2"><Loader2 className="animate-spin" size={20} /> Сохраняем в офлайн ({offlineProgress.current} из {offlineProgress.total})</div>
              <div className="w-1/2 bg-gray-900 rounded-full h-2 overflow-hidden"><div className="bg-blue-500 h-full transition-all" style={{ width: `${(offlineProgress.current / offlineProgress.total) * 100}%` }} /></div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto pr-2 pb-10 custom-scrollbar">
            {currentPlaylist.tracks.length === 0
              ? <div className="text-center py-20 text-gray-500 bg-gray-900/50 rounded-2xl border border-dashed border-gray-800 flex flex-col items-center"><Music size={48} className="mb-4 opacity-50" /><p className="text-lg">Пусто. Загрузите свои MP3 или найдите треки в интернете.</p></div>
              : (
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-gray-500 mb-2 font-medium bg-gray-900 p-3 rounded-lg border border-gray-800"><Timer size={16} className="inline mr-2 -mt-1" /> Подсказка: алгоритм берёт случайные 24 трека из всего плейлиста. Загрузите 60–80 треков для разнообразия.</div>
                  {currentPlaylist.tracks.map((track, index) => {
                    const isPlaying = playingTrackId === track.id;
                    return (
                      <div key={track.id} className={`flex items-center gap-4 p-3 rounded-xl border transition group ${isPlaying ? 'bg-gray-800 border-purple-500' : 'bg-gray-900 border-gray-800 hover:bg-gray-800'}`}>
                        <div className="w-8 text-center text-gray-500 font-medium">{index + 1}</div>
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => togglePlay(track)}>
                          <img src={track.cover} alt="cover" className="w-full h-full object-cover" />
                          <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{isPlaying ? <PauseCircle size={24} className="text-purple-400" /> : <PlayCircle size={24} className="text-white" />}</div>
                        </div>
                        <div className="flex-1"><p className={`font-bold ${isPlaying ? 'text-purple-400' : 'text-white'}`}>{track.title}</p><p className="text-sm text-gray-400">{track.artist}</p></div>
                        {track.isCustom && <span className="text-[10px] px-2 py-1 bg-purple-500/20 text-purple-400 rounded uppercase font-bold tracking-widest mr-4">Свой MP3</span>}
                        <button onClick={() => removeTrackFromPlaylist(currentPlaylist.id, track.id)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition opacity-0 group-hover:opacity-100"><Trash2 size={20} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      );
    }
    return (
      <div className="animate-in fade-in duration-300">
        <h1 className="text-3xl font-bold mb-2">Плейлисты</h1>
        <p className="text-gray-400 mb-8">Создавайте папки с музыкой (по 60–80 треков).</p>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div onClick={() => setIsCreatePlaylistModalOpen(true)} className="bg-gray-900/50 border-2 border-dashed border-gray-700 rounded-2xl h-56 flex flex-col items-center justify-center text-gray-400 hover:border-purple-500 hover:text-purple-400 transition cursor-pointer group"><FolderPlus size={40} className="mb-4 group-hover:scale-110 transition-transform" /><span className="font-bold text-lg">Новый плейлист</span></div>
          {playlists.map(playlist => (
            <div key={playlist.id} onClick={() => setViewingPlaylist(playlist)} className="bg-gray-900 border border-gray-800 rounded-2xl h-56 p-6 flex flex-col hover:border-gray-500 transition cursor-pointer relative group shadow-lg">
              <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-auto text-purple-400"><ListMusic size={24} /></div>
              <button onClick={e => deletePlaylist(playlist.id, e)} className="absolute top-4 right-4 p-2 text-gray-600 hover:text-red-400 hover:bg-gray-800 rounded-lg transition opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
              <div><h3 className="font-bold text-xl mb-1 truncate">{playlist.name}</h3><p className={`text-sm ${playlist.tracks.length >= 24 ? 'text-green-400' : 'text-gray-500'}`}>{playlist.tracks.length} треков</p></div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTemplatesTab = () => (
    <div className="animate-in fade-in duration-300 h-full flex flex-col">
      <div className="flex justify-between items-end mb-8">
        <div><h1 className="text-3xl font-bold mb-2">Шаблоны карточек</h1><p className="text-gray-400">Настройте внешний вид бинго-карточек.</p></div>
        <button onClick={() => { setEditingTemplate({ name: '', config: { bgColor: '#1e1b4b', textColor: '#ffffff', accentColor: '#8b5cf6', gridColor: '#2e1065', cardTitle: 'MUZ BINGO', showArtist: true, centerText: 'FREE SPACE', footerText: 'MuzBingo', showQR: true, layout: '2' } }); setIsCreateTemplateModalOpen(true); }} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition flex items-center gap-2"><Palette size={20} /> Создать шаблон</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
        {templates.map(template => (
          <div key={template.id} className="group relative bg-gray-900 border border-gray-800 p-4 rounded-2xl">
            <div style={{ backgroundColor: template.config.bgColor, backgroundImage: template.config.backgroundImageUrl ? `url(${template.config.backgroundImageUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} className="aspect-[3/4] rounded-xl p-3 shadow-inner border border-white/10 overflow-hidden mb-4 relative">
              <div style={{ color: template.config.accentColor }} className="text-center font-black text-sm mb-2 border-b pb-1 border-white/10 uppercase">{template.config.cardTitle}</div>
              <div className="grid grid-cols-5 gap-0.5 opacity-40">{[...Array(25)].map((_, i) => <div key={i} style={{ backgroundColor: template.config.gridColor }} className="aspect-square rounded-sm border border-white/5" />)}</div>
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/50 rounded text-[10px] text-white">{template.config.layout} на А4</div>
            </div>
            <div className="flex justify-between items-center mt-2">
              <h3 className="font-bold truncate pr-2">{template.name}</h3>
              <button onClick={e => deleteTemplate(template.id, e)} className="p-2 bg-gray-800 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ================= ГЛАВНЫЙ РЕНДЕР =================
  return (
    <div className="flex h-screen bg-gray-950 text-white font-sans selection:bg-purple-500 overflow-hidden relative">

      {/* ГЛОБАЛЬНЫЙ АУДИО ПЛЕЕР — всегда в DOM в основном рендере */}
      <audio
        ref={audioRef}
        preload="auto"
        crossOrigin="anonymous"
        {...audioHandlers}
      />

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
          <button onClick={() => setActiveTab('games')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'games' ? 'bg-purple-600 text-white font-bold shadow-lg shadow-purple-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><PartyPopper size={20} /> Мероприятия</button>
          <div className="h-px bg-gray-800 my-2 mx-4" />
          <button onClick={() => setActiveTab('database')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'database' ? 'bg-purple-600 text-white font-bold shadow-lg shadow-purple-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><Database size={20} /> База песен</button>
          <button onClick={() => setActiveTab('playlists')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'playlists' ? 'bg-purple-600 text-white font-bold shadow-lg shadow-purple-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><ListMusic size={20} /> Плейлисты</button>
          <button onClick={() => setActiveTab('templates')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'templates' ? 'bg-purple-600 text-white font-bold shadow-lg shadow-purple-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><LayoutTemplate size={20} /> Шаблоны</button>
        </nav>
      </aside>

      <main className="flex-1 overflow-hidden p-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-gray-950">
        {activeTab === 'games' && renderGamesTab()}
        {activeTab === 'database' && renderDatabaseTab()}
        {activeTab === 'playlists' && renderPlaylistsTab()}
        {activeTab === 'templates' && renderTemplatesTab()}
      </main>

      {/* МОДАЛКИ */}
      {cardGeneratorSetup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between"><h3 className="text-xl font-bold flex items-center gap-2"><Printer size={20} className="text-purple-400" /> Генератор карточек</h3><button onClick={() => setCardGeneratorSetup(null)} className="text-gray-400 hover:text-white transition"><X size={24} /></button></div>
            <div className="p-6 space-y-6">
              <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl text-purple-200 text-sm">Тур: <strong>{cardGeneratorSetup.round.name}</strong></div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Количество карточек</label>
                <div className="flex bg-gray-950 rounded-xl overflow-hidden border border-gray-800">
                  <button onClick={() => setCardsCount(Math.max(1, cardsCount - 5))} className="px-4 bg-gray-800 hover:bg-gray-700 transition font-bold">-</button>
                  <input type="number" value={cardsCount} onChange={e => setCardsCount(Number(e.target.value) || 1)} className="flex-1 bg-transparent text-center font-bold text-xl py-2 focus:outline-none" />
                  <button onClick={() => setCardsCount(cardsCount + 5)} className="px-4 bg-gray-800 hover:bg-gray-700 transition font-bold">+</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Шаблон печати</label>
                {templates.length === 0
                  ? <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">Нет шаблонов! Создайте их во вкладке "Шаблоны".</div>
                  : <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none">{templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.config.layout} на А4)</option>)}</select>}
              </div>
              <div className="flex gap-4 pt-2">
                <button onClick={() => setCardGeneratorSetup(null)} className="flex-1 py-4 rounded-xl font-bold bg-gray-800 hover:bg-gray-700 transition">Отмена</button>
                <button onClick={generateCards} disabled={templates.length === 0} className="flex-1 py-4 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 transition disabled:opacity-50 flex justify-center gap-2"><LayoutTemplate size={20} /> Сгенерировать</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCreateGameModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-gray-800"><h3 className="text-xl font-bold">Новое мероприятие</h3><button onClick={() => setIsCreateGameModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button></div>
            <div className="p-6">
              <input autoFocus type="text" value={newGameName} onChange={e => setNewGameName(e.target.value)} placeholder="Название игры" className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 mb-6" onKeyDown={e => e.key === 'Enter' && createGame()} />
              <div className="flex gap-4"><button onClick={() => setIsCreateGameModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold bg-gray-800 hover:bg-gray-700 transition">Отмена</button><button onClick={createGame} className="flex-1 py-3 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 transition">Создать</button></div>
            </div>
          </div>
        </div>
      )}

      {isCreatePlaylistModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-gray-800"><h3 className="text-xl font-bold">Новый плейлист</h3><button onClick={() => setIsCreatePlaylistModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button></div>
            <div className="p-6">
              <input autoFocus type="text" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="Название плейлиста..." className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-white mb-6" onKeyDown={e => e.key === 'Enter' && createPlaylist()} />
              <div className="flex gap-4"><button onClick={() => setIsCreatePlaylistModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold bg-gray-800 transition">Отмена</button><button onClick={createPlaylist} className="flex-1 py-3 rounded-xl font-bold bg-purple-600 transition">Создать</button></div>
            </div>
          </div>
        </div>
      )}

      {trackToAdd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-gray-800"><h3 className="text-xl font-bold">Добавить в плейлист</h3><button onClick={() => setTrackToAdd(null)} className="text-gray-400 hover:text-white"><X size={24} /></button></div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6 p-4 bg-gray-950 rounded-xl border border-gray-800"><img src={trackToAdd.cover} className="w-12 h-12 rounded-md" alt="" /><div className="overflow-hidden"><p className="font-bold truncate">{trackToAdd.title}</p><p className="text-sm text-gray-400 truncate">{trackToAdd.artist}</p></div></div>
              {playlists.length === 0
                ? <div className="text-center py-6"><button onClick={() => { setTrackToAdd(null); setIsCreatePlaylistModalOpen(true); }} className="px-6 py-2 bg-purple-600 rounded-lg font-bold">Создать плейлист</button></div>
                : <div className="max-h-60 overflow-y-auto pr-2 flex flex-col gap-2 custom-scrollbar">{playlists.map(p => { const isAdded = p.tracks.some(t => t.id === trackToAdd.id); return <button key={p.id} onClick={() => !isAdded && addTrackToPlaylist(p.id)} disabled={isAdded} className={`flex justify-between p-4 rounded-xl border text-left ${isAdded ? 'bg-gray-800/50 border-gray-800 opacity-50' : 'bg-gray-800 border-gray-700 hover:border-purple-500'}`}><span className="font-bold truncate pr-4">{p.name}</span><span className="text-xs text-gray-400 whitespace-nowrap">{isAdded ? 'Добавлен' : `${p.tracks.length} треков`}</span></button>; })}</div>}
            </div>
          </div>
        </div>
      )}

      {isAddRoundModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-800"><h3 className="text-xl font-bold">Добавить тур</h3><button onClick={() => setIsAddRoundModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button></div>
            <div className="p-6 flex flex-col gap-4">
              <input type="text" value={newRound.name || ''} onChange={e => setNewRound({ ...newRound, name: e.target.value })} placeholder="Название тура" className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-purple-500" />
              <select value={newRound.playlistId || ''} onChange={e => setNewRound({ ...newRound, playlistId: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-purple-500">
                <option value="" disabled>Выберите плейлист (мин. 24 трека)...</option>
                {playlists.filter(p => p.tracks.length >= 24).map(p => <option key={p.id} value={p.id}>{p.name} ({p.tracks.length} треков)</option>)}
              </select>
              <select value={newRound.winCondition || '1_line'} onChange={e => setNewRound({ ...newRound, winCondition: e.target.value as any })} className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-purple-500">
                <option value="1_line">1 Линия</option>
                <option value="2_lines">2 Линии</option>
                <option value="full">Вся карточка</option>
              </select>
              <div className="flex gap-4 mt-4">
                <button onClick={() => setIsAddRoundModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold bg-gray-800 hover:bg-gray-700 transition">Отмена</button>
                <button onClick={addRoundToGame} disabled={!newRound.name || !newRound.playlistId} className="flex-1 py-3 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 transition disabled:opacity-50">Добавить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCreateTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex overflow-hidden">
          <div className="w-[450px] bg-gray-900 border-r border-gray-800 p-8 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="flex items-center gap-3 mb-8 text-purple-400 border-b border-gray-800 pb-6"><Palette size={28} /><h2 className="text-2xl font-bold text-white">Конструктор стиля</h2></div>
            <div className="space-y-6 flex-1">
              <div><label className="block text-sm font-medium text-gray-400 mb-2">Название шаблона</label><input type="text" value={editingTemplate.name} onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none" placeholder="Напр: Классика 2 на А4" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-400 mb-2">Заголовок</label><input type="text" value={editingTemplate.config?.cardTitle} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, cardTitle: e.target.value } })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-400 mb-2">Центр. клетка</label><input type="text" value={editingTemplate.config?.centerText} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, centerText: e.target.value } })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none" /></div>
              </div>
              <div className="pt-4 border-t border-gray-800">
                <label className="block text-sm font-medium text-gray-400 mb-2">Фоновое изображение (PNG/JPG)</label>
                {editingTemplate.config?.backgroundImageUrl && (
                  <div className="relative rounded-xl overflow-hidden border border-gray-700 mb-4">
                    <img src={editingTemplate.config.backgroundImageUrl} className="w-full h-32 object-cover opacity-80" alt="bg preview" />
                    <button onClick={() => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, backgroundImageUrl: undefined } })} className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-lg hover:bg-red-500 transition"><X size={16} /></button>
                  </div>
                )}
                <label className="flex items-center justify-center gap-3 w-full py-3 mb-3 bg-gray-800 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-purple-500 hover:bg-gray-700/50 transition">
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) return showToast('Файл слишком большой (макс. 10 МБ)');
                    showToast('Загружаем изображение...');
                    const url = await uploadTemplateBackground(file);
                    if (url) { setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, backgroundImageUrl: url } }); showToast('Изображение загружено!'); }
                  }} />
                  <Upload size={20} className="text-gray-400" />
                  <span className="text-gray-400 font-medium">{editingTemplate.config?.backgroundImageUrl ? 'Заменить изображение' : 'Загрузить PNG/JPG'}</span>
                </label>
                <button onClick={downloadDesignGuide} className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition font-medium border border-gray-700"><Download size={18} /> Скачать разметку для дизайнера (SVG)</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Раскладка для печати</label>
                <div className="flex gap-2 p-1 bg-gray-800 rounded-xl">
                  {(['1', '2', '4'] as const).map(layout => (
                    <button key={layout} onClick={() => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, layout } })} className={`flex-1 py-2 rounded-lg font-bold transition ${editingTemplate.config?.layout === layout ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>{layout} {layout === '1' ? '(А4)' : layout === '2' ? '(А5)' : '(А6)'}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col"><label className="text-xs font-medium text-gray-400 mb-2 text-center">Цвет Фона</label><input type="color" value={editingTemplate.config?.bgColor} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, bgColor: e.target.value } })} className="w-full h-12 bg-gray-800 border border-gray-700 rounded-xl cursor-pointer" /></div>
                <div className="flex flex-col"><label className="text-xs font-medium text-gray-400 mb-2 text-center">Акцент</label><input type="color" value={editingTemplate.config?.accentColor} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, accentColor: e.target.value } })} className="w-full h-12 bg-gray-800 border border-gray-700 rounded-xl cursor-pointer" /></div>
                <div className="flex flex-col"><label className="text-xs font-medium text-gray-400 mb-2 text-center">Цвет Сетки</label><input type="color" value={editingTemplate.config?.gridColor} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, gridColor: e.target.value } })} className="w-full h-12 bg-gray-800 border border-gray-700 rounded-xl cursor-pointer" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-400 mb-2">Текст в подвале</label><input type="text" value={editingTemplate.config?.footerText} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, footerText: e.target.value } })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none" /></div>
              <div className="space-y-3 pt-4 border-t border-gray-800">
                <label className="flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-700 transition cursor-pointer rounded-xl border border-gray-700"><span className="font-medium">Показывать исполнителя</span><input type="checkbox" checked={editingTemplate.config?.showArtist} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, showArtist: e.target.checked } })} className="w-5 h-5 accent-purple-600" /></label>
                <label className="flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-700 transition cursor-pointer rounded-xl border border-gray-700"><span className="font-medium">Добавить блок QR-кода</span><input type="checkbox" checked={editingTemplate.config?.showQR} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, showQR: e.target.checked } })} className="w-5 h-5 accent-purple-600" /></label>
                {editingTemplate.config?.showQR && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Ссылка для QR-кода</label>
                    <input type="url" value={editingTemplate.config?.qrUrl || ''} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, qrUrl: e.target.value } })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none placeholder:text-gray-600" placeholder="https://t.me/мой_канал" />
                  </div>
                )}
              </div>
            </div>
            <div className="mt-8 flex gap-3 pt-6 border-t border-gray-800 bg-gray-900">
              <button onClick={() => setIsCreateTemplateModalOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 py-4 rounded-xl font-bold transition">Отмена</button>
              <button onClick={saveTemplate} className="flex-1 bg-purple-600 hover:bg-purple-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition"><Save size={20} /> Сохранить</button>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 to-black relative overflow-hidden">
            <div className="absolute top-10 left-10 flex flex-col text-gray-400"><span className="flex items-center gap-2 font-bold text-white mb-1"><Eye size={20} /> Предпросмотр печати</span><span className="text-sm">Пример генерации на листе бумаги</span></div>
            <div className={`bg-white shadow-[0_0_60px_rgba(0,0,0,0.8)] flex items-center justify-center gap-4 p-4 transition-all duration-500 ${editingTemplate.config?.layout === '1' ? 'w-[400px] aspect-[1/1.414]' : editingTemplate.config?.layout === '2' ? 'w-[600px] aspect-[1.414/1] flex-row' : 'w-[450px] aspect-[1/1.414] grid grid-cols-2 grid-rows-2'}`}>
              {[...Array(Number(editingTemplate.config?.layout || 1))].map((_, cardIndex) => (
                <div key={cardIndex} style={{ backgroundColor: editingTemplate.config?.bgColor, color: editingTemplate.config?.textColor, backgroundImage: editingTemplate.config?.backgroundImageUrl ? `url(${editingTemplate.config?.backgroundImageUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} className={`relative flex flex-col rounded shadow-md overflow-hidden ${editingTemplate.config?.layout === '1' ? 'w-full h-full p-8 border-2 border-dashed border-gray-300' : editingTemplate.config?.layout === '2' ? 'w-1/2 h-full p-6 border border-dashed border-gray-300' : 'w-full h-full p-3 border border-dashed border-gray-300'}`}>
                  <div style={{ color: editingTemplate.config?.accentColor, borderColor: `${editingTemplate.config?.accentColor}44` }} className={`text-center font-black border-b-4 uppercase italic tracking-tighter ${editingTemplate.config?.layout === '4' ? 'text-xl mb-2 pb-1 border-b-2' : 'text-3xl mb-4 pb-3'}`}>{editingTemplate.config?.cardTitle}</div>
                  <div className="grid grid-cols-5 gap-1 flex-1">
                    {[...Array(25)].map((_, i) => (
                      <div key={i} style={{ backgroundColor: editingTemplate.config?.gridColor }} className="rounded border border-white/10 flex flex-col items-center justify-center text-center p-1">
                        {i === 12
                          ? <div style={{ color: editingTemplate.config?.accentColor }} className={`font-black uppercase leading-tight ${editingTemplate.config?.layout === '4' ? 'text-[8px]' : 'text-xs'}`}>{editingTemplate.config?.centerText}</div>
                          : <><div className={`font-bold leading-tight opacity-90 uppercase ${editingTemplate.config?.layout === '4' ? 'text-[6px]' : 'text-[9px]'}`}>Трек {i + 1}</div>{editingTemplate.config?.showArtist && <div style={{ color: editingTemplate.config?.accentColor }} className={`font-medium leading-tight opacity-90 italic mt-0.5 ${editingTemplate.config?.layout === '4' ? 'text-[5px]' : 'text-[7px]'}`}>Исполнитель</div>}</>}
                      </div>
                    ))}
                  </div>
                  <div className={`mt-4 flex justify-between items-end ${editingTemplate.config?.layout === '4' ? 'mt-2' : ''}`}>
                    <div className="flex flex-col bg-white/50 p-1 rounded-sm"><div className={`opacity-80 uppercase font-bold ${editingTemplate.config?.layout === '4' ? 'text-[6px]' : 'text-[9px]'}`}>ID: #{1042 + cardIndex}</div><div className={`opacity-70 font-medium ${editingTemplate.config?.layout === '4' ? 'text-[5px]' : 'text-[7px]'}`}>{editingTemplate.config?.footerText}</div></div>
                    {editingTemplate.config?.showQR && (
                      <div className={`bg-white/90 border border-white/20 flex items-center justify-center p-1 ${editingTemplate.config?.layout === '4' ? 'w-8 h-8 rounded-sm' : 'w-12 h-12 rounded'}`}>
                        {editingTemplate.config?.qrUrl ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(editingTemplate.config.qrUrl)}`} className="w-full h-full object-contain mix-blend-multiply" alt="QR" /> : <div className={`font-bold opacity-50 text-center leading-none text-black ${editingTemplate.config?.layout === '4' ? 'text-[4px]' : 'text-[6px]'}`}>МЕСТО ДЛЯ<br />QR КОДА</div>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
