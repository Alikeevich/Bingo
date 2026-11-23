import { useState, useMemo, useEffect } from 'react';
import { Track, Tag } from '../../types';
import { MP3_ACCEPT } from '../../lib/r2Upload';
import { PlayCircle, PauseCircle, Plus, Trash2, Tags, Search, Edit3, UploadCloud, X } from 'lucide-react';

interface MyDatabaseTabProps {
  dbTracks: Track[];
  dbTags: Tag[];
  playingTrackId: string | number | null;
  isPaused: boolean;
  togglePlay: (track: Track) => void;
  setTrackToAdd: (track: Track) => void; // Добавляет в плейлист
  deleteTrackFromDb: (id: string | number) => void;
  deleteTagFromDb: (tag: Tag) => void;
  onUploadCustomFile: (file: File) => void; // Клик по загрузке файла
  onEditTrack: (track: Track) => void;       // Клик по редактированию
}

export default function MyDatabaseTab({
  dbTracks, dbTags, playingTrackId, isPaused, togglePlay, setTrackToAdd, deleteTrackFromDb, deleteTagFromDb, onUploadCustomFile, onEditTrack
}: MyDatabaseTabProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Показываем список порциями: в базе больше тысячи треков, и отрисовка их всех
  // разом вешала интерфейс (тысячи DOM-узлов с обложками).
  const PAGE = 60;
  const [visibleCount, setVisibleCount] = useState(PAGE);

  // Фильтруем треки по активному тегу и строке поиска
  const filteredTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dbTracks.filter(t => {
      const matchesTag = activeTag ? (t.tags || []).includes(activeTag) : true;
      if (!matchesTag) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
    });
  }, [dbTracks, activeTag, searchQuery]);

  // При смене фильтра начинаем показ заново
  useEffect(() => { setVisibleCount(PAGE); }, [activeTag, searchQuery]);

  const visibleTracks = filteredTracks.slice(0, visibleCount);
  const hasMore = filteredTracks.length > visibleCount;

  return (
    <div className="flex flex-col h-full text-pult-text">
      <header className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-2xl font-medium">Моя база</h1>
          <p className="mt-1 text-sm text-pult-text2">
            <span className="font-mono tabular-nums">{dbTracks.length}</span> сохранённых песен — из них собираются плейлисты
          </p>
        </div>
        <label className="h-9 px-4 rounded-lg text-sm font-medium inline-flex items-center gap-2 bg-lime text-[#141415] hover:bg-[#d4ff63] cursor-pointer transition-colors shrink-0">
          <UploadCloud size={16} /> Загрузить свой MP3
          <input
            type="file"
            accept={MP3_ACCEPT}
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onUploadCustomFile(file);
              e.target.value = ''; // сброс инпута
            }}
          />
        </label>
      </header>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pult-muted" size={14} />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Песня или исполнитель"
          className="h-9 w-full rounded-lg bg-pult-raised border border-white/[0.06] pl-8 pr-3 text-sm text-pult-text placeholder:text-pult-muted focus:outline-none focus:border-lime/60" />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button onClick={() => setActiveTag(null)} className={`h-8 px-3 rounded-lg text-sm transition-colors ${activeTag === null ? 'bg-pult-raised text-pult-text border border-white/[0.1]' : 'text-pult-text2 hover:bg-white/[0.04]'}`}>
          Все
        </button>
        {dbTags.map(tag => (
          <div key={tag.id} className={`group/tag h-8 inline-flex items-center gap-2 pl-3 pr-1 rounded-lg text-sm transition-colors ${activeTag === tag.name ? 'bg-pult-raised text-pult-text border border-white/[0.1]' : 'text-pult-text2 hover:bg-white/[0.04]'}`}>
            <button onClick={() => setActiveTag(tag.name)} className="inline-flex items-center gap-2 outline-none">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color || '#85858b' }} />
              {tag.name}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (activeTag === tag.name) setActiveTag(null);
                deleteTagFromDb(tag);
              }}
              title="Удалить тег"
              className="p-1 rounded-md text-pult-muted opacity-0 group-hover/tag:opacity-100 hover:text-red-400 hover:bg-white/[0.06] transition-[opacity,color]">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-10">
        {dbTracks.length === 0 ? (
          <div className="py-16 text-center text-pult-text2 rounded-xl border border-dashed border-white/[0.08]">
            <Tags size={28} className="mx-auto mb-3 text-pult-muted" />
            <p>База пуста</p>
            <p className="mt-1 text-sm text-pult-muted">Загрузи свои MP3 или найди песни в поиске</p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="py-10 text-center text-sm text-pult-muted">Ничего не найдено</div>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-pult-card p-1.5 flex flex-col gap-0.5">
            {visibleTracks.map(track => {
              const isPlaying = playingTrackId === track.id && !isPaused;
              return (
                <div key={track.id} className={`group grid grid-cols-[40px_1fr_220px_auto] items-center gap-3 h-14 px-2.5 rounded-lg transition-colors ${isPlaying ? 'bg-pult-raised' : 'hover:bg-white/[0.03]'}`}>
                  <button className="relative w-10 h-10 rounded-md overflow-hidden bg-pult-raised" onClick={() => togglePlay(track)} title="Послушать">
                    {track.cover && <img src={track.cover} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    <span className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{isPlaying ? <PauseCircle size={20} className="text-white" /> : <PlayCircle size={20} className="text-white" />}</span>
                  </button>
                  <div className="min-w-0">
                    <p className={`truncate text-sm ${isPlaying ? 'text-lime' : 'text-pult-text'}`}>{track.title}</p>
                    <p className="truncate text-sm text-pult-text2">{track.artist}</p>
                  </div>
                  <div className="min-w-0 flex items-center gap-1.5 text-xs text-pult-muted">
                    {(track.mp3Path || track.isCustom) && <span className="shrink-0">свой MP3 ·</span>}
                    <span className="truncate">{(track.tags || []).join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setTrackToAdd(track)} className="p-1.5 rounded-md text-pult-text2 hover:text-pult-text hover:bg-white/[0.06] transition-colors" title="Добавить в плейлист"><Plus size={16} /></button>
                    <button onClick={() => onEditTrack(track)} className="p-1.5 rounded-md text-pult-text2 hover:text-pult-text hover:bg-white/[0.06] transition-colors" title="Редактировать"><Edit3 size={16} /></button>
                    <button onClick={() => deleteTrackFromDb(track.id)} className="p-1.5 rounded-md text-pult-muted hover:text-red-400 hover:bg-white/[0.06] transition-colors" title="Удалить из базы"><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="flex flex-col items-center gap-2 py-8">
            <button
              onClick={() => setVisibleCount(c => c + PAGE)}
              className="h-9 px-4 rounded-lg text-sm bg-pult-raised border border-white/[0.06] hover:bg-[#2b2b2e] transition-colors"
            >
              Показать ещё {Math.min(PAGE, filteredTracks.length - visibleCount)}
            </button>
            <span className="text-xs text-pult-muted">
              показано <span className="font-mono tabular-nums">{visibleTracks.length}</span> из <span className="font-mono tabular-nums">{filteredTracks.length}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}