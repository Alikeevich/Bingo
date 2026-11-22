import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Scissors, RotateCcw } from 'lucide-react';

interface AudioTrimmerProps {
  src: string;
  /** Секунды от 0. 0 = с самого начала. */
  start: number;
  /** Секунды от 0. 0 или > длительности = до конца. */
  end: number;
  onChange: (start: number, end: number) => void;
}

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

export default function AudioTrimmer({ src, start, end, onChange }: AudioTrimmerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const barRef   = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent]   = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // эффективный конец: если end<=0 или > длительности — считаем "до конца"
  const effectiveEnd = end > 0 && duration > 0 ? Math.min(end, duration) : duration;
  const segLen = Math.max(0, effectiveEnd - start);

  useEffect(() => {
    setDuration(0);
    setCurrent(0);
    setIsPlaying(false);
    setPreviewMode(false);
  }, [src]);

  // ── управление воспроизведением ───────────────────────────────────────
  const togglePlay = () => {
    const a = audioRef.current; if (!a) return;
    setPreviewMode(false);
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const playPreview = () => {
    const a = audioRef.current; if (!a || duration === 0) return;
    a.currentTime = start;
    setPreviewMode(true);
    a.play().catch(() => {});
  };

  // ── установка точек из текущей позиции ───────────────────────────────
  const setStartFromCurrent = () => {
    const s = Math.min(current, effectiveEnd - 0.5);
    onChange(Math.max(0, s), end);
  };
  const setEndFromCurrent = () => {
    const e = Math.max(current, start + 0.5);
    onChange(start, Math.min(duration, e));
  };
  const resetSegment = () => onChange(0, 0);

  // ── drag маркеров на полосе ──────────────────────────────────────────
  const startDrag = (which: 'start' | 'end', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const bar = barRef.current; if (!bar || duration === 0) return;
    const rect = bar.getBoundingClientRect();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const update = (clientX: number) => {
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const t = (x / rect.width) * duration;
      if (which === 'start') onChange(Math.max(0, Math.min(t, effectiveEnd - 0.5)), end);
      else                   onChange(start, Math.max(start + 0.5, Math.min(duration, t)));
    };

    update(e.clientX);
    const move = (ev: PointerEvent) => update(ev.clientX);
    const up = (ev: PointerEvent) => {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(ev.pointerId); } catch {}
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup',   up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup',   up);
  };

  // ── клик по полосе вне маркеров — сикаем плеер ───────────────────────
  const seekFromBar = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.marker) return; // клик попал по маркеру
    const a = audioRef.current; const bar = barRef.current;
    if (!a || !bar || duration === 0) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    a.currentTime = (x / rect.width) * duration;
  };

  // ── рендер ────────────────────────────────────────────────────────────
  const pct = (t: number) => duration > 0 ? `${(t / duration) * 100}%` : '0%';

  return (
    <div className="bg-pult-bg border border-white/[0.08] rounded-xl p-3 space-y-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrent(t);
          if (previewMode && t >= effectiveEnd) {
            e.currentTarget.pause();
            setPreviewMode(false);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setPreviewMode(false); }}
      />

      {/* Header: play + время */}
      <div className="flex items-center gap-3">
        <button onClick={togglePlay} type="button"
          className="w-9 h-9 rounded-full bg-lime hover:bg-[#d4ff63] flex items-center justify-center transition-colors text-[#141415]">
          {isPlaying ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
        </button>
        <div className="text-xs text-pult-text font-mono">{fmt(current)} / {fmt(duration)}</div>
        <button onClick={resetSegment} type="button" title="Сбросить фрагмент"
          className="ml-auto p-1.5 text-pult-muted hover:text-white hover:bg-pult-raised rounded-lg transition-colors">
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Полоса прогресса с маркерами */}
      <div ref={barRef} onClick={seekFromBar}
        className="relative h-9 bg-pult-raised rounded-lg overflow-visible select-none cursor-pointer">
        {/* выделенный фрагмент */}
        {duration > 0 && (
          <div className="absolute top-0 bottom-0 bg-lime/40 rounded-lg pointer-events-none"
               style={{ left: pct(start), width: `calc(${pct(effectiveEnd - start)})` }} />
        )}
        {/* играющая позиция */}
        {duration > 0 && (
          <div className="absolute top-0 bottom-0 w-px bg-white pointer-events-none"
               style={{ left: pct(current) }} />
        )}
        {/* маркер старта */}
        <div data-marker="start" onPointerDown={(e) => startDrag('start', e)}
          className="absolute -top-1 -bottom-1 w-3 -ml-1.5 bg-green-500 rounded cursor-ew-resize hover:bg-green-400 transition-colors flex items-center justify-center"
          style={{ left: pct(start) }} title="Начало фрагмента (тяни)">
          <div className="w-0.5 h-3 bg-green-900/60 rounded-full pointer-events-none" />
        </div>
        {/* маркер конца */}
        <div data-marker="end" onPointerDown={(e) => startDrag('end', e)}
          className="absolute -top-1 -bottom-1 w-3 -ml-1.5 bg-red-500 rounded cursor-ew-resize hover:bg-red-400 transition-colors flex items-center justify-center"
          style={{ left: pct(effectiveEnd) }} title="Конец фрагмента (тяни)">
          <div className="w-0.5 h-3 bg-red-900/60 rounded-full pointer-events-none" />
        </div>
      </div>

      {/* «Установить от текущей» */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 bg-pult-raised/60 rounded-lg px-2 py-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <span className="text-pult-text2 shrink-0">Старт</span>
          <span className="font-mono text-white">{fmt(start)}</span>
          <button onClick={setStartFromCurrent} type="button"
            className="ml-auto px-2 py-0.5 bg-[#2b2b2e] hover:bg-[#2b2b2e] rounded text-[10px] tracking-wide font-medium transition-colors">
            ← текущая
          </button>
        </div>
        <div className="flex items-center gap-2 bg-pult-raised/60 rounded-lg px-2 py-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span className="text-pult-text2 shrink-0">Конец</span>
          <span className="font-mono text-white">{fmt(effectiveEnd)}</span>
          <button onClick={setEndFromCurrent} type="button"
            className="ml-auto px-2 py-0.5 bg-[#2b2b2e] hover:bg-[#2b2b2e] rounded text-[10px] tracking-wide font-medium transition-colors">
            ← текущая
          </button>
        </div>
      </div>

      <button onClick={playPreview} type="button" disabled={duration === 0 || segLen < 0.3}
        className="w-full bg-pult-raised hover:bg-[#d4ff63] hover:text-[#141415] disabled:opacity-50 disabled:hover:bg-pult-raised disabled:hover:text-pult-text py-2 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 text-pult-text">
        <Scissors size={14} /> Прослушать фрагмент ({fmt(segLen)})
      </button>
    </div>
  );
}
