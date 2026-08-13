import { useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabase';
import { Track } from '../../types';
import { compressAudioToMp3, fmtMB } from '../../lib/compressAudio';
import {
  Search, X, UploadCloud, Loader2, CheckCircle2, HardDriveDownload,
  Music, Trash2, AlertTriangle, Scissors,
} from 'lucide-react';
import AudioTrimmer from '../AudioTrimmer';

interface Props {
  dbTracks: Track[];
  setDbTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  showToast: (msg: string) => void;
}

type Filter = 'all' | 'todo' | 'done';

// Битрейт сжатия: 128 kbps — на колонках в пабе неотличимо от оригинала,
// но файл в ~2.5 раза меньше, значит в хранилище влезет в 2.5 раза больше треков.
const BITRATE = 128;

export default function MigrationTab({ dbTracks, setDbTracks, showToast }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todo');
  // id трека → прогресс (0..1) во время сжатия/загрузки
  const [busy, setBusy] = useState<Record<string, { phase: string; ratio: number }>>({});
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  // Выбранный файл, ожидающий подтверждения фрагмента (модалка с триммером)
  const [pending, setPending] = useState<{ track: Track; file: File; url: string } | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const hasFull = (t: Track) => !!t.mp3Path || !!t.isCustom;
  const doneCount = useMemo(() => dbTracks.filter(hasFull).length, [dbTracks]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dbTracks.filter(t => {
      if (filter === 'todo' && hasFull(t)) return false;
      if (filter === 'done' && !hasFull(t)) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
    });
  }, [dbTracks, search, filter]);

  const setPhase = (id: string, phase: string, ratio: number) =>
    setBusy(prev => ({ ...prev, [id]: { phase, ratio } }));
  const clearPhase = (id: string) =>
    setBusy(prev => { const n = { ...prev }; delete n[id]; return n; });

  // Файл выбран — сначала даём послушать и выбрать фрагмент для угадайки,
  // и только потом сжимаем и грузим (чтобы не гонять файл дважды).
  const pickFile = (track: Track, file: File) => {
    setTrimStart(track.previewStart ?? 0);
    setTrimEnd(track.previewEnd ?? 0);
    setPending({ track, file, url: URL.createObjectURL(file) });
  };

  const closePending = () => {
    if (pending) URL.revokeObjectURL(pending.url);
    const id = pending ? String(pending.track.id) : '';
    setPending(null);
    const el = inputsRef.current[id];
    if (el) el.value = '';
  };

  const handleFile = async (track: Track, file: File, seg: { start: number; end: number }) => {
    const id = String(track.id);
    try {
      setPhase(id, 'Сжимаем', 0);
      const res = await compressAudioToMp3(file, {
        bitrateKbps: BITRATE,
        onProgress: r => setPhase(id, 'Сжимаем', r),
      });

      setPhase(id, 'Загружаем', 1);
      // Пробуем Cloudflare R2 (10 ГБ бесплатно, трафик бесплатный). Если он ещё
      // не настроен — молча падаем обратно в Supabase Storage, чтобы миграцию
      // можно было начинать не дожидаясь настройки R2.
      let stored = '';
      try {
        const signRes = await fetch('/api/r2-sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackId: id }),
        });
        if (!signRes.ok) throw new Error('r2 not configured');
        const { signedUrl, publicUrl } = await signRes.json();
        const put = await fetch(signedUrl, {
          method: 'PUT',
          body: res.blob,
          headers: { 'Content-Type': 'audio/mpeg' },
        });
        if (!put.ok) throw new Error(`R2 отказал (${put.status})`);
        stored = publicUrl; // в mp3_path ляжет полный https-URL
      } catch {
        const safeName = `full_${id}_${Date.now()}.mp3`;
        const { error: upErr } = await supabase.storage
          .from('audio-tracks')
          .upload(safeName, res.blob, { upsert: true, contentType: 'audio/mpeg' });
        if (upErr) throw upErr;
        stored = safeName; // в mp3_path ляжет имя файла в Supabase Storage
      }

      // Вместе с файлом сохраняем выбранный фрагмент: в игре трек зазвучит
      // именно с этого момента, а кнопка «Полная» снимет ограничение и доиграет до конца.
      const patch = {
        mp3_path: stored,
        preview_start: seg.start > 0 ? seg.start : null,
        preview_end:   seg.end   > 0 ? seg.end   : null,
      };
      const { error: dbErr } = await supabase.from('tracks').update(patch).eq('id', id);
      if (dbErr) throw dbErr;

      setDbTracks(prev => prev.map(t =>
        String(t.id) === id
          ? { ...t, mp3Path: stored, previewStart: seg.start || undefined, previewEnd: seg.end || undefined }
          : t));

      const saved = res.originalBytes - res.compressedBytes;
      showToast(
        `Готово: ${fmtMB(res.originalBytes)} → ${fmtMB(res.compressedBytes)}` +
        (saved > 0 ? ` (сэкономили ${fmtMB(saved)})` : '')
      );
    } catch (e: any) {
      console.error(e);
      showToast('Ошибка: ' + (e?.message || 'не удалось обработать файл'));
    } finally {
      clearPhase(id);
      const el = inputsRef.current[id];
      if (el) el.value = '';
    }
  };

  const removeMp3 = async (track: Track) => {
    const id = String(track.id);
    if (!track.mp3Path) return;
    if (!confirm(`Убрать полную версию у «${track.title}»?`)) return;
    // Чистим сам файл: R2 (внешний URL) — через serverless, иначе Supabase Storage
    if (/^https?:\/\//i.test(track.mp3Path)) {
      const key = track.mp3Path.split('/').slice(-2).join('/'); // tracks/<file>.mp3
      await fetch('/api/r2-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', key }),
      }).catch(() => {});
    } else {
      await supabase.storage.from('audio-tracks').remove([track.mp3Path]);
    }
    await supabase.from('tracks').update({ mp3_path: null }).eq('id', id);
    setDbTracks(prev => prev.map(t => String(t.id) === id ? { ...t, mp3Path: undefined } : t));
    showToast('Полная версия убрана');
  };

  const pct = dbTracks.length ? Math.round((doneCount / dbTracks.length) * 100) : 0;

  return (
    <div className="animate-in fade-in duration-300 flex flex-col h-full">
      <h1 className="text-3xl font-bold mb-2">Миграция на свои MP3</h1>
      <p className="text-gray-400 mb-6">
        Заливай полные версии песен бірақ файл сжимается до {BITRATE} kbps прямо в браузере.
        Полная версия играет <span className="text-green-400 font-medium">офлайн</span> и
        позволяет «Продолжить» песню точно с того места, где остановились.
      </p>

      {/* Прогресс миграции */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-sm text-gray-400">Полные версии загружены</div>
            <div className="text-3xl font-black">
              {doneCount} <span className="text-gray-600 text-xl">/ {dbTracks.length}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-purple-400">{pct}%</div>
            <div className="text-xs text-gray-500">готово</div>
          </div>
        </div>
        <div className="h-2.5 bg-gray-950 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-600 to-green-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
          <AlertTriangle size={12} className="inline mr-1 -mt-0.5 text-yellow-500" />
          Не обязательно заливать всё. Хитовый музыкадан бастай бер бауырым.
        </p>
      </div>

      {/* Поиск + фильтры */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск: трек или исполнитель…"
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={14} /></button>
          )}
        </div>
        {([
          ['todo', `Без MP3 (${dbTracks.length - doneCount})`],
          ['done', `С MP3 (${doneCount})`],
          ['all',  `Все (${dbTracks.length})`],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${filter === key ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Список треков */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
        {visible.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-gray-900/50 rounded-2xl border border-dashed border-gray-800">
            {filter === 'todo' && dbTracks.length > 0 && doneCount === dbTracks.length
              ? <><CheckCircle2 size={40} className="mx-auto mb-3 text-green-500" /><p>Все треки уже с полными версиями.</p></>
              : <p>Ничего не найдено.</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map(track => {
              const id = String(track.id);
              const state = busy[id];
              const done = hasFull(track);
              return (
                <div key={id} className={`flex items-center gap-4 p-3 rounded-xl border transition ${done ? 'bg-green-950/20 border-green-900/40' : 'bg-gray-900 border-gray-800'}`}>
                  <img src={track.cover} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 overflow-hidden">
                    <p className="font-bold truncate">{track.title}</p>
                    <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                  </div>

                  {state ? (
                    <div className="w-56 flex-shrink-0">
                      <div className="flex items-center gap-2 text-xs text-purple-300 mb-1">
                        <Loader2 size={14} className="animate-spin" />
                        {state.phase}… {Math.round(state.ratio * 100)}%
                      </div>
                      <div className="h-1.5 bg-gray-950 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 transition-all" style={{ width: `${state.ratio * 100}%` }} />
                      </div>
                    </div>
                  ) : done ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 text-green-400 rounded-lg text-xs font-bold">
                        {track.isCustom && !track.mp3Path ? <Music size={14} /> : <HardDriveDownload size={14} />}
                        Полная есть
                      </span>
                      {track.mp3Path && (
                        <button onClick={() => removeMp3(track)} title="Убрать полную версию" className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <label className="flex-shrink-0 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer transition">
                      <UploadCloud size={16} /> Загрузить MP3
                      <input
                        ref={el => { inputsRef.current[id] = el; }}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(track, f); }}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── МОДАЛКА: ВЫБОР ФРАГМЕНТА ПЕРЕД ЗАГРУЗКОЙ ─── */}
      {pending && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-4 overflow-hidden">
                <img src={pending.track.cover} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                <div className="overflow-hidden">
                  <h3 className="text-lg font-bold truncate">{pending.track.title}</h3>
                  <p className="text-sm text-gray-400 truncate">{pending.track.artist}</p>
                </div>
              </div>
              <button onClick={closePending} className="text-gray-400 hover:text-white flex-shrink-0"><X size={22} /></button>
            </div>

            <label className="text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
              <Scissors size={14} className="text-purple-400" />
              С какого момента играть в игре
            </label>
            <AudioTrimmer
              src={pending.url}
              start={trimStart}
              end={trimEnd}
              onChange={(s, e) => { setTrimStart(s); setTrimEnd(e); }}
            />
            <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
              Трек начнётся с зелёной метки и остановится на красной — ставь на узнаваемый
              момент (припев). Кнопка «Полная» в игре снимет ограничение и доиграет песню
              до конца. Не трогай — будет играть с начала.
            </p>

            <div className="flex gap-3 mt-6">
              <button onClick={closePending} className="flex-1 py-3 bg-gray-800 rounded-xl font-bold hover:bg-gray-700 transition">
                Отмена
              </button>
              <button
                onClick={() => {
                  const { track, file } = pending;
                  const seg = { start: trimStart, end: trimEnd };
                  closePending();
                  handleFile(track, file, seg);
                }}
                className="flex-[2] py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white transition flex items-center justify-center gap-2"
              >
                <UploadCloud size={18} /> Сжать и загрузить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
