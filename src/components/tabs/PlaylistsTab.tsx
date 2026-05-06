import { useState } from 'react';
import { supabase } from '../../supabase';
import { Playlist, Track } from '../../types';
import { ChevronLeft, CheckCircle2, UploadCloud, HardDriveDownload, Loader2, Music, Timer, PauseCircle, PlayCircle, Trash2, FolderPlus } from 'lucide-react';
import { getProxiedUrl } from '../../utils';

interface PlaylistsTabProps {
  playlists: Playlist[];
  setPlaylists: (val: Playlist[]) => void;
  playingTrackId: string | number | null;
  togglePlay: (track: Track) => void;
  showToast: (msg: string) => void;
}

export default function PlaylistsTab({ playlists, setPlaylists, playingTrackId, togglePlay, showToast }: PlaylistsTabProps) {
  const[viewingPlaylist, setViewingPlaylist] = useState<Playlist | null>(null);
  const[isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const[newPlaylistName, setNewPlaylistName] = useState('');
  const [isUploadingMp3, setIsUploadingMp3] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState<{ current: number; total: number } | null>(null);

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
      await supabase.from('playlists').delete().eq('id', id);
      showToast('Плейлист удалён');
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
    } catch (e) { showToast('Ошибка кэширования.'); setOfflineProgress(null); }
  };

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
              {isReadyForGame ? <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium flex items-center gap-1"><CheckCircle2 size={16} /> Готов к генерации</span> : <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">Нужно минимум 24 трека</span>}
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
          {currentPlaylist.tracks.length === 0 ? (
            <div className="text-center py-20 text-gray-500 bg-gray-900/50 rounded-2xl border border-dashed border-gray-800 flex flex-col items-center"><Music size={48} className="mb-4 opacity-50" /><p className="text-lg">Пусто. Загрузите свои MP3 или найдите треки в интернете.</p></div>
          ) : (
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
            <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-auto text-purple-400"><Music size={24} /></div>
            <button onClick={e => deletePlaylist(playlist.id, e)} className="absolute top-4 right-4 p-2 text-gray-600 hover:text-red-400 hover:bg-gray-800 rounded-lg transition opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
            <div><h3 className="font-bold text-xl mb-1 truncate">{playlist.name}</h3><p className={`text-sm ${playlist.tracks.length >= 24 ? 'text-green-400' : 'text-gray-500'}`}>{playlist.tracks.length} треков</p></div>
          </div>
        ))}
      </div>

      {isCreatePlaylistModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">Новый плейлист</h3>
            <input autoFocus type="text" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="Название..." className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-white mb-6" onKeyDown={e => e.key === 'Enter' && createPlaylist()} />
            <div className="flex gap-4"><button onClick={() => setIsCreatePlaylistModalOpen(false)} className="flex-1 py-3 bg-gray-800 rounded-xl font-bold">Отмена</button><button onClick={createPlaylist} className="flex-1 py-3 bg-purple-600 rounded-xl font-bold">Создать</button></div>
          </div>
        </div>
      )}
    </div>
  );
}