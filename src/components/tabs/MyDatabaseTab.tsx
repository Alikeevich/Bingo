import { useState } from 'react';
import { Track, Tag } from '../../types';
import { PlayCircle, PauseCircle, Plus, Trash2, Tags, Search, Edit3, UploadCloud, X } from 'lucide-react';

interface MyDatabaseTabProps {
  dbTracks: Track[];
  dbTags: Tag[];
  playingTrackId: string | number | null;
  togglePlay: (track: Track) => void;
  setTrackToAdd: (track: Track) => void; // Добавляет в плейлист
  deleteTrackFromDb: (id: string | number) => void;
  deleteTagFromDb: (tag: Tag) => void;
  onUploadCustomFile: (file: File) => void; // Клик по загрузке файла
  onEditTrack: (track: Track) => void;       // Клик по редактированию
}

export default function MyDatabaseTab({
  dbTracks, dbTags, playingTrackId, togglePlay, setTrackToAdd, deleteTrackFromDb, deleteTagFromDb, onUploadCustomFile, onEditTrack
}: MyDatabaseTabProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Фильтруем треки по активному тегу и строке поиска
  const filteredTracks = dbTracks.filter(t => {
    const matchesTag = activeTag ? (t.tags || []).includes(activeTag) : true;
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.artist.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTag && matchesSearch;
  });

  return (
    <div className="animate-in fade-in duration-300 flex flex-col h-full">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Моя База Музыки</h1>
          <p className="text-gray-400">Сохранённые вами треки. Выбирайте их для создания плейлистов.</p>
        </div>
        
        {/* КНОПКА ЗАГРУЗКИ MP3 И СЧЕТЧИК */}
        <div className="flex items-center gap-4">
          <label className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition shadow-lg shrink-0">
            <UploadCloud size={20} />
            <span>Загрузить свой MP3</span>
            <input 
              type="file" 
              accept="audio/mpeg,audio/mp3,audio/wav" 
              className="hidden" 
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) onUploadCustomFile(file);
                e.target.value = ''; // сброс инпута
              }} 
            />
          </label>
          <div className="text-right shrink-0">
            <div className="text-2xl font-black text-purple-400">{dbTracks.length}</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Всего треков</div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по моей базе..." className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-purple-500 transition" />
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-800 pb-6">
        <button onClick={() => setActiveTag(null)} className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition ${activeTag === null ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
          Все треки
        </button>
        {dbTags.map(tag => (
          <div key={tag.id} className={`group/tag flex items-center gap-2 pl-4 pr-1 py-2 rounded-full font-medium transition ${activeTag === tag.name ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            <button onClick={() => setActiveTag(tag.name)} className="flex items-center gap-2 outline-none">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#8b5cf6' }} />
              {tag.name}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (activeTag === tag.name) setActiveTag(null);
                deleteTagFromDb(tag);
              }}
              title="Удалить тег"
              className="ml-1 p-1 rounded-full opacity-0 group-hover/tag:opacity-100 hover:bg-red-500/30 hover:text-red-200 transition">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
        {dbTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-gray-900/30 rounded-3xl border border-dashed border-gray-800">
            <Tags size={48} className="mb-4 opacity-30" />
            <p className="text-lg font-medium">Ваша база пуста</p>
            <p className="text-sm">Загрузите свои MP3 файлы или найдите треки через Глобальный Поиск.</p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="text-center py-10 text-gray-500">По вашему запросу ничего не найдено.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTracks.map(track => {
              const isPlaying = playingTrackId === track.id;
              return (
                <div key={track.id} className={`bg-gray-900 p-3 rounded-xl flex gap-3 items-center border transition group ${isPlaying ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'border-gray-800 hover:border-gray-600'}`}>
                  <div className="relative w-14 h-14 rounded-md overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => togglePlay(track)}>
                    <img src={track.cover} alt="cover" className={`w-full h-full object-cover transition-transform ${isPlaying ? 'scale-110 blur-[2px]' : ''}`} />
                    <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{isPlaying ? <PauseCircle size={28} className="text-purple-400" /> : <PlayCircle size={28} className="text-white" />}</div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h4 className={`font-bold truncate text-sm ${isPlaying ? 'text-purple-400' : 'text-white'}`}>{track.title}</h4>
                    <p className="text-xs text-gray-400 truncate mb-1">{track.artist}</p>
                    <div className="flex flex-wrap gap-1">
                      {track.isCustom && <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1 rounded uppercase font-bold tracking-wider">MP3</span>}
                      {track.tags?.slice(0, 1).map((t, i) => (
                        <span key={i} className="text-[9px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded truncate max-w-[60px]">{t}</span>
                      ))}
                      {(track.tags?.length || 0) > 1 && <span className="text-[9px] bg-gray-800 text-gray-500 px-1 rounded">+{track.tags!.length - 1}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setTrackToAdd(track)} className="p-1.5 bg-purple-600 rounded-lg hover:bg-purple-500 transition text-white" title="Добавить в плейлист"><Plus size={16} /></button>
                    <button onClick={() => onEditTrack(track)} className="p-1.5 bg-gray-800 rounded-lg hover:bg-purple-500 hover:text-white transition text-gray-400" title="Редактировать"><Edit3 size={16} /></button>
                    <button onClick={() => deleteTrackFromDb(track.id)} className="p-1.5 bg-gray-800 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition text-gray-400" title="Удалить из Базы"><Trash2 size={16} /></button>
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