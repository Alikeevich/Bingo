import { useState } from 'react';
import { 
  PartyPopper, MonitorPlay, CheckCircle2, Power, Music, EyeOff, Eye,
  SkipBack, SkipForward, PauseCircle, Play, ListChecks, Loader2, Trophy, SearchCheck, Plus, X, AudioLines
} from 'lucide-react';
import { FadeSettings, FADE_MAX_SEC, FADE_STEP_SEC } from '../../lib/fade';
import { Track, Game, Round, Playlist, BingoCard } from '../../types';
import { formatTime, buildCellMatcher } from '../../utils';
import { evaluateCard, findCardByNumber } from '../../lib/cardBuilder';

interface HostScreenProps {
  hostSession: { game: Game; round: Round; playlist: Playlist };
  shuffledTracks: Track[];
  playedTrackIds: Set<string>;
  currentHostTrackIndex: number;
  hideTrackInfo: boolean;
  autoWinners: string[];
  playingTrackId: string | number | null;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  isAutoPlay: boolean;
  setIsAutoPlay: (val: boolean) => void;
  setHideTrackInfo: (val: boolean) => void;
  setIsProjectorMode: (val: boolean) => void;
  playHostTrack: (index: number) => void;
  endHostSession: () => void;
  setAutoWinners: (val: string[]) => void;
  togglePlay: (track: Track) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  /** Плавное появление / затухание звука, секунды 0–5 */
  fade: FadeSettings;
  setFade: (next: FadeSettings) => void;
  extendCurrentTrack: (seconds?: number) => void;
  playFullVersion: () => void;
  /** Границы играющего фрагмента в секундах. end === 0 — играем до конца файла. */
  segment: { start: number; end: number };
  /** true — ведущий включил полную версию, ограничение фрагмента снято */
  isFullMode: boolean;
  /** Прогресс подготовки ссылок перед игрой (null — подготовка завершена) */
  prewarm: { done: number; total: number } | null;
}

export default function HostScreen(props: HostScreenProps) {
  const[isBingoVerifyModalOpen, setIsBingoVerifyModalOpen] = useState(false);
  const[verifyCardId, setVerifyCardId] = useState('');
  const [isFadeOpen, setIsFadeOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ card: BingoCard; matches: boolean[]; linesCount: number; isWinner: boolean; } | null>(null);

  const currentTrack = props.shuffledTracks[props.currentHostTrackIndex];
  const isTrackLoaded = props.playingTrackId === currentTrack?.id;  // трек загружен (играет ИЛИ на паузе)
  const isPlaying = isTrackLoaded && !props.isPaused;               // реально играет прямо сейчас
  // Полная версия доступна, если для трека загружен свой MP3 (играет офлайн,
  // позиция известна точно — поэтому «Продолжить» попадает ровно в то же место)
  const hasFullVersion = !!(currentTrack?.mp3Path || currentTrack?.isCustom);

  // Таймлайн показываем ПО ФРАГМЕНТУ, а не по всему файлу: у полных MP3 длительность
  // файла 3-4 минуты, а в игре звучит только вырезанный кусок — ведущему важно
  // видеть, сколько осталось именно до конца фрагмента.
  const segStart = props.segment.start > 0 ? props.segment.start : 0;
  const segEnd   = props.segment.end   > 0 ? props.segment.end   : props.duration;
  const segLength = Math.max(0, segEnd - segStart);
  const segPos = Math.min(segLength, Math.max(0, props.currentTime - segStart));
  const progressPct = segLength > 0 ? (segPos / segLength) * 100 : 0;
  const segLeft = Math.max(0, segLength - segPos);
  // Играем ли урезанный кусок (есть смысл показать «фрагмент из N:NN»)
  const isTrimmed = !props.isFullMode && (props.segment.start > 0 || props.segment.end > 0);

  const handleVerifyCard = () => {
    if (!verifyCardId.trim()) return;
    if (!props.hostSession?.round.cards?.length) return alert('В этом туре ещё не сгенерированы карточки');
    const card = findCardByNumber(props.hostSession.round.cards, verifyCardId);
    if (!card) return alert(`Карточка #${verifyCardId} не найдена`);
    
    const matches = card.cells.map(buildCellMatcher(props.shuffledTracks, props.playedTrackIds));
    const { linesCount, isWinner } = evaluateCard(matches, props.hostSession.round.winCondition);
    setVerifyResult({ card, matches, linesCount, isWinner });
  };

  return (
    <div className="fixed inset-0 bg-pult-bg text-white z-50 flex flex-col font-sans duration-300">
      <div className="h-16 bg-pult-deep border-b border-white/[0.08] flex items-center justify-between px-6 relative z-20 shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-pult-text truncate">{props.hostSession.game.name}</h2>
          <p className="text-sm text-pult-text2 truncate">{props.hostSession.round.name} · {props.hostSession.round.winCondition === 'full' ? 'вся карточка' : props.hostSession.round.winCondition === '3_lines' ? '3 линии' : props.hostSession.round.winCondition === '2_lines' ? '2 линии' : '1 линия'}</p>
        </div>
        <div className="flex items-center gap-3">
          {props.prewarm && (
            <span className="inline-flex items-center gap-2 text-sm text-pult-text2" title="Обновляем ссылки на треки, чтобы во время игры не было пауз">
              <Loader2 size={14} className="animate-spin text-pult-muted" />
              Готовим треки <span className="font-mono tabular-nums text-pult-muted">{props.prewarm.done}/{props.prewarm.total}</span>
            </span>
          )}
          {/* Расписание побед: карточки знают, на какой песне закроются (winAt) */}
          {(() => {
            const next = (props.hostSession.round.cards || [])
              .filter(c => typeof c.winAt === 'number' && c.winAt >= props.currentHostTrackIndex)
              .sort((a, b) => (a.winAt as number) - (b.winAt as number))[0];
            if (!next) return null;
            return (
              <span className="text-sm text-pult-text2" title="Расчёт по сгенерированным карточкам и порядку очереди">
                ближайшее бинго: <span className="font-mono tabular-nums text-pult-text">#{next.id}</span> на песне № <span className="font-mono tabular-nums text-pult-text">{(next.winAt as number) + 1}</span>
              </span>
            );
          })()}
          {/* Табло: номер звучащей песни — фирменная деталь пульта */}
          <div className="ml-2 px-3 h-10 rounded-lg bg-pult-card border border-white/[0.08] flex items-center gap-2" title={`Сыграно ${props.playedTrackIds.size} из ${props.shuffledTracks.length}`}>
            <span className="text-sm text-pult-muted">песня</span>
            <span className="text-lg text-lime">№ <span className="font-mono tabular-nums">{props.currentHostTrackIndex + 1}</span></span>
            <span className="font-mono text-sm tabular-nums text-pult-muted">/ {props.shuffledTracks.length}</span>
          </div>
          <button onClick={() => props.setIsProjectorMode(true)} className="h-10 px-4 rounded-lg text-sm font-medium inline-flex items-center gap-2 bg-pult-raised text-pult-text border border-white/[0.06] hover:bg-[#2b2b2e] transition-colors"><MonitorPlay size={16} /> Проектор</button>
          <button onClick={() => { setVerifyCardId(''); setVerifyResult(null); setIsBingoVerifyModalOpen(true); }} className="h-10 px-4 rounded-lg text-sm font-medium inline-flex items-center gap-2 bg-magenta text-white hover:bg-[#ff4b98] transition-colors"><CheckCircle2 size={16} /> Проверить бинго</button>
          <button onClick={props.endHostSession} title="Завершить тур" className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-pult-muted hover:text-red-400 hover:bg-white/[0.04] transition-colors"><Power size={18} /></button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col relative bg-pult-bg overflow-hidden">
          {props.autoWinners.length > 0 && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[30] flex items-center gap-4 rounded-xl bg-magenta text-white pl-5 pr-2 h-14">
              <PartyPopper size={22} />
              <span className="text-lg font-medium">Бинго у карточек <span className="font-mono tabular-nums">{props.autoWinners.map(w => '#' + w).join(', ')}</span></span>
              <button onClick={() => props.setAutoWinners([])} title="Скрыть" className="h-10 w-10 inline-flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors"><X size={18} /></button>
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center p-6">
            {currentTrack && (
              <div className="w-full flex flex-col items-center">
                {/* Обложка — главный момент экрана: крупно, с нейтральной тенью */}
                <div className="relative w-72 h-72 md:w-80 md:h-80 rounded-2xl overflow-hidden mb-8 bg-pult-card shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
                  <img src={currentTrack.cover} alt="" className={`w-full h-full object-cover transition-[filter,opacity] duration-500 ${props.hideTrackInfo ? 'blur-2xl opacity-50' : ''}`} />
                  {props.hideTrackInfo && <div className="absolute inset-0 flex items-center justify-center"><Music size={72} className="text-white/25" /></div>}
                </div>
                <div className="text-center mb-4 min-h-[76px]">
                  <h1 className={`text-3xl font-medium mb-2 ${props.hideTrackInfo ? 'text-pult-muted' : 'text-pult-text'}`}>
                    {props.hideTrackInfo ? 'Название скрыто' : currentTrack.title}
                  </h1>
                  <p className={`text-lg ${props.hideTrackInfo ? 'text-pult-muted/70' : 'text-pult-text2'}`}>
                    {props.hideTrackInfo ? 'нажми на глаз, чтобы открыть' : currentTrack.artist}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="w-full bg-pult-card border-t border-white/[0.08] px-8 py-6 shrink-0">
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs tabular-nums text-pult-muted w-12">{formatTime(segPos)}</span>
                  <div className="flex-1 h-1.5 bg-pult-raised rounded-full overflow-hidden relative mx-4">
                    <div
                      className={`absolute top-0 left-0 h-full ${props.isFullMode ? 'bg-pult-text' : 'bg-lime'}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-pult-muted w-12 text-right">{formatTime(segLength)}</span>
                </div>
                {/* Подпись под шкалой: что именно сейчас звучит и сколько осталось */}
                <div className="flex items-center justify-between text-xs -mt-2">
                  <span className={props.isFullMode ? 'text-pult-text' : 'text-pult-muted'}>
                    {props.isFullMode
                      ? 'Полная версия — играет до конца песни'
                      : isTrimmed
                        ? `Фрагмент ${formatTime(segStart)}–${formatTime(segEnd)} из ${formatTime(props.duration)}`
                        : 'Трек целиком'}
                  </span>
                  {isTrackLoaded && segLength > 0 && (
                    <span className="text-pult-muted">осталось <span className="font-mono tabular-nums">{formatTime(segLeft)}</span></span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="w-48">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`relative w-12 h-6 transition-colors duration-300 rounded-full ${props.isAutoPlay ? 'bg-lime' : 'bg-pult-raised border border-white/[0.08]'}`}>
                      <div className={`absolute top-[3px] w-4 h-4 rounded-full transition-transform duration-200 ${props.isAutoPlay ? 'translate-x-7 bg-[#141415]' : 'translate-x-1 bg-pult-text2'}`} />
                    </div>
                    <input type="checkbox" checked={props.isAutoPlay} onChange={e => props.setIsAutoPlay(e.target.checked)} className="hidden" />
                    <span className={`text-sm transition-colors ${props.isAutoPlay ? 'text-pult-text' : 'text-pult-muted group-hover:text-pult-text2'}`}>Авто-ход</span>
                  </label>
                  {/* Плавность звука: по клику всплывает панель с двумя ползунками */}
                  <div className="relative mt-3">
                    <button
                      onClick={() => setIsFadeOpen(o => !o)}
                      title="Плавное появление и затухание звука"
                      className={`h-8 px-2.5 -ml-2.5 rounded-md text-sm inline-flex items-center gap-2 transition-colors ${isFadeOpen ? 'bg-pult-raised text-pult-text' : 'text-pult-text2 hover:text-pult-text hover:bg-white/[0.04]'}`}
                    >
                      <AudioLines size={16} className={props.fade.inSec > 0 || props.fade.outSec > 0 ? 'text-lime' : ''} />
                      Плавность
                      <span className="font-mono text-xs tabular-nums text-pult-muted">{props.fade.inSec}с / {props.fade.outSec}с</span>
                    </button>
                    {isFadeOpen && (
                      <>
                        <div className="fixed inset-0 z-[40]" onClick={() => setIsFadeOpen(false)} />
                        <div className="absolute bottom-full left-0 mb-2 z-[41] w-72 rounded-xl bg-pult-raised border border-white/[0.08] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
                          {([['inSec', 'Появление (fade in)'], ['outSec', 'Затухание (fade out)']] as const).map(([key, label]) => (
                            <div key={key} className="mb-4 last:mb-0">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-pult-text">{label}</span>
                                <span className="font-mono text-sm tabular-nums text-lime">{props.fade[key] === 0 ? 'выкл' : `${props.fade[key]} с`}</span>
                              </div>
                              <input
                                type="range" min={0} max={FADE_MAX_SEC} step={FADE_STEP_SEC}
                                value={props.fade[key]}
                                onChange={e => props.setFade({ ...props.fade, [key]: Number(e.target.value) })}
                                className="w-full accent-lime cursor-pointer"
                              />
                            </div>
                          ))}
                          <p className="text-xs text-pult-muted leading-snug">Затухание срабатывает сразу, появление — со следующего трека. Отсчёт от границ фрагмента.</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <button onClick={() => props.setHideTrackInfo(!props.hideTrackInfo)} title={props.hideTrackInfo ? 'Показать название' : 'Скрыть название'} className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors ${props.hideTrackInfo ? 'bg-pult-raised border-white/[0.06] text-pult-text2 hover:text-pult-text' : 'bg-pult-raised border-lime/50 text-lime'}`}>
                    {props.hideTrackInfo ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                  <button onClick={() => props.playHostTrack(props.currentHostTrackIndex - 1)} disabled={props.currentHostTrackIndex === 0} className="w-12 h-12 bg-pult-raised border border-white/[0.06] rounded-full flex items-center justify-center text-pult-text hover:bg-[#2b2b2e] disabled:opacity-30 transition-colors"><SkipBack size={20} /></button>
                  <button
                    onClick={() => {
                      // Если трек уже загружен (играет ИЛИ на паузе) — togglePlay сам решит pause/resume,
                      // resume продолжит с той же секунды. Только для нового трека грузим заново.
                      if (isTrackLoaded) {
                        props.togglePlay(currentTrack);
                      } else {
                        props.playHostTrack(props.currentHostTrackIndex);
                      }
                    }}
                    title={isPlaying ? 'Пауза' : 'Играть'}
                    className="w-16 h-16 rounded-full flex items-center justify-center bg-lime text-[#141415] hover:bg-[#d4ff63] active:scale-[0.97] transition-[transform,background-color]"
                  >
                    {isPlaying ? <PauseCircle size={32} /> : <Play size={30} className="ml-1" />}
                  </button>
                  <button onClick={() => { props.playHostTrack(props.currentHostTrackIndex + 1); props.setHideTrackInfo(true); }} disabled={props.currentHostTrackIndex === props.shuffledTracks.length - 1} className="w-12 h-12 bg-pult-raised border border-white/[0.06] rounded-full flex items-center justify-center text-pult-text hover:bg-[#2b2b2e] disabled:opacity-30 transition-colors"><SkipForward size={20} /></button>
                  <button
                    onClick={() => props.extendCurrentTrack(10)}
                    disabled={!isTrackLoaded || props.isFullMode}
                    title={
                      props.isFullMode
                        ? 'Уже играет полная версия — продлевать нечего'
                        : 'Продлить фрагмент на 10 секунд'
                    }
                    className="w-12 h-12 bg-pult-raised border border-white/[0.06] rounded-full flex items-center justify-center gap-0.5 text-pult-text hover:bg-[#2b2b2e] disabled:opacity-30 transition-colors"
                  >
                    <Plus size={12} />
                    <span className="font-mono text-xs tabular-nums">10с</span>
                  </button>
                  {/* Полная версия — когда зал подпевает: свой MP3 доигрывает целиком, офлайн */}
                  <button
                    onClick={props.playFullVersion}
                    disabled={!isTrackLoaded || !hasFullVersion || props.isFullMode}
                    title={
                      props.isFullMode
                        ? 'Полная версия уже играет'
                        : hasFullVersion
                          ? 'Доиграть песню целиком, точно с этого места (работает офлайн)'
                          : 'У этого трека нет полной версии — загрузи MP3 во вкладке «Миграция MP3»'
                    }
                    className={`h-12 px-4 rounded-full flex items-center gap-2 border transition-colors disabled:opacity-40 ${
                      props.isFullMode
                        ? 'bg-pult-raised border-lime/50 text-lime'
                        : 'bg-pult-raised border-white/[0.06] text-pult-text hover:bg-[#2b2b2e]'
                    }`}
                  >
                    <Music size={18} />
                    <span className="text-sm whitespace-nowrap">
                      {props.isFullMode ? 'Играет' : 'Полная'}
                    </span>
                  </button>
                </div>
                <div className="w-48 text-right">
                   <span className="text-sm text-pult-muted">осталось песен </span>
                   <span className="font-mono text-lg tabular-nums text-pult-text">{props.shuffledTracks.length - props.playedTrackIds.size}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-[400px] bg-pult-card border-l border-white/[0.08] flex flex-col z-10 shrink-0">
          <div className="h-14 px-5 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2"><ListChecks size={16} className="text-pult-muted" /><h3 className="text-sm font-medium text-pult-text">Очередь</h3></div>
            <span className="font-mono text-xs tabular-nums text-pult-muted">сыграно {props.playedTrackIds.size} / {props.shuffledTracks.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar flex flex-col gap-0.5">
            {props.shuffledTracks.map((track, index) => {
              const isPlayed = props.playedTrackIds.has(String(track.id));
              const isCurrent = props.currentHostTrackIndex === index;
              return (
                <button key={track.id} onClick={() => { props.playHostTrack(index); props.setHideTrackInfo(true); }} className={`w-full text-left h-14 px-3 rounded-lg flex items-center gap-3 transition-colors ${isCurrent ? 'bg-pult-raised shadow-[inset_2px_0_0_#C9FF3B]' : isPlayed ? 'opacity-45 hover:opacity-70' : 'hover:bg-white/[0.03]'}`}>
                  <div className="w-7 font-mono text-xs tabular-nums text-right text-pult-muted">{index + 1}</div>
                  <img src={track.cover} className={`w-10 h-10 rounded-md object-cover bg-pult-raised ${isPlayed && !isCurrent ? 'grayscale' : ''}`} alt="" />
                  <div className="flex-1 overflow-hidden">
                    <div className={`truncate text-sm ${isCurrent ? 'text-pult-text' : 'text-pult-text'}`}>{track.title}</div>
                    <div className="text-xs text-pult-text2 truncate">{track.artist}</div>
                  </div>
                  {isCurrent && isPlaying && <span className="w-2 h-2 rounded-full bg-lime" title="Играет" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isBingoVerifyModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4" onClick={() => setIsBingoVerifyModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} className={`bg-pult-card p-8 rounded-2xl w-full border border-white/[0.08] text-center ${verifyResult ? 'max-w-xl' : 'max-w-md'}`}>
            {!verifyResult ? (
              <>
                <Trophy size={32} className="mx-auto text-pult-muted mb-4" />
                <h2 className="text-xl font-medium mb-1">Проверка бинго</h2>
                <p className="text-sm text-pult-text2 mb-6">Номер карточки — в углу бланка</p>
                <input autoFocus type="text" inputMode="numeric" value={verifyCardId} onChange={e => setVerifyCardId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerifyCard()} placeholder="1042" className="w-full bg-pult-raised border border-white/[0.08] rounded-xl h-14 px-6 font-mono text-2xl tabular-nums text-center text-pult-text placeholder:text-pult-muted mb-6 focus:border-lime/60 outline-none" />
                <div className="flex gap-4">
                  <button onClick={() => setIsBingoVerifyModalOpen(false)} className="flex-1 py-4 bg-pult-raised rounded-xl font-medium hover:bg-[#2b2b2e] transition-colors">Отмена</button>
                  <button onClick={handleVerifyCard} className="flex-1 py-4 bg-lime rounded-xl font-medium hover:bg-[#d4ff63] transition-colors text-[#141415] flex items-center justify-center gap-2"><SearchCheck size={18} /> Проверить</button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-6 pb-6 border-b border-white/[0.08]">
                  <div className="text-left">
                    <div className="text-pult-text2 text-sm mb-1">Карточка <span className="font-mono tabular-nums">#{verifyResult.card.id}</span></div>
                    <div className="text-xl font-medium">Линий: <span className={verifyResult.linesCount > 0 ? 'text-lime' : 'text-pult-muted'}>{verifyResult.linesCount}</span></div>
                  </div>
                  {verifyResult.isWinner ? <div className="px-4 h-12 bg-magenta text-white rounded-xl font-medium text-xl flex items-center gap-2"><CheckCircle2 size={20} /> Бинго</div> : <div className="px-4 h-12 bg-pult-raised text-pult-text2 rounded-xl text-base flex items-center">Бинго нет</div>}
                </div>
                <div className="grid grid-cols-5 gap-2 mb-8 w-full max-w-[400px]">
                  {verifyResult.card.cells.map((cell: any, i: number) => (
                    <div key={i} className={`aspect-square rounded-lg flex flex-col items-center justify-center p-1 border ${verifyResult.matches[i] ? 'bg-lime/15 border-lime/60 text-pult-text' : 'bg-pult-raised border-white/[0.06] text-pult-muted'}`}>
                      {'isFreeSpace' in cell ? <span className="font-medium text-xs">FREE</span> : <span className="font-medium text-[8px] leading-tight text-center line-clamp-3">{(cell as Track).title}</span>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 w-full">
                  <button onClick={() => setIsBingoVerifyModalOpen(false)} className="flex-1 py-4 bg-pult-raised rounded-xl font-medium hover:bg-[#2b2b2e] transition-colors">Закрыть</button>
                  <button onClick={() => { setVerifyCardId(''); setVerifyResult(null); }} className="flex-1 py-4 bg-lime rounded-xl font-medium hover:bg-[#d4ff63] transition-colors text-[#141415]">Другая</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}