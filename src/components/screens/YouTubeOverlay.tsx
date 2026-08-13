import { useEffect } from 'react';
import { X, Youtube } from 'lucide-react';
import { Track } from '../../types';

/**
 * Оверлей с ПОЛНОЙ версией песни на YouTube.
 * Открывается кнопкой «Продолжить (полная)» когда зал подпевает.
 * Стартует с той секунды, на которой оборвалось превью, чтобы не терять момент.
 */
export default function YouTubeOverlay({
  track,
  startAt,
  onClose,
}: {
  track: Track;
  startAt: number;   // с какой секунды продолжить
  onClose: () => void;
}) {
  // Esc — закрыть
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const start = Math.max(0, Math.floor(startAt));
  // enablejsapi не нужен — управляем через сам плеер YouTube.
  // rel=0 — меньше «рекомендаций» в конце, modestbranding — меньше логотипа.
  const src =
    `https://www.youtube-nocookie.com/embed/${track.youtubeId}` +
    `?autoplay=1&start=${start}&rel=0&modestbranding=1&playsinline=1`;

  return (
    <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col animate-in fade-in">
      <div className="h-16 flex items-center justify-between px-6 shrink-0 border-b border-gray-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <Youtube size={24} className="text-red-500 shrink-0" />
          <div className="overflow-hidden">
            <div className="font-bold truncate">{track.title}</div>
            <div className="text-sm text-gray-400 truncate">{track.artist}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold transition shrink-0"
        >
          <X size={20} /> Закрыть и вернуться к игре
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
          <iframe
            src={src}
            title={`${track.artist} — ${track.title}`}
            className="w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>

      <div className="pb-6 text-center text-sm text-gray-500 shrink-0">
        {start > 0
          ? <>Продолжили с {Math.floor(start / 60)}:{String(start % 60).padStart(2, '0')} · закрой окно, чтобы вернуться к туру</>
          : <>Играет с начала песни · закрой окно, чтобы вернуться к туру</>}
      </div>
    </div>
  );
}
