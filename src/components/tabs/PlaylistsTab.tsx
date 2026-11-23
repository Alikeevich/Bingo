import { useState } from 'react';
import { supabase } from '../../supabase';
import { uploadMp3ToR2, isMp3File, MP3_ONLY_MSG, MP3_ACCEPT } from '../../lib/r2Upload';
import { Game, Playlist, Tag, Track } from '../../types';
import { ChevronLeft, UploadCloud, HardDriveDownload, Loader2, PauseCircle, PlayCircle, Trash2, FolderPlus, Shuffle, Search, X, SearchCheck, GripVertical, Lock } from 'lucide-react';
import { splitArtists } from '../../utils';
import { cacheTracks, isOfflineCacheReady } from '../../lib/offlineCache';
import PlaylistBuilder from './PlaylistBuilder';

interface PlaylistsTabProps {
  playlists: Playlist[];
  setPlaylists: (val: Playlist[]) => void;
  playingTrackId: string | number | null;
  isPaused: boolean;
  togglePlay: (track: Track) => void;
  showToast: (msg: string, opts?: { sticky?: boolean }) => void;
  /** Даёт ссылку, которую реально играет плеер (свой MP3 / R2 / свежий Deezer) */
  resolveTrackUrl: (track: Track) => Promise<string | null>;
  /** Нужны, чтобы предупредить: смена порядка ломает уже собранные карточки туров */
  games: Game[];
  /** «Моя база» и теги — левая панель конструктора плейлиста */
  dbTracks: Track[];
  dbTags: Tag[];
}

export default function PlaylistsTab({ playlists, setPlaylists, playingTrackId, isPaused, togglePlay, showToast, resolveTrackUrl, games, dbTracks, dbTags }: PlaylistsTabProps) {
  const[viewingPlaylist, setViewingPlaylist] = useState<Playlist | null>(null);
  const[isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const[newPlaylistName, setNewPlaylistName] = useState('');
  const [isUploadingMp3, setIsUploadingMp3] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState<{ current: number; total: number } | null>(null);
  const [trackSearch, setTrackSearch] = useState('');
  const [dupesOnly, setDupesOnly] = useState(false);
  // Перетаскивание: какую строку тащим и над какой сейчас курсор
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<'build' | 'order'>('build');
  // Плейлисты, которые ведущий явно разблокировал для правки, несмотря на готовые бланки
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [unlockAsk, setUnlockAsk] = useState<string | null>(null);

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setIsCreatePlaylistModalOpen(false);
    const { data } = await supabase.from('playlists').insert([{ name: newPlaylistName, tracks: [] }]).select();
    if (data?.[0]) { setPlaylists([data[0], ...playlists]); showToast('Плейлист создан'); }
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

  const shufflePlaylist = async (playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist || playlist.tracks.length < 2) return;
    // Fisher–Yates shuffle (надёжнее чем sort + Math.random())
    const shuffled = [...playlist.tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setPlaylists(playlists.map(p => p.id === playlistId ? { ...p, tracks: shuffled } : p));
    if (viewingPlaylist?.id === playlistId) setViewingPlaylist({ ...viewingPlaylist, tracks: shuffled });
    await supabase.from('playlists').update({ tracks: shuffled }).eq('id', playlistId);
    warnIfCardsBuilt(playlistId, 'Плейлист перемешан');
  };

  // Туры, у которых по этому плейлисту уже собраны карточки. Порядок плейлиста —
  // это порядок, в котором треки звучат в туре, и по нему же рассчитано, на какой
  // песне выиграет каждая карточка. Поменял порядок — напечатанные бланки начнут
  // выигрывать не тогда, когда задумано.
  const roundsWithCards = (playlistId: string) =>
    games.flatMap(g => g.rounds
      .filter(r => r.playlistId === playlistId && (r.cards?.length || 0) > 0)
      .map(r => `${g.name} / ${r.name}`));

  const warnIfCardsBuilt = (playlistId: string, okText: string) => {
    const affected = roundsWithCards(playlistId);
    showToast(affected.length
      ? `${okText}. Перегенерируй карточки: ${affected.join(', ')}`
      : okText);
  };

  // Переставляет трек с позиции from на позицию to и сохраняет порядок
  const moveTrack = async (playlistId: string, from: number, to: number) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist || from === to || from < 0 || to < 0) return;
    const next = [...playlist.tracks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPlaylists(playlists.map(p => p.id === playlistId ? { ...p, tracks: next } : p));
    if (viewingPlaylist?.id === playlistId) setViewingPlaylist({ ...viewingPlaylist, tracks: next });
    const { error } = await supabase.from('playlists').update({ tracks: next }).eq('id', playlistId);
    if (error) { showToast('Не удалось сохранить порядок: ' + error.message); return; }
    warnIfCardsBuilt(playlistId, 'Порядок сохранён');
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
      if (!isMp3File(file)) { showToast(`${file.name}: ${MP3_ONLY_MSG}`); continue; }
      const ext = file.name.split('.').pop() || 'mp3';
      const safeName = `custom_${Date.now()}_${i}.${ext}`;
      try {
        // MP3 — в R2; Supabase Storage только запасной путь (там всего 1 ГБ на весь проект)
        let url = '';
        if (isMp3File(file)) {
          try { url = await uploadMp3ToR2(file, safeName); } catch (e) { console.warn('R2 upload failed, fallback to Supabase', e); }
        }
        if (!url) {
          const { data, error } = await supabase.storage.from('audio-tracks').upload(safeName, file, { upsert: true });
          if (error) throw error;
          url = supabase.storage.from('audio-tracks').getPublicUrl(data.path).data.publicUrl;
        }
        newTracks.push({
          id: safeName, title: file.name.replace(`.${ext}`, ''),
          artist: 'Свой трек', cover: 'https://placehold.co/400x400/8b5cf6/ffffff?text=MP3',
          preview: url, isCustom: true,
        });
      } catch (err: any) { showToast(`Ошибка загрузки ${file.name}: ${err.message}`); }
    }
    setPlaylists(playlists.map(p => p.id === playlistId ? { ...p, tracks: newTracks } : p));
    if (viewingPlaylist?.id === playlistId) setViewingPlaylist({ ...viewingPlaylist, tracks: newTracks });
    await supabase.from('playlists').update({ tracks: newTracks }).eq('id', playlistId);
    setIsUploadingMp3(false);
    showToast('Песни добавлены');
    e.target.value = '';
  };

  const cachePlaylistForOffline = async (playlist: Playlist) => {
    if (!isOfflineCacheReady()) {
      showToast('Офлайн-режим ещё готовится. Обнови страницу и попробуй снова');
      return;
    }
    try {
      setOfflineProgress({ current: 0, total: playlist.tracks.length });

      // Берём именно те ссылки, которые будет играть плеер: свой MP3 / R2 /
      // свежий Deezer. Раньше кэшировалось поле preview, а игралось другое —
      // поэтому кэш никогда не совпадал и треки качались заново.
      const urls: string[] = [];
      let resolved = 0;
      for (const track of playlist.tracks) {
        try {
          const url = await resolveTrackUrl(track);
          if (url) urls.push(url);
        } catch { /* трек недоступен — пропускаем */ }
        resolved++;
        setOfflineProgress({ current: Math.round(resolved / 2), total: playlist.tracks.length });
      }

      await cacheTracks(urls, (done, total) => {
        // вторая половина шкалы — собственно скачивание
        setOfflineProgress({
          current: Math.round(playlist.tracks.length / 2 + (done / total) * (playlist.tracks.length / 2)),
          total: playlist.tracks.length,
        });
      });

      showToast(`Готово: ${urls.length} треков доступны офлайн`);
      setTimeout(() => setOfflineProgress(null), 2000);
    } catch (e) {
      showToast('Не удалось сохранить для офлайна');
      setOfflineProgress(null);
    }
  };

  // Сохраняет новый состав/порядок плейлиста (общий путь для конструктора)
  const savePlaylistTracks = async (playlistId: string, next: Track[]) => {
    setPlaylists(playlists.map(p => p.id === playlistId ? { ...p, tracks: next } : p));
    if (viewingPlaylist?.id === playlistId) setViewingPlaylist({ ...viewingPlaylist, tracks: next });
    const { error } = await supabase.from('playlists').update({ tracks: next }).eq('id', playlistId);
    if (error) showToast('Не удалось сохранить плейлист: ' + error.message, { sticky: true });
  };

  if (viewingPlaylist) {
    const currentPlaylist = playlists.find(p => p.id === viewingPlaylist.id) || viewingPlaylist;
    const isReadyForGame = currentPlaylist.tracks.length >= 24;
    const q = trackSearch.trim().toLowerCase();

    // Детектор дублей: считаем каждого отдельного артиста (с учётом фитов); если он
    // встречается в 2+ треках — все эти треки помечаем как дубль-артистов.
    const artistCount = new Map<string, number>();
    for (const t of currentPlaylist.tracks)
      for (const a of new Set(splitArtists(t.artist))) artistCount.set(a, (artistCount.get(a) || 0) + 1);
    const dupArtists = new Set([...artistCount.entries()].filter(([, c]) => c > 1).map(([a]) => a));
    const isDupTrack = (t: Track) => splitArtists(t.artist).some(a => dupArtists.has(a));
    const dupCount = currentPlaylist.tracks.filter(isDupTrack).length;

    let list = currentPlaylist.tracks;
    if (q)
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q))
      );
    if (dupesOnly) {
      const sharedOf = (t: Track) => splitArtists(t.artist).find(a => dupArtists.has(a)) || '';
      list = list.filter(isDupTrack).slice().sort((a, b) => sharedOf(a).localeCompare(sharedOf(b)));
    }
    const filteredTracks = list;
    const builtRounds = roundsWithCards(currentPlaylist.id);
    // По плейлисту напечатаны бланки — менять песни и порядок нельзя, пока явно не разблокировать
    const locked = builtRounds.length > 0 && !unlockedIds.has(currentPlaylist.id);
    const canReorder = !locked && !q && !dupesOnly && currentPlaylist.tracks.length > 1;

    const quietBtn = 'h-9 px-4 rounded-lg text-sm font-medium inline-flex items-center gap-2 bg-pult-raised text-pult-text border border-white/[0.06] hover:bg-[#2b2b2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

    return (
      <div className="flex flex-col h-full min-h-0 text-pult-text">
        <button
          onClick={() => { setTrackSearch(''); setDupesOnly(false); setViewingPlaylist(null); }}
          className="inline-flex items-center gap-1 text-sm text-pult-text2 hover:text-pult-text transition-colors w-fit mb-4"
        >
          <ChevronLeft size={16} /> Плейлисты
        </button>

        <header className="flex items-end justify-between gap-6 mb-6">
          <div>
            <h1 className="text-2xl font-medium">{currentPlaylist.name}</h1>
            <p className="mt-1 text-sm text-pult-text2">
              <span className="font-mono tabular-nums">{currentPlaylist.tracks.length}</span> песен
              <span className="mx-2 text-pult-muted">·</span>
              {isReadyForGame
                ? <span>готов к генерации бланков</span>
                : <span className="text-amber-300">нужно минимум 24 песни</span>}
              {builtRounds.length > 0 && (
                <>
                  <span className="mx-2 text-pult-muted">·</span>
                  <span>бланки: {builtRounds.join(', ')}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className={`${quietBtn} cursor-pointer ${locked ? 'pointer-events-none opacity-40' : ''}`}>
              {isUploadingMp3 ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Свои MP3
              <input type="file" multiple accept={MP3_ACCEPT} className="hidden" onChange={e => uploadCustomTracks(e, currentPlaylist.id)} disabled={isUploadingMp3 || locked} />
            </label>
            <button onClick={() => shufflePlaylist(currentPlaylist.id)} disabled={locked || currentPlaylist.tracks.length < 2} title="Перемешать порядок песен" className={quietBtn}>
              <Shuffle size={16} /> Перемешать
            </button>
            <button onClick={() => cachePlaylistForOffline(currentPlaylist)} disabled={currentPlaylist.tracks.length === 0} title="Скачать песни, чтобы играли без интернета" className={quietBtn}>
              <HardDriveDownload size={16} /> Офлайн
            </button>
          </div>
        </header>

        {/* вкладки */}
        <div className="flex items-center gap-1 mb-4 border-b border-white/[0.06]">
          {([['build', 'Набор песен'], ['order', 'Порядок и прослушка']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setDetailTab(k)}
              className={`h-10 px-4 -mb-px text-sm transition-colors border-b-2 ${detailTab === k ? 'border-lime text-pult-text' : 'border-transparent text-pult-text2 hover:text-pult-text'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {offlineProgress && (
          <div className="mb-4 flex items-center gap-4 rounded-xl border border-white/[0.08] bg-pult-card px-4 py-3 text-sm">
            <Loader2 className="animate-spin text-pult-muted" size={16} />
            <span className="text-pult-text2">Сохраняем для офлайна</span>
            <span className="font-mono tabular-nums text-pult-muted">{offlineProgress.current} / {offlineProgress.total}</span>
            <div className="ml-auto w-1/3 h-1 rounded-full bg-pult-raised overflow-hidden">
              <div className="h-full bg-lime transition-[width]" style={{ width: `${(offlineProgress.current / offlineProgress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {detailTab === 'build' ? (
          <PlaylistBuilder
            playlist={currentPlaylist}
            playlists={playlists}
            dbTracks={dbTracks}
            dbTags={dbTags}
            games={games}
            locked={locked}
            onUnlockRequest={() => setUnlockAsk(currentPlaylist.id)}
            onSave={next => savePlaylistTracks(currentPlaylist.id, next)}
            showToast={showToast}
            togglePlay={togglePlay}
            playingTrackId={playingTrackId}
            isPaused={isPaused}
          />
        ) : (
          <div className="flex flex-col min-h-0 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pult-muted pointer-events-none" />
                <input
                  type="text" value={trackSearch} onChange={e => setTrackSearch(e.target.value)}
                  placeholder="Песня, исполнитель или тег"
                  className="h-9 w-full rounded-lg bg-pult-raised border border-white/[0.06] pl-8 pr-8 text-sm text-pult-text placeholder:text-pult-muted focus:outline-none focus:border-lime/60"
                />
                {trackSearch && (
                  <button onClick={() => setTrackSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-pult-muted hover:text-pult-text" title="Сбросить"><X size={14} /></button>
                )}
              </div>
              <button onClick={() => setDupesOnly(v => !v)} disabled={dupCount === 0} title="Показать песни, у которых исполнитель или фит повторяется"
                className={`${quietBtn} ${dupesOnly ? 'border-lime/50 text-lime' : ''}`}>
                <SearchCheck size={16} /> {dupesOnly ? 'Показать все' : 'Повторы исполнителей'}
                {!dupesOnly && dupCount > 0 && <span className="font-mono tabular-nums text-pult-muted">{dupCount}</span>}
              </button>
              <span className="ml-auto text-sm text-pult-muted">
                {locked
                  ? 'Порядок закреплён — по плейлисту созданы бланки'
                  : dupesOnly
                    ? 'Удали лишние, чтобы исполнители не повторялись'
                    : canReorder
                      ? 'Перетащи песню за ручку слева — в этом порядке она зазвучит в туре'
                      : q ? `Найдено: ${filteredTracks.length}. Чтобы менять порядок, сбрось поиск` : ''}
              </span>
            </div>

            {locked && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-pult-card px-4 py-3 text-sm text-pult-text2">
                <Lock size={16} className="text-pult-muted shrink-0" />
                <span className="flex-1">По этому плейлисту уже созданы бланки. Если поменять песни или порядок, напечатанные карточки будут выигрывать не на тех песнях</span>
                <button onClick={() => setUnlockAsk(currentPlaylist.id)} className={quietBtn}>Всё равно изменить</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-10">
              {currentPlaylist.tracks.length === 0 ? (
                <div className="py-16 text-center text-pult-text2 rounded-xl border border-dashed border-white/[0.08]">
                  <p>Плейлист пуст</p>
                  <button onClick={() => setDetailTab('build')} className="mt-2 text-sm text-lime hover:underline">Набрать песни из базы</button>
                </div>
              ) : filteredTracks.length === 0 ? (
                <div className="py-12 text-center text-pult-text2 rounded-xl border border-dashed border-white/[0.08]">
                  {dupesOnly ? (
                    <>
                      <p>Исполнители не повторяются</p>
                      <button onClick={() => setDupesOnly(false)} className="mt-2 text-sm text-lime hover:underline">Показать все</button>
                    </>
                  ) : (
                    <>
                      <p>Ничего не нашли по запросу «{trackSearch}»</p>
                      <button onClick={() => setTrackSearch('')} className="mt-2 text-sm text-lime hover:underline">Сбросить поиск</button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {filteredTracks.map((track, index) => {
                    const isPlaying = playingTrackId === track.id && !isPaused;
                    return (
                      <div
                        key={track.id}
                        draggable={canReorder}
                        onDragStart={e => {
                          setDragIndex(index);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(index)); // Firefox без этого не начинает перетаскивание
                        }}
                        onDragOver={e => {
                          if (dragIndex === null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (overIndex !== index) setOverIndex(index);
                        }}
                        onDrop={e => {
                          e.preventDefault();
                          if (dragIndex !== null) moveTrack(currentPlaylist.id, dragIndex, index);
                          setDragIndex(null); setOverIndex(null);
                        }}
                        onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                        className={`group grid grid-cols-[16px_40px_40px_1fr_auto_32px] items-center gap-3 h-14 px-3 rounded-lg transition-colors ${
                          dragIndex === index ? 'opacity-40' : ''
                        } ${
                          overIndex === index && dragIndex !== null && dragIndex !== index
                            ? (dragIndex < index ? 'shadow-[inset_0_-2px_0_#C9FF3B]' : 'shadow-[inset_0_2px_0_#C9FF3B]')
                            : ''
                        } ${isPlaying ? 'bg-pult-raised' : 'hover:bg-white/[0.03]'}`}
                      >
                        <span className={`text-pult-muted ${canReorder ? 'cursor-grab active:cursor-grabbing group-hover:text-pult-text2' : 'opacity-0'}`} title={canReorder ? 'Перетащи, чтобы поменять порядок' : undefined}>
                          <GripVertical size={16} />
                        </span>
                        <span className="font-mono text-sm tabular-nums text-pult-muted text-right">{index + 1}</span>
                        <button className="relative w-10 h-10 rounded-md overflow-hidden bg-pult-raised" onClick={() => togglePlay(track)} title="Послушать">
                          {track.cover && <img src={track.cover} alt="" className="w-full h-full object-cover" loading="lazy" />}
                          <span className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            {isPlaying ? <PauseCircle size={20} className="text-white" /> : <PlayCircle size={20} className="text-white" />}
                          </span>
                        </button>
                        <div className="min-w-0">
                          <p className={`truncate text-sm ${isPlaying ? 'text-lime' : 'text-pult-text'}`}>{track.title}</p>
                          <p className="truncate text-sm text-pult-text2">{track.artist}</p>
                        </div>
                        <span className="text-xs text-pult-muted">{track.mp3Path || track.isCustom ? 'свой MP3' : ''}</span>
                        <button
                          onClick={() => removeTrackFromPlaylist(currentPlaylist.id, track.id)}
                          disabled={locked}
                          title="Убрать из плейлиста"
                          className="p-1.5 rounded-md text-pult-muted hover:text-red-400 hover:bg-white/[0.04] transition-colors opacity-0 group-hover:opacity-100 disabled:hidden"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {unlockAsk && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setUnlockAsk(null)}>
            <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-pult-card p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-medium mb-2">Изменить плейлист с готовыми бланками</h3>
              <p className="text-sm text-pult-text2 mb-6">
                По нему созданы бланки: {roundsWithCards(unlockAsk).join(', ')}. Если поменять песни или их порядок,
                напечатанные карточки начнут выигрывать не на тех песнях. После правки перегенерируй бланки этих туров
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setUnlockAsk(null)} className={quietBtn}>Отмена</button>
                <button
                  onClick={() => { setUnlockedIds(prev => new Set(prev).add(unlockAsk)); setUnlockAsk(null); }}
                  className="h-9 px-4 rounded-lg text-sm font-medium bg-lime text-[#141415] hover:bg-[#d4ff63] transition-colors"
                >
                  Разблокировать
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar pr-1 pb-10 text-pult-text">
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">Плейлисты</h1>
          <p className="mt-1 text-sm text-pult-text2">Песни для туров, обычно 60–80 в плейлисте</p>
        </div>
        <button onClick={() => setIsCreatePlaylistModalOpen(true)}
          className="h-9 px-4 rounded-lg text-sm font-medium inline-flex items-center gap-2 bg-lime text-[#141415] hover:bg-[#d4ff63] transition-colors">
          <FolderPlus size={16} /> Новый плейлист
        </button>
      </header>

      <div className="rounded-xl border border-white/[0.08] bg-pult-card divide-y divide-white/[0.06]">
        {/* Плейлисты туров, собранных прямо в игре, здесь не показываем — они живут в своей игре */}
        {playlists.filter(p => !p.game_id).length === 0 && <p className="p-6 text-sm text-pult-text2">Плейлистов пока нет</p>}
        {playlists.filter(p => !p.game_id).map(playlist => {
          const used = roundsWithCards(playlist.id);
          return (
            <div key={playlist.id} onClick={() => setViewingPlaylist(playlist)}
              className="group grid grid-cols-[1fr_120px_1fr_32px] items-center gap-4 h-14 px-4 cursor-pointer hover:bg-white/[0.03] transition-colors">
              <span className="truncate">{playlist.name}</span>
              <span className={`font-mono text-sm tabular-nums ${playlist.tracks.length >= 24 ? 'text-pult-text2' : 'text-amber-300'}`}>
                {playlist.tracks.length} песен
              </span>
              <span className="truncate text-sm text-pult-muted" title={used.join(', ')}>
                {used.length ? `бланки: ${used.join(', ')}` : ''}
              </span>
              <button onClick={e => deletePlaylist(playlist.id, e)} title="Удалить плейлист"
                className="p-1.5 rounded-md text-pult-muted hover:text-red-400 hover:bg-white/[0.04] transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {isCreatePlaylistModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setIsCreatePlaylistModalOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-pult-card p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-4">Новый плейлист</h3>
            <input autoFocus type="text" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="Название"
              className="h-10 w-full rounded-lg bg-pult-raised border border-white/[0.06] px-3 text-sm text-pult-text placeholder:text-pult-muted focus:outline-none focus:border-lime/60 mb-6"
              onKeyDown={e => e.key === 'Enter' && createPlaylist()} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsCreatePlaylistModalOpen(false)} className="h-9 px-4 rounded-lg text-sm font-medium bg-pult-raised text-pult-text border border-white/[0.06] hover:bg-[#2b2b2e] transition-colors">Отмена</button>
              <button onClick={createPlaylist} className="h-9 px-4 rounded-lg text-sm font-medium bg-lime text-[#141415] hover:bg-[#d4ff63] transition-colors">Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
