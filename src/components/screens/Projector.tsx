import { PartyPopper, Minimize, Music } from 'lucide-react';
import { Track } from '../../types';
import { useEffect } from 'react';

interface ProjectorProps {
  currentTrack?: Track;
  hideTrackInfo: boolean;
  autoWinners: string[];
  setIsProjectorMode: (val: boolean) => void;
  setHideTrackInfo: (val: boolean | ((prev: boolean) => boolean)) => void;
}

export default function Projector({ currentTrack, hideTrackInfo, autoWinners, setIsProjectorMode, setHideTrackInfo }: ProjectorProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsProjectorMode(false);
      if (e.code === 'Space') { e.preventDefault(); setHideTrackInfo(prev => !prev); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsProjectorMode, setHideTrackInfo]);

  return (
    <div className="fixed inset-0 bg-[#0b0b0c] text-pult-text z-[100] flex flex-col items-center justify-center group overflow-hidden">
      {/* Момент бинго — единственное место с маджентой */}
      {autoWinners.length > 0 && (
        <div className="absolute top-10 flex items-center gap-4 bg-magenta text-white px-10 h-20 rounded-2xl text-4xl font-medium z-[200]">
          <PartyPopper size={36} /> Бинго у карточек <span className="font-mono tabular-nums">{autoWinners.map(w => '#' + w).join(', ')}</span>
        </div>
      )}
      <button onClick={() => setIsProjectorMode(false)} title="Выйти из проектора (Esc)" className="absolute top-8 right-8 p-4 bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white z-50"><Minimize size={28} /></button>
      <div className="text-center">
        <div className="relative w-[45vh] h-[45vh] mx-auto mb-10 rounded-3xl overflow-hidden bg-pult-card shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
          {currentTrack?.cover && <img src={currentTrack.cover} alt="" className={`w-full h-full object-cover transition-[filter,opacity] duration-700 ${hideTrackInfo ? 'blur-[60px] opacity-50' : ''}`} />}
          {hideTrackInfo && <div className="absolute inset-0 flex items-center justify-center"><Music size={120} className="text-white/20" /></div>}
        </div>
        <h1 className={`text-7xl font-medium mb-4 ${hideTrackInfo ? 'text-pult-text2' : 'text-pult-text'}`}>{hideTrackInfo ? 'Угадай трек' : currentTrack?.title}</h1>
        <p className={`text-4xl min-h-[1.25em] ${hideTrackInfo ? 'invisible' : 'text-pult-text2'}`}>{currentTrack?.artist}</p>
      </div>
    </div>
  );
}
