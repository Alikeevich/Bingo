import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabase';
import { Track } from '../../types';
import { compressAudioToMp3, fmtMB } from '../../lib/compressAudio';
import {
  Search, X, UploadCloud, Loader2, CheckCircle2,
  Trash2, Scissors,
} from 'lucide-react';
import AudioTrimmer from '../AudioTrimmer';
import { authHeader, uploadMp3ToR2 } from '../../lib/r2Upload';

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
  // Список отдаём порциями — в базе больше тысячи треков, и полная отрисовка тормозила
  const PAGE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE);

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

  useEffect(() => { setVisibleCount(PAGE); }, [search, filter]);
  const shown = visible.slice(0, visibleCount);
  const hasMore = visible.length > visibleCount;

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
        stored = await uploadMp3ToR2(res.blob, id); // в mp3_path ляжет полный https-URL
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
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
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
    <div className="flex flex-col h-full text-pult-text">
      <h1 className="text-2xl font-medium">Полные MP3</h1>
      <p className="mt-1 text-sm text-pult-text2 mb-5 max-w-3xl">
        Заливай полные версии песен бірақ файл сжимается до {BITRATE} kbps прямо в браузере.
        Полная версия играет <span className="text-pult-text">офлайн</span> и
        позволяет «Продолжить» песню точно с того места, где остановились.
      </p>

      {/* Прогресс миграции */}
      <div className="bg-pult-card border border-white/[0.08] rounded-xl p-5 mb-5 max-w-3xl">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-sm text-pult-text2">Полные версии загружены</div>
            <div className="text-2xl font-medium font-mono tabular-nums">
              {doneCount} <span className="text-pult-muted text-lg">/ {dbTracks.length}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-medium font-mono tabular-nums text-lime">{pct}%</div>
            <div className="text-xs text-pult-muted">готово</div>
          </div>
        </div>
        <div className="h-1.5 bg-pult-raised rounded-full overflow-hidden">
          <div className="h-full bg-lime transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-pult-muted mt-3 leading-relaxed">
          Не обязательно заливать всё. Хитовый музыкадан бастай бер бауырым.
        </p>
      </div>

      {/* Поиск + фильтры */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <div className="relative w-72 mr-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pult-muted pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Песня или исполнитель"
            className="h-9 w-full rounded-lg bg-pult-raised border border-white/[0.06] pl-9 pr-9 text-sm text-pult-text placeholder:text-pult-muted focus:outline-none focus:border-lime/60"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-pult-muted hover:text-white"><X size={14} /></button>
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
            className={`h-9 px-3 rounded-lg text-sm transition-colors ${filter === key ? 'bg-pult-raised text-pult-text border border-white/[0.1]' : 'text-pult-text2 hover:bg-white/[0.04]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Список треков */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
        {visible.length === 0 ? (
          <div className="text-center py-16 text-pult-muted bg-pult-card/60 rounded-2xl border border-dashed border-white/[0.08]">
            {filter === 'todo' && dbTracks.length > 0 && doneCount === dbTracks.length
              ? <><CheckCircle2 size={28} className="mx-auto mb-3 text-lime" /><p>У всех песен уже есть полные версии</p></>
              : <p>Ничего не найдено</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-pult-card p-1.5 flex flex-col gap-0.5">
            {shown.map(track => {
              const id = String(track.id);
              const state = busy[id];
              const done = hasFull(track);
              return (
                <div key={id} className="flex items-center gap-3 h-14 px-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <img src={track.cover} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0 bg-pult-raised" loading="lazy" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm truncate">{track.title}</p>
                    <p className="text-sm text-pult-text2 truncate">{track.artist}</p>
                  </div>

                  {state ? (
                    <div className="w-56 flex-shrink-0">
                      <div className="flex items-center gap-2 text-xs text-pult-text2 mb-1">
                        <Loader2 size={14} className="animate-spin" />
                        {state.phase}… {Math.round(state.ratio * 100)}%
                      </div>
                      <div className="h-1 bg-pult-raised rounded-full overflow-hidden">
                        <div className="h-full bg-lime transition-[width]" style={{ width: `${state.ratio * 100}%` }} />
                      </div>
                    </div>
                  ) : done ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="flex items-center gap-1.5 text-sm text-pult-text2">
                        <span className="w-1.5 h-1.5 rounded-full bg-lime" />
                        Полная есть
                      </span>
                      {track.mp3Path && (
                        <button onClick={() => removeMp3(track)} title="Убрать полную версию" className="p-1.5 text-pult-muted hover:text-red-400 hover:bg-white/[0.06] rounded-md transition-colors">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <label className="flex-shrink-0 h-8 px-3 rounded-md text-sm inline-flex items-center gap-1.5 text-pult-text2 hover:text-[#141415] hover:bg-lime cursor-pointer transition-colors">
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

        {hasMore && (
          <div className="flex flex-col items-center gap-2 py-8">
            <button
              onClick={() => setVisibleCount(c => c + PAGE)}
              className="px-6 py-3 bg-pult-raised hover:bg-[#2b2b2e] rounded-xl font-medium transition-colors"
            >
              Показать ещё {Math.min(PAGE, visible.length - visibleCount)}
            </button>
            <span className="text-xs text-pult-muted">показано {shown.length} из {visible.length}</span>
          </div>
        )}
      </div>

      {/* ─── МОДАЛКА: ВЫБОР ФРАГМЕНТА ПЕРЕД ЗАГРУЗКОЙ ─── */}
      {pending && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-pult-card border border-white/[0.08] rounded-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-4 overflow-hidden">
                <img src={pending.track.cover} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                <div className="overflow-hidden">
                  <h3 className="text-lg font-medium truncate">{pending.track.title}</h3>
                  <p className="text-sm text-pult-text2 truncate">{pending.track.artist}</p>
                </div>
              </div>
              <button onClick={closePending} className="text-pult-text2 hover:text-white flex-shrink-0"><X size={22} /></button>
            </div>

            <label className="text-sm font-medium text-pult-text2 mb-2 flex items-center gap-2">
              <Scissors size={14} className="text-lime" />
              С какого момента играть в игре
            </label>
            <AudioTrimmer
              src={pending.url}
              start={trimStart}
              end={trimEnd}
              onChange={(s, e) => { setTrimStart(s); setTrimEnd(e); }}
            />
            <p className="text-[11px] text-pult-muted mt-2 leading-relaxed">
              Трек начнётся с зелёной метки и остановится на красной — ставь на узнаваемый
              момент (припев). Кнопка «Полная» в игре снимет ограничение и доиграет песню
              до конца. Не трогай — будет играть с начала.
            </p>

            <div className="flex gap-3 mt-6">
              <button onClick={closePending} className="flex-1 py-3 bg-pult-raised rounded-xl font-medium hover:bg-[#2b2b2e] transition-colors">
                Отмена
              </button>
              <button
                onClick={() => {
                  const { track, file } = pending;
                  const seg = { start: trimStart, end: trimEnd };
                  closePending();
                  handleFile(track, file, seg);
                }}
                className="flex-[2] py-3 bg-lime hover:bg-[#d4ff63] rounded-xl font-medium text-[#141415] transition-colors flex items-center justify-center gap-2"
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
