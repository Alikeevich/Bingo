import { useState } from 'react';
import { 
  PartyPopper, MonitorPlay, CheckCircle2, Power, Music, EyeOff, Eye, 
  SkipBack, SkipForward, PauseCircle, Play, ListChecks, Shuffle, Loader2, Trophy, SearchCheck
} from 'lucide-react';
import { Track, Game, Round, Playlist, BingoCard } from '../../types';
import { formatTime } from '../../utils';

interface HostScreenProps {
  hostSession: { game: Game; round: Round; playlist: Playlist };
  shuffledTracks: Track[];
  playedTrackIds: Set<string | number>;
  currentHostTrackIndex: number;
  hideTrackInfo: boolean;
  autoWinners: string[];
  playingTrackId: string | number | null;
  currentTime: number;
  duration: number;
  isAutoPlay: boolean;
  setIsAutoPlay: (val: boolean) => void;
  setHideTrackInfo: (val: boolean) => void;
  setIsProjectorMode: (val: boolean) => void;
  playHostTrack: (index: number) => void;
  endHostSession: () => void;
  reshuffleTracks: () => void;
  setAutoWinners: (val: string[]) => void;
  togglePlay: (track: Track) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

export default function HostScreen(props: HostScreenProps) {
  const[isBingoVerifyModalOpen, setIsBingoVerifyModalOpen] = useState(false);
  const[verifyCardId, setVerifyCardId] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ card: BingoCard; matches: boolean[]; linesCount: number; isWinner: boolean; } | null>(null);

  const currentTrack = props.shuffledTracks[props.currentHostTrackIndex];
  const isPlaying = props.playingTrackId === currentTrack?.id;

  const handleVerifyCard = () => {
    if (!verifyCardId.trim()) return;
    if (!props.hostSession?.round.cards?.length) return alert('В этом туре ещё не сгенерированы карточки!');
    const card = props.hostSession.round.cards.find(c => c.id === verifyCardId.trim());
    if (!card) return alert(`Карточка #${verifyCardId} не найдена!`);
    
    const matches = card.cells.map(cell => 'isFreeSpace' in cell ? true : props.playedTrackIds.has(cell.id));
    const linesIndices = [
      [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
      [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
      [0,6,12,18,24],[4,8,12,16,20]
    ];
    let linesCount = 0;
    linesIndices.forEach(line => { if (line.every(idx => matches[idx])) linesCount++; });
    
    const cond = props.hostSession.round.winCondition;
    const isWinner = (cond === '1_line' && linesCount >= 1) || (cond === '2_lines' && linesCount >= 2) || (cond === 'full' && matches.every(m => m));
    setVerifyResult({ card, matches, linesCount, isWinner });
  };

  return (
    <div className="fixed inset-0 bg-gray-950 text-white z-50 flex flex-col font-sans animate-in zoom-in-95 duration-300">
      <div className="h-20 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-8 shadow-xl relative z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg"><PartyPopper size={28} className="text-white" /></div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-wider">{props.hostSession.game.name}</h2>
            <p className="text-gray-400 text-sm font-medium">{props.hostSession.round.name} • {props.hostSession.round.winCondition === 'full' ? 'Бинго' : props.hostSession.round.winCondition === '2_lines' ? '2 Линии' : '1 Линия'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center mr-4">
            <div className="text-3xl font-black text-purple-400">{props.playedTrackIds.size} <span className="text-gray-600 text-xl">/ {props.shuffledTracks.length}</span></div>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Сыграно</div>
          </div>
          <div className="h-10 w-px bg-gray-800 mr-2" />
          <button onClick={() => props.setIsProjectorMode(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-lg"><MonitorPlay size={20} /> Проектор</button>
          <button onClick={() => { setVerifyCardId(''); setVerifyResult(null); setIsBingoVerifyModalOpen(true); }} className="bg-green-600 hover:bg-green-500 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-lg"><CheckCircle2 size={20} /> БИНГО!</button>
          <button onClick={props.endHostSession} className="p-3 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition ml-2"><Power size={24} /></button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 to-gray-950 overflow-hidden">
          {props.autoWinners.length > 0 && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-green-500 text-white px-8 py-3 rounded-full font-black text-2xl shadow-[0_0_50px_rgba(34,197,94,0.4)] z-[30] animate-bounce cursor-pointer" onClick={() => props.setAutoWinners([])}>
              <PartyPopper size={28} /> ЕСТЬ БИНГО: {props.autoWinners.join(', ')}!
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center p-6">
            {currentTrack && (
              <div className="w-full flex flex-col items-center">
                <div className={`relative w-72 h-72 md:w-80 md:h-80 rounded-3xl overflow-hidden shadow-2xl mb-8 transition-all duration-700 ${isPlaying ? 'scale-105 shadow-purple-900/40' : ''}`}>
                  <img src={currentTrack.cover} alt="cover" className={`w-full h-full object-cover transition-all duration-500 ${props.hideTrackInfo ? 'blur-3xl scale-110 opacity-60' : ''}`} />
                  {props.hideTrackInfo && <div className="absolute inset-0 flex items-center justify-center"><Music size={100} className="text-white/20" /></div>}
                </div>
                <div className="text-center mb-4">
                  <h1 className={`text-4xl font-black mb-2 transition-all duration-300 ${props.hideTrackInfo ? 'text-gray-700 blur-sm select-none' : 'text-white'}`}>
                    {props.hideTrackInfo ? 'Угадай трек' : currentTrack.title}
                  </h1>
                  <p className={`text-xl transition-all duration-300 ${props.hideTrackInfo ? 'text-gray-800 blur-sm select-none' : 'text-purple-400 font-medium'}`}>
                    {props.hideTrackInfo ? 'Исполнитель' : currentTrack.artist}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="w-full bg-gray-900/60 backdrop-blur-xl border-t border-gray-800 p-8 shrink-0">
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 w-12">{formatTime(props.currentTime)}</span>
                  <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden relative mx-4">
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-300 ease-linear" style={{ width: `${props.duration ? (props.currentTime / props.duration) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-500 w-12 text-right">{formatTime(props.duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="w-48">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`relative w-12 h-6 transition-all duration-300 rounded-full ${props.isAutoPlay ? 'bg-purple-600' : 'bg-gray-800 border border-gray-700'}`}>
                      <div className={`absolute top-[3px] w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${props.isAutoPlay ? 'translate-x-7' : 'translate-x-1'}`} />
                    </div>
                    <input type="checkbox" checked={props.isAutoPlay} onChange={e => props.setIsAutoPlay(e.target.checked)} className="hidden" />
                    <span className={`text-xs font-black uppercase tracking-widest transition-colors ${props.isAutoPlay ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-400'}`}>Авто-ход</span>
                  </label>
                </div>
                <div className="flex items-center gap-6">
                  <button onClick={() => props.setHideTrackInfo(!props.hideTrackInfo)} className={`w-14 h-14 rounded-full flex items-center justify-center transition ${props.hideTrackInfo ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                    {props.hideTrackInfo ? <EyeOff size={24} /> : <Eye size={24} />}
                  </button>
                  <button onClick={() => props.playHostTrack(props.currentHostTrackIndex - 1)} disabled={props.currentHostTrackIndex === 0} className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center text-white hover:bg-gray-700 disabled:opacity-30 transition"><SkipBack size={28} /></button>
                  <button
                    onClick={() => {
                      if (isPlaying) { 
                        props.togglePlay(currentTrack); 
                      } else { 
                        props.playHostTrack(props.currentHostTrackIndex); 
                      }
                    }}
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition transform hover:scale-105 shadow-2xl ${isPlaying ? 'bg-orange-600 shadow-orange-900/40' : 'bg-purple-600 shadow-purple-900/40'}`}
                  >
                    {isPlaying ? <PauseCircle size={44} /> : <Play size={44} className="ml-1" />}
                  </button>
                  <button onClick={() => { props.playHostTrack(props.currentHostTrackIndex + 1); props.setHideTrackInfo(true); }} disabled={props.currentHostTrackIndex === props.shuffledTracks.length - 1} className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center text-white hover:bg-gray-700 disabled:opacity-30 transition"><SkipForward size={28} /></button>
                  <div className="w-14" />
                </div>
                <div className="w-48 text-right">
                   <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">Осталось</span>
                   <span className="text-xl font-black text-gray-400">{props.shuffledTracks.length - props.playedTrackIds.size}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-[400px] bg-gray-900 border-l border-gray-800 flex flex-col z-10 shrink-0">
          <div className="p-6 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3"><ListChecks className="text-purple-400" /><h3 className="text-lg font-bold">Очередь</h3></div>
            <button onClick={props.reshuffleTracks} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition"><Shuffle size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
            {props.shuffledTracks.map((track, index) => {
              const isPlayed = props.playedTrackIds.has(track.id);
              const isCurrent = props.currentHostTrackIndex === index;
              return (
                <button key={track.id} onClick={() => { props.playHostTrack(index); props.setHideTrackInfo(true); }} className={`w-full text-left p-3 rounded-xl flex items-center gap-4 transition border ${isCurrent ? 'bg-purple-900/30 border-purple-500 shadow-lg' : isPlayed ? 'bg-gray-900 border-gray-800 opacity-50 grayscale' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                  <div className="w-6 font-bold text-center text-xs text-gray-500">{index + 1}</div>
                  <img src={track.cover} className="w-10 h-10 rounded-lg object-cover" alt="" />
                  <div className="flex-1 overflow-hidden">
                    <div className={`font-bold truncate text-sm ${isCurrent ? 'text-purple-400' : 'text-white'}`}>{track.title}</div>
                    <div className="text-[11px] text-gray-500 truncate">{track.artist}</div>
                  </div>
                  {isCurrent && isPlaying && <Loader2 size={16} className="text-purple-400 animate-spin" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isBingoVerifyModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className={`bg-gray-900 p-8 rounded-3xl w-full border border-gray-800 text-center animate-in zoom-in-95 ${verifyResult ? 'max-w-xl' : 'max-w-md'}`}>
            {!verifyResult ? (
              <>
                <Trophy size={64} className="mx-auto text-yellow-500 mb-6" />
                <h2 className="text-3xl font-black mb-2">ПРОВЕРКА БИНГО</h2>
                <input autoFocus type="text" value={verifyCardId} onChange={e => setVerifyCardId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerifyCard()} placeholder="#ID (напр. 1042)" className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-4 px-6 text-2xl font-black text-center text-white mb-6 focus:border-purple-500 outline-none uppercase tracking-widest" />
                <div className="flex gap-4">
                  <button onClick={() => setIsBingoVerifyModalOpen(false)} className="flex-1 py-4 bg-gray-800 rounded-xl font-bold hover:bg-gray-700 transition">Отмена</button>
                  <button onClick={handleVerifyCard} className="flex-1 py-4 bg-green-600 rounded-xl font-bold hover:bg-green-500 transition text-white flex items-center justify-center gap-2"><SearchCheck size={24} /> Проверить</button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-6 pb-6 border-b border-gray-800">
                  <div className="text-left">
                    <div className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-1">Карточка #{verifyResult.card.id}</div>
                    <div className="text-xl font-black">Линий: <span className={verifyResult.linesCount > 0 ? 'text-purple-400' : 'text-gray-500'}>{verifyResult.linesCount}</span></div>
                  </div>
                  {verifyResult.isWinner ? <div className="px-4 py-2 bg-green-500/20 text-green-400 rounded-xl font-black text-2xl flex items-center gap-2 animate-pulse"><CheckCircle2 /> БИНГО!</div> : <div className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl font-bold text-lg">Нет Бинго</div>}
                </div>
                <div className="grid grid-cols-5 gap-2 mb-8 w-full max-w-[400px]">
                  {verifyResult.card.cells.map((cell: any, i: number) => (
                    <div key={i} className={`aspect-square rounded-xl flex flex-col items-center justify-center p-1 border-2 ${verifyResult.matches[i] ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                      {'isFreeSpace' in cell ? <span className="font-black text-xs uppercase">FREE</span> : <span className="font-bold text-[8px] leading-tight text-center line-clamp-3">{(cell as Track).title}</span>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 w-full">
                  <button onClick={() => setIsBingoVerifyModalOpen(false)} className="flex-1 py-4 bg-gray-800 rounded-xl font-bold hover:bg-gray-700 transition">Закрыть</button>
                  <button onClick={() => { setVerifyCardId(''); setVerifyResult(null); }} className="flex-1 py-4 bg-purple-600 rounded-xl font-bold hover:bg-purple-500 transition text-white">Другая</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}