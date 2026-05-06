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

// --- ТИПЫ ДАННЫХ ---
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

const chunkArray = (arr: any[], size: number) => arr.reduce((acc, _, i) => (i % size ? acc :[...acc, arr.slice(i, i + size)]),[]);

const formatTime = (time: number) => {
  if (isNaN(time) || !isFinite(time)) return "0:00";
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function App() {
  const[activeTab, setActiveTab] = useState<'games' | 'playlists' | 'database' | 'templates'>('games');

  // --- СОСТОЯНИЯ SUPABASE ---
  const[playlists, setPlaylists] = useState<Playlist[]>([]);
  const[games, setGames] = useState<Game[]>([]);
  const[templates, setTemplates] = useState<Template[]>([]);

  // --- СОСТОЯНИЯ БАЗЫ ПЕСЕН И ОФЛАЙНА ---
  const[searchQuery, setSearchQuery] = useState('');
  const[searchResults, setSearchResults] = useState<Track[]>([]);
  const[isSearching, setIsSearching] = useState(false);
  const[activeFilter, setActiveFilter] = useState('Топ Чарт');
  const[isUploadingMp3, setIsUploadingMp3] = useState(false);
  const[offlineProgress, setOfflineProgress] = useState<{current: number, total: number} | null>(null);

  // --- СОСТОЯНИЯ АУДИО ПЛЕЕРА ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const[playingTrackId, setPlayingTrackId] = useState<string | number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(false);

  // --- РЕЖИМ ВЕДУЩЕГО (HOST MODE) ---
  const[hostSession, setHostSession] = useState<{ game: Game, round: Round, playlist: Playlist } | null>(null);
  const[shuffledTracks, setShuffledTracks] = useState<Track[]>([]);
  const[playedTrackIds, setPlayedTrackIds] = useState<Set<string | number>>(new Set());
  const[currentHostTrackIndex, setCurrentHostTrackIndex] = useState<number>(0);
  const[hideTrackInfo, setHideTrackInfo] = useState(true);
  const[isProjectorMode, setIsProjectorMode] = useState(false);
  const [autoWinners, setAutoWinners] = useState<string[]>([]); // Бинго детектор

  // --- СОСТОЯНИЯ ГЕНЕРАТОРА И МОДАЛОК ---
  const [cardGeneratorSetup, setCardGeneratorSetup] = useState<{ game: Game, round: Round } | null>(null);
  const[cardsCount, setCardsCount] = useState<number>(20);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const[printViewCards, setPrintViewCards] = useState<{ cards: BingoCard[], template: Template } | null>(null);

  const[isBingoVerifyModalOpen, setIsBingoVerifyModalOpen] = useState(false);
  const[verifyCardId, setVerifyCardId] = useState('');
  const [verifyResult, setVerifyResult] = useState<any | null>(null);

  const [viewingPlaylist, setViewingPlaylist] = useState<Playlist | null>(null);
  const[isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const[newPlaylistName, setNewPlaylistName] = useState('');
  const[trackToAdd, setTrackToAdd] = useState<Track | null>(null);

  const[viewingGame, setViewingGame] = useState<Game | null>(null);
  const[isCreateGameModalOpen, setIsCreateGameModalOpen] = useState(false);
  const[newGameName, setNewGameName] = useState('');
  const[isAddRoundModalOpen, setIsAddRoundModalOpen] = useState(false);
  const[newRound, setNewRound] = useState<Partial<Round>>({ winCondition: '1_line' });

  const[isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
  const[editingTemplate, setEditingTemplate] = useState<Partial<Template>>({
    name: '', config: { bgColor: '#1e1b4b', textColor: '#ffffff', accentColor: '#8b5cf6', gridColor: '#2e1065', cardTitle: 'MUZ BINGO', showArtist: true, centerText: 'FREE SPACE', footerText: 'MuzBingo', showQR: true, layout: '2' }
  });

  const[toast, setToast] = useState<string | null>(null);

  // --- ИНИЦИАЛИЗАЦИЯ И ЗАГРУЗКА ---
  useEffect(() => {
    fetchPlaylists(); fetchGames(); fetchTemplates(); loadTopChart();
    const savedSessionStr = localStorage.getItem('muzbingo_host_session');
    if (savedSessionStr) {
      try {
        const parsed = JSON.parse(savedSessionStr);
        if (parsed?.hostSession) {
          setHostSession(parsed.hostSession); setShuffledTracks(parsed.shuffledTracks ||[]);
          setPlayedTrackIds(new Set(parsed.playedTrackIds ||[]));
          setCurrentHostTrackIndex(parsed.currentHostTrackIndex || 0);
          setHideTrackInfo(parsed.hideTrackInfo ?? true);
        }
      } catch (e) { localStorage.removeItem('muzbingo_host_session'); }
    }
  },[]);

  useEffect(() => {
    if (hostSession) {
      localStorage.setItem('muzbingo_host_session', JSON.stringify({
        hostSession, shuffledTracks, playedTrackIds: Array.from(playedTrackIds),
        currentHostTrackIndex, hideTrackInfo
      }));
    } else {
      localStorage.removeItem('muzbingo_host_session');
    }
  },[hostSession, shuffledTracks, playedTrackIds, currentHostTrackIndex, hideTrackInfo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProjectorMode) {
        if (e.key === 'Escape') setIsProjectorMode(false);
        if (e.code === 'Space') { e.preventDefault(); setHideTrackInfo(prev => !prev); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  },[isProjectorMode]);

  // --- АВТОМАТИЧЕСКИЙ ДЕТЕКТОР БИНГО ---
  useEffect(() => {
    if (!hostSession?.round.cards || playedTrackIds.size === 0) return;

    const condition = hostSession.round.winCondition;
    const linesIndices = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
                        [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],[0,6,12,18,24],[4,8,12,16,20]];

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

  // --- API ФУНКЦИИ ---
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

  const parseDeezerTracks = (data: any[]) => data.filter((t: any) => t.preview).map((t: any) => ({
    id: t.id, title: t.title, artist: t.artist.name, cover: t.album.cover_xl || t.album.cover_medium, preview: t.preview
  }));

  const loadTopChart = async () => {
    setIsSearching(true); setActiveFilter('Топ Чарт'); setSearchQuery('');
    try {
      const res = await fetch(`/api/deezer/chart/0/tracks?limit=50`);
      const data = await res.json();
      if (data.data) setSearchResults(parseDeezerTracks(data.data));
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };

  const searchDeezer = async (query: string, filterName?: string) => {
    if (!query) return;
    setIsSearching(true); setActiveFilter(filterName || '');
    try {
      const res = await fetch(`/api/deezer/search?q=${encodeURIComponent(query)}&limit=50`);
      const data = await res.json();
      if (data.data) setSearchResults(parseDeezerTracks(data.data));
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };

  // --- ОФЛАЙН КЭШИРОВАНИЕ И ПЛЕЕР ---
  const getCachedTrackUrl = async (url: string) => {
    try {
      const cache = await caches.open('muzbingo-audio-v1');
      const match = await cache.match(url);
      if (match) {
        const blob = await match.blob();
        return URL.createObjectURL(blob);
      }
    } catch (e) { }
    return url;
  };

  const cachePlaylistForOffline = async (playlist: Playlist) => {
    try {
      const cache = await caches.open('muzbingo-audio-v1');
      let count = 0;
      setOfflineProgress({ current: 0, total: playlist.tracks.length });

      for (const track of playlist.tracks) {
        if (!track.preview) continue;
        const match = await cache.match(track.preview);
        if (!match) {
          try { await cache.add(track.preview); } catch (e) { console.warn('Cache add error', track.preview); }
        }
        count++;
        setOfflineProgress({ current: count, total: playlist.tracks.length });
      }
      showToast('Плейлист загружен для офлайн игры!');
      setTimeout(() => setOfflineProgress(null), 2000);
    } catch (e) {
      showToast('Ошибка кэширования. Проверьте браузер.');
      setOfflineProgress(null);
    }
  };

  const togglePlay = async (track: Track) => {
    if (!track.preview) return showToast('Ошибка: у этого трека нет аудио!');

    if (playingTrackId === track.id) {
      audioRef.current?.pause();
      setPlayingTrackId(null);
      return;
    }

    audioRef.current?.pause();
    setPlayingTrackId(track.id);

    let audioUrl = track.preview.replace('http://', 'https://');

    // Обновление Deezer ссылки если протухла (Только если это не наш кастомный трек)
    if (!track.isCustom) {
      const expMatch = audioUrl.match(/exp=(\d+)/);
      if (expMatch && Date.now() + 300000 > parseInt(expMatch[1], 10) * 1000) {
        try {
          const res = await fetch(`/api/deezer/track/${track.id}`);
          const data = await res.json();
          if (data.preview) audioUrl = data.preview.replace('http://', 'https://');
        } catch (e) {}
      }
    }

    const finalUrl = await getCachedTrackUrl(audioUrl);

    if (audioRef.current) {
      audioRef.current.src = finalUrl;
      audioRef.current.play().catch(err => {
        console.error(err);
        showToast('Аудио заблокировано или удалено.');
        setPlayingTrackId(null);
      });
    }
  };

  // --- ЗАГРУЗКА СВОИХ MP3 ---
  const uploadCustomTracks = async (e: React.ChangeEvent<HTMLInputElement>, playlistId: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingMp3(true);
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    let newTracks =[...playlist.tracks];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop() || 'mp3';
      const safeName = `custom_${Date.now()}_${i}.${ext}`;

      try {
        const { data, error } = await supabase.storage.from('audio-tracks').upload(safeName, file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('audio-tracks').getPublicUrl(data.path);

        const newTrack: Track = {
          id: safeName,
          title: file.name.replace(`.${ext}`, ''),
          artist: 'Свой трек',
          cover: 'https://placehold.co/400x400/8b5cf6/ffffff?text=MP3',
          preview: urlData.publicUrl,
          isCustom: true
        };
        newTracks.push(newTrack);
      } catch (err: any) {
        showToast(`Ошибка загрузки ${file.name}: ${err.message}`);
      }
    }

    setPlaylists(playlists.map(p => p.id === playlistId ? { ...p, tracks: newTracks } : p));
    if (viewingPlaylist?.id === playlistId) setViewingPlaylist({ ...viewingPlaylist, tracks: newTracks });
    await supabase.from('playlists').update({ tracks: newTracks }).eq('id', playlistId);

    setIsUploadingMp3(false);
    showToast('Треки успешно добавлены!');
    e.target.value = '';
  };

  // --- БАЗА И ПЛЕЙЛИСТЫ ---
  const generateCards = async () => {
    if (!cardGeneratorSetup || !selectedTemplateId) return;
    const { game, round } = cardGeneratorSetup;
    const playlist = playlists.find(p => p.id === round.playlistId);
    if (!playlist || playlist.tracks.length < 24) return showToast('Ошибка: в плейлисте меньше 24 треков!');

    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    const newCards: BingoCard[] =[];
    const startId = 1000 + (round.cards?.length || 0) + 1;

    for (let i = 0; i < cardsCount; i++) {
      const shuffled = [...playlist.tracks].sort(() => Math.random() - 0.5);
      const cardTracks = shuffled.slice(0, 24);
      const cells: any[] =[...cardTracks.slice(0, 12), { isFreeSpace: true }, ...cardTracks.slice(12, 24)];
      newCards.push({ id: String(startId + i), cells });
    }

    const updatedRounds = game.rounds.map(r => r.id === round.id ? { ...r, cards:[...(r.cards || []), ...newCards] } : r);
    const updatedGame = { ...game, rounds: updatedRounds };
    setGames(games.map(g => g.id === game.id ? updatedGame : g));
    if (viewingGame?.id === game.id) setViewingGame(updatedGame);
    await supabase.from('games').update({ rounds: updatedRounds }).eq('id', game.id);
    setCardGeneratorSetup(null); setPrintViewCards({ cards: newCards, template });
  };

  const playHostTrack = (index: number) => {
    if (index < 0 || index >= shuffledTracks.length) return;
    setCurrentHostTrackIndex(index);
    const track = shuffledTracks[index];
    setPlayedTrackIds(prev => new Set(prev).add(track.id));
    togglePlay(track);
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setIsCreatePlaylistModalOpen(false);
    const { data } = await supabase.from('playlists').insert([{ name: newPlaylistName, tracks: [] }]).select();
    if (data) { setPlaylists([data[0], ...playlists]); showToast('Плейлист создан!'); }
    setNewPlaylistName('');
  };
  const deletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Удалить плейлист?')) {
      setPlaylists(playlists.filter(p => p.id !== id));
      if (viewingPlaylist?.id === id) setViewingPlaylist(null);
      await supabase.from('playlists').delete().eq('id', id);
    }
  };
  const removeTrackFromPlaylist = async (playlistId: string, trackId: string | number) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    const newTracks = playlist.tracks.filter(t => t.id !== trackId);
    setPlaylists(playlists.map(p => p.id === playlistId ? { ...p, tracks: newTracks } : p));
    if (viewingPlaylist?.id === playlistId) setViewingPlaylist({ ...viewingPlaylist, tracks: newTracks });
    await supabase.from('playlists').update({ tracks: newTracks }).eq('id', playlistId);
  };
  const deleteGame = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Удалить игру?')) {
      setGames(games.filter(g => g.id !== id));
      if (viewingGame?.id === id) setViewingGame(null);
      await supabase.from('games').delete().eq('id', id);
    }
  };

  // ================= РЕНДЕР ВКЛАДОК И ЭКРАНОВ =================

  // --- ЭКРАН ВЕДУЩЕГО ---
  if (hostSession) {
    const currentTrack = shuffledTracks[currentHostTrackIndex];
    const isPlaying = playingTrackId === currentTrack?.id;

    if (isProjectorMode) {
      return (
        <div className="fixed inset-0 bg-black text-white z-[100] flex flex-col items-center justify-center animate-in fade-in duration-500 group overflow-hidden">
          {autoWinners.length > 0 && (
            <div className="absolute top-10 flex items-center gap-4 bg-green-500 text-white px-10 py-4 rounded-full font-black text-4xl shadow-[0_0_80px_rgba(34,197,94,0.8)] z-[200] animate-bounce border-4 border-white">
              <PartyPopper size={40} /> БИНГО У КАРТОЧЕК: {autoWinners.join(', ')}!
            </div>
          )}

          <button onClick={() => setIsProjectorMode(false)} className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/30 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 cursor-pointer z-50">
            <Minimize size={32} />
          </button>

          {currentTrack && (
            <div className="flex flex-col items-center justify-center max-w-5xl w-full px-10 pb-28 h-full">
              <div className={`relative w-[45vh] h-[45vh] rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(168,85,247,0.2)] mb-8 transition-all duration-1000 ${isPlaying ? 'scale-105' : 'scale-100'}`}>
                <img src={currentTrack.cover} className={`w-full h-full object-cover transition-all duration-1000 ${hideTrackInfo ? 'blur-[50px] scale-125 brightness-50' : 'blur-0 scale-100'}`} alt="" />
              </div>
              <div className="text-center flex-shrink-0">
                <h1 className={`text-5xl md:text-7xl font-black mb-4 transition-all duration-500 ${hideTrackInfo ? 'text-gray-800 blur-sm' : 'text-white'}`}>{hideTrackInfo ? 'Угадай трек!' : currentTrack.title}</h1>
                <p className={`text-3xl md:text-4xl transition-all duration-500 ${hideTrackInfo ? 'text-gray-900 blur-sm' : 'text-purple-400 font-bold'}`}>{hideTrackInfo ? 'Исполнитель' : currentTrack.artist}</p>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-gray-950 text-white z-50 flex flex-col font-sans animate-in zoom-in-95 duration-300">
        {autoWinners.length > 0 && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-green-500 text-white px-8 py-3 rounded-full font-black text-2xl shadow-[0_0_50px_rgba(34,197,94,0.5)] z-[150] animate-bounce cursor-pointer hover:scale-105 transition" onClick={() => setAutoWinners([])} title="Кликни чтобы скрыть">
            <PartyPopper size={28} /> ЕСТЬ БИНГО: {autoWinners.join(', ')}!
          </div>
        )}

        <div className="h-20 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-8 shadow-xl relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg"><PartyPopper size={28} className="text-white" /></div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider">{hostSession.game.name}</h2>
              <p className="text-gray-400 text-sm font-medium">{hostSession.round.name} • Условие: {hostSession.round.winCondition === 'full' ? 'Бинго' : hostSession.round.winCondition === '2_lines' ? '2 Линии' : '1 Линия'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => setIsProjectorMode(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-lg"><MonitorPlay size={20} /> Проектор</button>
            <button onClick={() => setHostSession(null)} className="p-3 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition ml-2"><Power size={24} /></button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 p-10 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 to-gray-950">
            {currentTrack && (
              <div className="w-full max-w-2xl flex flex-col items-center">
                <div className={`relative w-80 h-80 rounded-3xl overflow-hidden shadow-2xl mb-8 transition-all duration-700 ${isPlaying ? 'scale-105 shadow-purple-900/50' : 'scale-100'}`}>
                  <img src={currentTrack.cover} alt="cover" className={`w-full h-full object-cover transition-all duration-500 ${hideTrackInfo ? 'blur-2xl scale-110 brightness-50' : 'blur-0 scale-100'}`} />
                </div>

                <div className="text-center mb-6 h-20">
                  <h1 className={`text-4xl font-black mb-2 transition-all ${hideTrackInfo ? 'text-gray-600 blur-sm' : 'text-white'}`}>{hideTrackInfo ? '???????? ???????' : currentTrack.title}</h1>
                  <p className={`text-xl transition-all ${hideTrackInfo ? 'text-gray-700 blur-sm' : 'text-purple-400 font-medium'}`}>{hideTrackInfo ? '?????????' : currentTrack.artist}</p>
                </div>

                <div className="w-full bg-gray-900/80 p-6 rounded-3xl backdrop-blur-md border border-gray-800 shadow-2xl flex flex-col gap-6">

                  <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
                    <span className="w-10 text-right">{formatTime(currentTime)}</span>
                    <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden relative">
                      <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-300 ease-linear" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
                    </div>
                    <span className="w-10">{formatTime(duration)}</span>
                  </div>

                  <div className="flex items-center justify-center gap-8 relative">
                    <label className="absolute left-0 flex items-center gap-2 cursor-pointer text-gray-400 hover:text-white transition bg-gray-800 px-4 py-2 rounded-xl text-sm font-bold">
                      <input type="checkbox" checked={isAutoPlay} onChange={e => setIsAutoPlay(e.target.checked)} className="accent-purple-500 w-4 h-4" />
                      Авто-переход
                    </label>

                    <button onClick={() => setHideTrackInfo(!hideTrackInfo)} className={`w-14 h-14 rounded-full flex items-center justify-center transition ${hideTrackInfo ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                      {hideTrackInfo ? <EyeOff size={24} /> : <Eye size={24} />}
                    </button>
                    <button onClick={() => playHostTrack(currentHostTrackIndex - 1)} disabled={currentHostTrackIndex === 0} className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center text-white hover:bg-gray-700 disabled:opacity-50"><SkipBack size={28} /></button>
                    <button onClick={() => playHostTrack(currentHostTrackIndex)} className={`w-24 h-24 rounded-full flex items-center justify-center text-white transition transform hover:scale-105 shadow-2xl ${isPlaying ? 'bg-orange-600' : 'bg-purple-600'}`}>
                      {isPlaying ? <PauseCircle size={48} /> : <Play size={48} className="ml-2" />}
                    </button>
                    <button onClick={() => { playHostTrack(currentHostTrackIndex + 1); setHideTrackInfo(true); }} disabled={currentHostTrackIndex === shuffledTracks.length - 1} className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center text-white hover:bg-gray-700 disabled:opacity-50"><SkipForward size={28} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-[450px] bg-gray-900 border-l border-gray-800 flex flex-col">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ListChecks className="text-purple-400" />
                <h3 className="text-lg font-bold">Очередь ({playedTrackIds.size}/{shuffledTracks.length})</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
              {shuffledTracks.map((track, index) => {
                const isPlayed = playedTrackIds.has(track.id);
                const isCurrent = currentHostTrackIndex === index;
                return (
                  <button key={track.id} onClick={() => { setCurrentHostTrackIndex(index); setHideTrackInfo(true); }} className={`w-full text-left p-3 rounded-xl flex items-center gap-4 transition border ${isCurrent ? 'bg-purple-900/30 border-purple-500 shadow-lg' : isPlayed ? 'bg-gray-900 border-gray-800 opacity-50 grayscale' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                    <div className="w-8 font-bold text-center text-sm text-gray-500">{index + 1}</div>
                    <img src={track.cover} className="w-10 h-10 rounded-lg object-cover" alt="" />
                    <div className="flex-1 overflow-hidden">
                      <div className={`font-bold truncate text-sm ${isCurrent ? 'text-purple-400' : 'text-white'}`}>{track.title}</div>
                      <div className="text-xs text-gray-500 truncate">{track.artist}</div>
                    </div>
                    {isCurrent && isPlaying && <Loader2 size={16} className="text-purple-400 animate-spin" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- ВКЛАДКА ПЛЕЙЛИСТОВ (С ЗАГРУЗКОЙ И ОФЛАЙНОМ) ---
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
                {isReadyForGame
                  ? <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium flex items-center gap-1"><CheckCircle2 size={16}/> Готов к генерации Бинго</span>
                  : <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">Для игры нужно минимум 24 трека (сейчас {currentPlaylist.tracks.length})</span>
                }
              </div>
            </div>

            <div className="flex gap-4">
              <label className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition shadow-lg">
                {isUploadingMp3 ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
                <span>Загрузить свои MP3</span>
                <input type="file" multiple accept="audio/mpeg, audio/mp3, audio/wav" className="hidden" onChange={(e) => uploadCustomTracks(e, currentPlaylist.id)} disabled={isUploadingMp3}/>
              </label>

              <button onClick={() => cachePlaylistForOffline(currentPlaylist)} disabled={currentPlaylist.tracks.length === 0} className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-50">
                <HardDriveDownload size={20} /> Офлайн Кэш
              </button>
            </div>
          </div>

          {offlineProgress && (
            <div className="mb-6 bg-blue-900/30 border border-blue-500/50 rounded-xl p-4 flex items-center justify-between">
              <div className="font-bold text-blue-400 flex items-center gap-2"><Loader2 className="animate-spin" size={20}/> Сохраняем в офлайн ({offlineProgress.current} из {offlineProgress.total})</div>
              <div className="w-1/2 bg-gray-900 rounded-full h-2 overflow-hidden"><div className="bg-blue-500 h-full transition-all" style={{width: `${(offlineProgress.current/offlineProgress.total)*100}%`}}/></div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-2 pb-10 custom-scrollbar">
            {currentPlaylist.tracks.length === 0 ? (
              <div className="text-center py-20 text-gray-500 bg-gray-900/50 rounded-2xl border border-dashed border-gray-800 flex flex-col items-center">
                <Music size={48} className="mb-4 opacity-50" />
                <p className="text-lg">Пусто. Загрузите свои MP3 или найдите треки в интернете.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="text-sm text-gray-500 mb-2 font-medium bg-gray-900 p-3 rounded-lg border border-gray-800">
                  <Timer size={16} className="inline mr-2 -mt-1"/> Подсказка: При генерации бланков алгоритм возьмёт случайные 24 трека из всех загруженных сюда.
                </div>
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
                      {track.isCustom && <span className="text-[10px] px-2 py-1 bg-purple-500/20 text-purple-400 rounded uppercase font-bold tracking-widest mr-4">Твой MP3</span>}
                      <button onClick={() => removeTrackFromPlaylist(currentPlaylist.id, track.id)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition opacity-0 group-hover:opacity-100"><Trash2 size={20} /></button>
                    </div>
                  )
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
        <p className="text-gray-400 mb-8">Создавайте папки с музыкой (по 60-80 треков), чтобы алгоритм собирал из них уникальные карточки.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div onClick={() => setIsCreatePlaylistModalOpen(true)} className="bg-gray-900/50 border-2 border-dashed border-gray-700 rounded-2xl h-56 flex flex-col items-center justify-center text-gray-400 hover:border-purple-500 hover:text-purple-400 transition cursor-pointer group"><FolderPlus size={40} className="mb-4" /><span className="font-bold text-lg">Новый плейлист</span></div>
          {playlists.map(playlist => (
            <div key={playlist.id} onClick={() => setViewingPlaylist(playlist)} className="bg-gray-900 border border-gray-800 rounded-2xl h-56 p-6 flex flex-col hover:border-gray-500 transition cursor-pointer relative group shadow-lg">
              <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-auto text-purple-400"><ListMusic size={24} /></div>
              <button onClick={(e) => deletePlaylist(playlist.id, e)} className="absolute top-4 right-4 p-2 text-gray-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
              <div><h3 className="font-bold text-xl mb-1 truncate">{playlist.name}</h3><p className={`text-sm ${playlist.tracks.length >= 24 ? 'text-green-400' : 'text-gray-500'}`}>{playlist.tracks.length} треков</p></div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white font-sans selection:bg-purple-500 overflow-hidden relative">

      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          setPlayingTrackId(null);
          if (hostSession && isAutoPlay) {
            if (currentHostTrackIndex < shuffledTracks.length - 1) {
              playHostTrack(currentHostTrackIndex + 1);
              setHideTrackInfo(true);
            }
          }
        }}
      />

      {toast && <div className="absolute top-6 right-6 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl font-bold flex items-center gap-3 z-[300] animate-in slide-in-from-top-4"><CheckCircle2 size={20} />{toast}</div>}

      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-10 flex-shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-gray-800/50">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg"><Music size={24} className="text-white" /></div>
          <span className="text-xl font-black tracking-wider uppercase">MuzBingo</span>
        </div>
        <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
          <button onClick={() => setActiveTab('games')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'games' ? 'bg-purple-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><PartyPopper size={20} /> Мероприятия</button>
          <div className="h-px bg-gray-800 my-2 mx-4" />
          <button onClick={() => setActiveTab('database')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'database' ? 'bg-purple-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><Database size={20} /> База из интернета</button>
          <button onClick={() => setActiveTab('playlists')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'playlists' ? 'bg-purple-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><ListMusic size={20} /> Мои Плейлисты</button>
        </nav>
      </aside>

      <main className="flex-1 overflow-hidden p-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-gray-950">
        {activeTab === 'games' && <div className="text-xl">Здесь ваш код вкладки Games (оставлен без изменений)</div>}
        {activeTab === 'playlists' && renderPlaylistsTab()}
        {activeTab === 'database' && <div className="text-xl">Здесь код вкладки Database (оставлен без изменений)</div>}
      </main>
    </div>
  );
}
