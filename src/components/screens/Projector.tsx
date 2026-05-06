import { PartyPopper, Minimize } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black text-white z-[100] flex flex-col items-center justify-center animate-in fade-in duration-500 group overflow-hidden">
      {autoWinners.length > 0 && (
        <div className="absolute top-10 flex items-center gap-4 bg-green-600 text-white px-10 py-4 rounded-full font-black text-4xl shadow-[0_0_80px_rgba(34,197,94,0.8)] z-[200] animate-bounce border-4 border-white">
          <PartyPopper size={40} /> БИНГО У КАРТОЧЕК: {autoWinners.join(', ')}!
        </div>
      )}
      <button onClick={() => setIsProjectorMode(false)} className="absolute top-8 right-8 p-4 bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-all text-white z-50"><Minimize size={32} /></button>
      <div className="text-center">
         <img src={currentTrack?.cover} className={`w-[45vh] h-[45vh] mx-auto rounded-[3rem] mb-10 transition-all duration-700 ${hideTrackInfo ? 'blur-[80px] scale-90 opacity-50' : 'shadow-[0_0_100px_rgba(139,92,246,0.3)]'}`} />
         <h1 className={`text-7xl font-black mb-4 transition-all duration-500 ${hideTrackInfo ? 'text-gray-800 blur-sm' : 'text-white'}`}>{hideTrackInfo ? 'Угадай трек!' : currentTrack?.title}</h1>
         <p className={`text-4xl transition-all duration-500 ${hideTrackInfo ? 'text-gray-900 blur-sm' : 'text-purple-400 font-bold'}`}>{hideTrackInfo ? 'Исполнитель' : currentTrack?.artist}</p>
      </div>
    </div>
  );
}