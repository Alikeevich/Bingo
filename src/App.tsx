import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { Music, ListMusic, LayoutTemplate, PartyPopper, CheckCircle2, Globe, Database } from 'lucide-react';
import { Track, Playlist, Game, Round, Template, BingoCard } from './types';

// Компоненты-вкладки
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

  // Глобальные данные БД
  const[playlists, setPlaylists] = useState<Playlist[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  // Плеер
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const[playingTrackId, setPlayingTrackId] = useState<string | number | null>(null);
  const[currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const[isAutoPlay, setIsAutoPlay] = useState(false);

  // Сессия ведущего
  const [hostSession, setHostSession] = useState<{ game: Game; round: Round; playlist: Playlist } | null>(null);
  const[shuffledTracks, setShuffledTracks] = useState<Track[]>([]);
  const[playedTrackIds, setPlayedTrackIds] = useState<Set<string | number>>(new Set());
  const[currentHostTrackIndex, setCurrentHostTrackIndex] = useState<number>(0);
  const[hideTrackInfo, setHideTrackInfo] = useState(true);
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [autoWinners, setAutoWinners] = useState<string[]>([]);

  // Экраны и попапы
  const [printViewCards, setPrintViewCards] = useState<{ cards: BingoCard[]; template: Template } | null>(null);
  const [trackToAdd, setTrackToAdd] = useState<Track | null>(null); // Для модалки "Добавить в плейлист"
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaylists();
    fetchGames();
    fetchTemplates();

    const savedSessionStr = localStorage.getItem('muzbingo_host_session');
    if (savedSessionStr) {
      try {
        const parsed = JSON.parse(savedSessionStr);
        if (parsed?.hostSession) {
          setHostSession(parsed.hostSession);
          setShuffledTracks(parsed.shuffledTracks || []);
          setPlayedTrackIds(new Set(parsed.playedTrackIds ||[]));
          setCurrentHostTrackIndex(parsed.currentHostTrackIndex || 0);
          setHideTrackInfo(parsed.hideTrackInfo ?? true);
          showToast('Игра восстановлена после обновления страницы!');
        }
      } catch (e) { localStorage.removeItem('muzbingo_host_session'); }
    }
  },[]);

  useEffect(() => {
    if (hostSession) {
      localStorage.setItem('muzbingo_host_session', JSON.stringify({
        hostSession, shuffledTracks, playedTrackIds: Array.from(playedTrackIds), currentHostTrackIndex, hideTrackInfo,
      }));
    } else {
      localStorage.removeItem('muzbingo_host_session');
    }
  },[hostSession, shuffledTracks, playedTrackIds, currentHostTrackIndex, hideTrackInfo]);

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
    if (data) setTemplates(data);
  };

  const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(null), 3000); };

  const togglePlay = async (track: Track) => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (playingTrackId === track.id) {
      audioEl.paused ? audioEl.play() : audioEl.pause();
      if (!audioEl.paused) setPlayingTrackId(track.id);
      else setPlayingTrackId(null);
      return;
    }
    audioEl.pause();
    setPlayingTrackId(track.id);
    try {
      let currentUrl = track.preview;
      if (track.isCustom) {
        const { data } = supabase.storage.from('audio-tracks').getPublicUrl(String(track.id));
        currentUrl = data.publicUrl;
      } else {
        const isExpired = currentUrl.includes('exp=') && Date.now() / 1000 > parseInt(currentUrl.match(/exp=(\d+)/)?.[1] || '0');
        if (isExpired) {
          const res = await fetch(`/api/deezer/track/${track.id}`);
          const data = await res.json();
          if (data.preview) currentUrl = data.preview;
        }
      }
      audioEl.src = currentUrl.includes('?') ? `${currentUrl}&t=${Date.now()}` : `${currentUrl}?t=${Date.now()}`;
      audioEl.load();
      audioEl.play().catch(err => { console.error(err); setPlayingTrackId(null); });
    } catch (err) { console.error(err); setPlayingTrackId(null); }
  };

  const startHostSession = (game: Game, round: Round) => {
    const playlist = playlists.find(p => p.id === round.playlistId);
    if (!playlist) return showToast('Плейлист не найден!');
    setShuffledTracks([...playlist.tracks].sort(() => Math.random() - 0.5));
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
    if (playedTrackIds.size > 0 && confirm('Перемешать оставшиеся треки?')) {
      const unplayed = shuffledTracks.filter(t => !playedTrackIds.has(t.id));
      const played = shuffledTracks.filter(t => playedTrackIds.has(t.id));
      setShuffledTracks([...played, ...unplayed.sort(() => Math.random() - 0.5)]);
    } else if (playedTrackIds.size === 0) {
      setShuffledTracks([...shuffledTracks].sort(() => Math.random() - 0.5));
    }
  };

  const endHostSession = () => { if (confirm('Точно завершить тур?')) setHostSession(null); };

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

  if (printViewCards) return <PrintView printViewCards={printViewCards} setPrintViewCards={setPrintViewCards} />;

  if (hostSession) {
    if (isProjectorMode) {
      return (
        <>
          <audio ref={audioRef} preload="auto" crossOrigin="anonymous" {...audioHandlers} />
          <Projector 
            currentTrack={shuffledTracks[currentHostTrackIndex]} 
            hideTrackInfo={hideTrackInfo} 
            autoWinners={autoWinners} 
            setIsProjectorMode={setIsProjectorMode} 
            setHideTrackInfo={setHideTrackInfo} 
          />
        </>
      );
    }
    return (
      <>
        <audio ref={audioRef} preload="auto" crossOrigin="anonymous" {...audioHandlers} />
        <HostScreen 
          hostSession={hostSession} shuffledTracks={shuffledTracks} playedTrackIds={playedTrackIds}
          currentHostTrackIndex={currentHostTrackIndex} hideTrackInfo={hideTrackInfo} autoWinners={autoWinners}
          playingTrackId={playingTrackId} currentTime={currentTime} duration={duration} isAutoPlay={isAutoPlay}
          setIsAutoPlay={setIsAutoPlay} setHideTrackInfo={setHideTrackInfo} setIsProjectorMode={setIsProjectorMode}
          playHostTrack={playHostTrack} endHostSession={endHostSession} reshuffleTracks={reshuffleTracks}
          setAutoWinners={setAutoWinners} togglePlay={togglePlay} audioRef={audioRef}
        />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white font-sans selection:bg-purple-500 overflow-hidden relative">
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" {...audioHandlers} />

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
        {activeTab === 'mydatabase' && <MyDatabaseTab />}
        {activeTab === 'global_search' && <GlobalSearchTab playingTrackId={playingTrackId} togglePlay={togglePlay} setTrackToAdd={setTrackToAdd} />}
        {activeTab === 'playlists' && <PlaylistsTab playlists={playlists} setPlaylists={setPlaylists} playingTrackId={playingTrackId} togglePlay={togglePlay} showToast={showToast} />}
        {activeTab === 'templates' && <TemplatesTab templates={templates} setTemplates={setTemplates} showToast={showToast} />}
      </main>

      {/* Модалка добавления трека в плейлист (Глобальная) */}
      {trackToAdd && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">Добавить в плейлист</h3><button onClick={() => setTrackToAdd(null)} className="text-gray-400">Закрыть</button></div>
            <div className="flex items-center gap-4 mb-6 p-4 bg-gray-950 rounded-xl"><img src={trackToAdd.cover} className="w-12 h-12 rounded-md" alt="" /><div className="overflow-hidden"><p className="font-bold truncate">{trackToAdd.title}</p><p className="text-sm text-gray-400">{trackToAdd.artist}</p></div></div>
            {playlists.length === 0 ? (
               <div className="text-center py-6">Нет плейлистов. Создайте их во вкладке "Плейлисты".</div>
            ) : (
              <div className="max-h-60 overflow-y-auto pr-2 flex flex-col gap-2">{playlists.map(p => { 
                const isAdded = p.tracks.some(
                  t => t.id === trackToAdd.id || t.artist.toLowerCase() === trackToAdd.artist.toLowerCase()
                ); 
                return (
                  <button key={p.id} onClick={async () => {
                    if (isAdded) return;
                    const newTracks = [...p.tracks, trackToAdd];
                    setPlaylists(playlists.map(pl => pl.id === p.id ? { ...pl, tracks: newTracks } : pl));
                    await supabase.from('playlists').update({ tracks: newTracks }).eq('id', p.id);
                    showToast('Трек добавлен!');
                    setTrackToAdd(null);
                  }} disabled={isAdded} className={`flex justify-between p-4 rounded-xl border text-left ${isAdded ? 'bg-gray-800/50 border-gray-800 opacity-50' : 'bg-gray-800 hover:border-purple-500'}`}>
                    <span className="font-bold truncate pr-4">{p.name}</span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {p.tracks.some(t => t.id === trackToAdd.id)
                        ? 'Уже добавлен'
                        : p.tracks.some(t => t.artist.toLowerCase() === trackToAdd.artist.toLowerCase())
                          ? `Исполнитель есть`
                          : `${p.tracks.length} треков`}
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