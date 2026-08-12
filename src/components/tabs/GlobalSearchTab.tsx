import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, PauseCircle, PlayCircle, Flame, ChevronLeft, Database, ListMusic } from 'lucide-react';
import { Track } from '../../types';

// Пресеты: чарт (RSS Apple) или поисковый запрос (iTunes Search)
const FILTERS: { name: string; kind: 'chart' | 'search'; query?: string; genre?: string }[] = [
  { name: 'Топ Чарт',      kind: 'chart'  },
  { name: 'Поп',           kind: 'search', query: 'pop hits' },
  { name: 'Рок',           kind: 'search', query: 'rock hits' },
  { name: 'Хип-Хоп',       kind: 'search', query: 'hip hop rap' },
  { name: 'Электронная',   kind: 'search', query: 'electronic dance' },
  { name: 'Русские хиты',  kind: 'search', query: 'русские хиты' },
  { name: 'Казахские хиты',kind: 'search', query: 'qazaq hits' },
  { name: 'Дискотека 80х', kind: 'search', query: 'disco 80s' },
];

const PAGE = 50;
// Поиск — по стору US: там полный западный каталог И рус/каз артисты (в kz-сторе
// западное урезано лицензиями). Чарт — по kz (локальный топ). lookup по id — глобально.
const COUNTRY_SEARCH = 'us';
const COUNTRY_CHART = 'kz';

interface GlobalSearchTabProps {
  playingTrackId: string | number | null;
  isPaused: boolean;
  togglePlay: (track: Track) => void;
  setTrackToAddToDb: (track: Track) => void;
  setTrackToAdd: (track: Track) => void;
}

// Обложку 100x100 апскейлим до 600x600
const bigCover = (url: string) => (url || '').replace(/\/\d+x\d+bb\./, '/600x600bb.');

// iTunes Search result → Track
const parseITunes = (results: any[]): Track[] =>
  results
    .filter((t) => t.previewUrl && t.trackName)
    .map((t) => ({
      id: t.trackId,
      title: t.trackName,
      artist: t.artistName,
      cover: bigCover(t.artworkUrl100 || t.artworkUrl60 || ''),
      preview: t.previewUrl,
      isCustom: false,
    }));

export default function GlobalSearchTab({ playingTrackId, isPaused, togglePlay, setTrackToAddToDb, setTrackToAdd }: GlobalSearchTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [allResults, setAllResults] = useState<Track[]>([]); // весь набор (iTunes не даёт offset — грузим много и листаем на клиенте)
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Топ Чарт');
  const [page, setPage] = useState(0);
  const reqIdRef = useRef(0);

  useEffect(() => {
    loadChart('Топ Чарт');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Топ-чарт: RSS Apple (название+артист+id) → lookup по id (там уже previewUrl)
  const loadChart = async (filterName: string) => {
    const rid = ++reqIdRef.current;
    setIsSearching(true); setActiveFilter(filterName); setSearchQuery(''); setPage(0);
    try {
      const rssRes = await fetch(`/api/itunes/${COUNTRY_CHART}/rss/topsongs/limit=100/json`);
      const rss = await rssRes.json();
      const entriesRaw = rss?.feed?.entry;
      const entries = Array.isArray(entriesRaw) ? entriesRaw : entriesRaw ? [entriesRaw] : [];
      const ids = entries.map((e: any) => e?.id?.attributes?.['im:id']).filter(Boolean);
      if (ids.length === 0) { if (rid === reqIdRef.current) setAllResults([]); return; }
      const lookupRes = await fetch(`/api/itunes/lookup?id=${ids.join(',')}&country=${COUNTRY_CHART}&entity=song`);
      const lookup = await lookupRes.json();
      const tracks = parseITunes((lookup.results || []).filter((r: any) => r.wrapperType === 'track'));
      if (rid === reqIdRef.current) setAllResults(tracks);
    } catch (e) { console.error(e); if (rid === reqIdRef.current) setAllResults([]); }
    finally { if (rid === reqIdRef.current) setIsSearching(false); }
  };

  const searchITunes = async (query: string, filterName = '') => {
    if (!query.trim()) return;
    const rid = ++reqIdRef.current;
    setIsSearching(true); setActiveFilter(filterName); setPage(0);
    try {
      const res = await fetch(`/api/itunes/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=200&country=${COUNTRY_SEARCH}`);
      const data = await res.json();
      if (rid === reqIdRef.current) setAllResults(parseITunes(data.results || []));
    } catch (e) { console.error(e); if (rid === reqIdRef.current) setAllResults([]); }
    finally { if (rid === reqIdRef.current) setIsSearching(false); }
  };

  const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); searchITunes(searchQuery); };

  const pageItems = allResults.slice(page * PAGE, page * PAGE + PAGE);
  const hasNext = allResults.length > (page + 1) * PAGE;
  const goToPage = (p: number) => {
    setPage(p);
    document.querySelector('.custom-scrollbar')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="animate-in fade-in duration-300 flex flex-col h-full">
      <h1 className="text-3xl font-bold mb-2">Глобальный поиск (iTunes)</h1>
      <p className="text-gray-400 mb-6">Ищите музыку для плейлистов или сохраняйте её в свою Базу с тегами.</p>

      <form onSubmit={handleSearchSubmit} className="flex gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Исполнитель, трек или жанр..." className="w-full bg-gray-900 border border-gray-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-purple-500 transition" />
        </div>
        <button type="submit" disabled={isSearching} className="bg-purple-600 hover:bg-purple-500 px-8 rounded-xl font-bold transition disabled:opacity-50 min-w-[120px] flex items-center justify-center">
          {isSearching ? <Loader2 className="animate-spin" size={20} /> : 'Найти'}
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mb-8">
        {FILTERS.map(f => (
          <button key={f.name} onClick={() => { if (f.kind === 'chart') loadChart(f.name); else { setSearchQuery(f.query!); searchITunes(f.query!, f.name); } }} className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition ${activeFilter === f.name ? f.name === 'Топ Чарт' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' : 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {f.name === 'Топ Чарт' && <Flame size={16} />}{f.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
        {isSearching && allResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500"><Loader2 className="animate-spin mb-4" size={32} /><p>Ищем музыку...</p></div>
        ) : allResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500"><p>Ничего не найдено. Попробуй другой запрос.</p></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              {pageItems.map(track => {
                const isPlaying = playingTrackId === track.id && !isPaused;
                return (
                  <div key={track.id} className={`bg-gray-900 p-3 rounded-xl flex gap-3 items-center border transition group ${isPlaying ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'border-gray-800 hover:border-gray-600'}`}>
                    <div className="relative w-14 h-14 rounded-md overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => togglePlay(track)}>
                      <img src={track.cover} alt="cover" className={`w-full h-full object-cover transition-transform ${isPlaying ? 'scale-110 blur-[2px]' : ''}`} />
                      <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{isPlaying ? <PauseCircle size={28} className="text-purple-400" /> : <PlayCircle size={28} className="text-white" />}</div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className={`font-bold truncate text-sm ${isPlaying ? 'text-purple-400' : 'text-white'}`}>{track.title}</h4>
                      <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => setTrackToAdd(track)} className="p-2 bg-gray-800 rounded-lg hover:bg-purple-600 transition text-gray-400 hover:text-white" title="Сразу в плейлист"><ListMusic size={18} /></button>
                      <button onClick={() => setTrackToAddToDb(track)} className="p-2 bg-gray-800 rounded-lg hover:bg-purple-600 transition text-gray-400 hover:text-white" title="Сохранить в Мою Базу"><Database size={18} /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {allResults.length > PAGE && (
              <div className="flex items-center justify-between border-t border-gray-800 pt-6 pb-2 mt-2">
                <button onClick={() => goToPage(page - 1)} disabled={page === 0} className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={18} /> Назад</button>
                <div className="text-center"><span className="text-white font-bold">Страница {page + 1}</span><div className="text-gray-500 text-xs mt-0.5">треки {page * PAGE + 1}–{page * PAGE + pageItems.length} из {allResults.length}</div></div>
                <button onClick={() => goToPage(page + 1)} disabled={!hasNext} className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold transition disabled:opacity-30 disabled:cursor-not-allowed">Вперёд <ChevronLeft size={18} className="rotate-180" /></button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
