import { useState, useEffect } from 'react';
import { Search, Loader2, PauseCircle, PlayCircle, Plus, Flame } from 'lucide-react';
import { Track } from '../../types';

interface GlobalSearchTabProps {
  playingTrackId: string | number | null;
  togglePlay: (track: Track) => void;
  setTrackToAdd: (track: Track) => void;
}

export default function GlobalSearchTab({ playingTrackId, togglePlay, setTrackToAdd }: GlobalSearchTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const[searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Топ Чарт');

  useEffect(() => {
    loadTopChart();
  }, []);

  const parseDeezerTracks = (data: any[]) =>
    data.filter((t: any) => t.preview).map((t: any) => ({
      id: t.id, title: t.title, artist: t.artist.name,
      cover: t.album.cover_xl || t.album.cover_medium,
      preview: t.preview, isCustom: false,
    }));

  const loadTopChart = async () => {
    setIsSearching(true); setActiveFilter('Топ Чарт'); setSearchQuery('');
    try {
      const res = await fetch('/api/deezer/chart/0/tracks?limit=50');
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

  const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); searchDeezer(searchQuery); };

  return (
    <div className="animate-in fade-in duration-300 flex flex-col h-full">
      <h1 className="text-3xl font-bold mb-2">Глобальный поиск (API)</h1>
      <p className="text-gray-400 mb-6">Ищите треки через API Deezer для добавления в свою базу</p>
      
      <form onSubmit={handleSearchSubmit} className="flex gap-4 mb-4">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} /><input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Исполнитель, трек или жанр..." className="w-full bg-gray-900 border border-gray-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-purple-500 transition" /></div>
        <button type="submit" disabled={isSearching} className="bg-purple-600 hover:bg-purple-500 px-8 rounded-xl font-bold transition disabled:opacity-50 min-w-[120px] flex items-center justify-center">{isSearching ? <Loader2 className="animate-spin" size={20} /> : 'Найти'}</button>
      </form>
      <div className="flex flex-wrap gap-2 mb-8">
        <button onClick={loadTopChart} className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition ${activeFilter === 'Топ Чарт' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}><Flame size={16} /> Топ Чарт</button>
        {['Русские хиты', 'Поп', 'Рок', 'Хип-Хоп', 'Дискотека 80х'].map(f => (
          <button key={f} onClick={() => { setSearchQuery(f); searchDeezer(f, f); }} className={`px-4 py-2 rounded-full font-medium transition ${activeFilter === f ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{f}</button>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
        {isSearching && searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500"><Loader2 className="animate-spin mb-4" size={32} /><p>Ищем музыку...</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
        )}
      </div>
    </div>
  );
}