import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, PauseCircle, PlayCircle, ChevronLeft, Database, ListMusic } from 'lucide-react';
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
    <div className="flex flex-col h-full text-pult-text">
      <header className="mb-5">
        <h1 className="text-2xl font-medium">Поиск песен</h1>
        <p className="mt-1 text-sm text-pult-text2">Каталог iTunes: найди песню и сразу добавь в плейлист или сохрани в базу с тегами</p>
      </header>

      <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-3 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pult-muted" size={14} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Исполнитель, песня или жанр"
            className="h-10 w-full rounded-lg bg-pult-raised border border-white/[0.06] pl-8 pr-3 text-sm text-pult-text placeholder:text-pult-muted focus:outline-none focus:border-lime/60" />
        </div>
        <button type="submit" disabled={isSearching} className="h-10 px-5 rounded-lg text-sm font-medium bg-lime text-[#141415] hover:bg-[#d4ff63] transition-colors disabled:opacity-50 inline-flex items-center justify-center min-w-[88px]">
          {isSearching ? <Loader2 className="animate-spin" size={16} /> : 'Найти'}
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map(f => (
          <button key={f.name} onClick={() => { if (f.kind === 'chart') loadChart(f.name); else { setSearchQuery(f.query!); searchITunes(f.query!, f.name); } }}
            className={`h-8 px-3 rounded-lg text-sm transition-colors ${activeFilter === f.name ? 'bg-pult-raised text-pult-text border border-white/[0.1]' : 'text-pult-text2 hover:bg-white/[0.04]'}`}>
            {f.name === 'Топ Чарт' ? 'Топ-чарт Казахстана' : f.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-10">
        {isSearching && allResults.length === 0 ? (
          <div className="flex items-center justify-center gap-2 h-40 text-sm text-pult-muted"><Loader2 className="animate-spin" size={16} /> Ищем</div>
        ) : allResults.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-pult-muted">Ничего не найдено — попробуй другой запрос</div>
        ) : (
          <>
            <div className="rounded-xl border border-white/[0.08] bg-pult-card p-1.5 flex flex-col gap-0.5 mb-4">
              {pageItems.map(track => {
                const isPlaying = playingTrackId === track.id && !isPaused;
                return (
                  <div key={track.id} className={`group grid grid-cols-[40px_1fr_auto] items-center gap-3 h-14 px-2.5 rounded-lg transition-colors ${isPlaying ? 'bg-pult-raised' : 'hover:bg-white/[0.03]'}`}>
                    <button className="relative w-10 h-10 rounded-md overflow-hidden bg-pult-raised" onClick={() => togglePlay(track)} title="Послушать">
                      {track.cover && <img src={track.cover} alt="" className="w-full h-full object-cover" loading="lazy" />}
                      <span className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{isPlaying ? <PauseCircle size={20} className="text-white" /> : <PlayCircle size={20} className="text-white" />}</span>
                    </button>
                    <div className="min-w-0">
                      <p className={`truncate text-sm ${isPlaying ? 'text-lime' : 'text-pult-text'}`}>{track.title}</p>
                      <p className="truncate text-sm text-pult-text2">{track.artist}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setTrackToAdd(track)} className="h-8 px-2.5 rounded-md text-sm inline-flex items-center gap-1.5 text-pult-text2 hover:text-pult-text hover:bg-white/[0.06] transition-colors" title="Сразу в плейлист"><ListMusic size={16} /> В плейлист</button>
                      <button onClick={() => setTrackToAddToDb(track)} className="h-8 px-2.5 rounded-md text-sm inline-flex items-center gap-1.5 text-pult-text2 hover:text-pult-text hover:bg-white/[0.06] transition-colors" title="Сохранить в Мою базу"><Database size={16} /> В базу</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {allResults.length > PAGE && (
              <div className="flex items-center justify-between">
                <button onClick={() => goToPage(page - 1)} disabled={page === 0} className="h-9 px-3 rounded-lg text-sm inline-flex items-center gap-1.5 bg-pult-raised border border-white/[0.06] hover:bg-[#2b2b2e] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={16} /> Назад</button>
                <span className="font-mono text-sm tabular-nums text-pult-muted">{page * PAGE + 1}–{page * PAGE + pageItems.length} из {allResults.length}</span>
                <button onClick={() => goToPage(page + 1)} disabled={!hasNext} className="h-9 px-3 rounded-lg text-sm inline-flex items-center gap-1.5 bg-pult-raised border border-white/[0.06] hover:bg-[#2b2b2e] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">Вперёд <ChevronLeft size={16} className="rotate-180" /></button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
