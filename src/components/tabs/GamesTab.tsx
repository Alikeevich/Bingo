import { useState } from 'react';
import { supabase } from '../../supabase';
import { Game, Round, Playlist, Template, BingoCard, Track } from '../../types';
import { buildPlayQueue } from '../../utils';
import { winIndexForCard, buildCardForWinIndex, buildRandomCells, minWinIndex, maxWinIndex, Cells } from '../../lib/cardBuilder';
import { ChevronLeft, Calendar, Trash2, PlusCircle, ListMusic, LayoutTemplate, Play, Printer, HardDriveDownload, Loader2, Download } from 'lucide-react';
import { cacheTracks, isOfflineCacheReady } from '../../lib/offlineCache';

// Все 12 выигрышных линий в сетке 5×5 (строки, столбцы, 2 диагонали)
interface GamesTabProps {
  games: Game[];
  setGames: (val: Game[]) => void;
  playlists: Playlist[];
  dbTracks: Track[];
  templates: Template[];
  showToast: (msg: string, opts?: { sticky?: boolean }) => void;
  startHostSession: (game: Game, round: Round) => void;
  setPrintViewCards: (val: { cards: BingoCard[]; template: Template }) => void;
  /** Ссылка, которую реально играет плеер (свой MP3 / R2 / свежий Deezer) */
  resolveTrackUrl: (track: Track) => Promise<string | null>;
}

// 1 тур, 2 тура, 5 туров
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export default function GamesTab({ games, setGames, playlists, dbTracks, templates, showToast, startHostSession, setPrintViewCards, resolveTrackUrl }: GamesTabProps) {
  // Скачивание всей игры в офлайн-кэш: { этап, сделано, всего } или null
  const [gameOffline, setGameOffline] = useState<{ phase: string; done: number; total: number } | null>(null);

  // Одна кнопка вместо «Офлайн Кэш» в каждом плейлисте: берём очереди ВСЕХ туров
  // игры (тот же код, что играет тур), получаем реальные ссылки и отдаём их
  // Service Worker. Делать заранее, на хорошем интернете, а не в заведении.
  const cacheGameOffline = async (game: Game) => {
    if (!isOfflineCacheReady()) {
      showToast('Офлайн-режим ещё готовится. Обнови страницу (Ctrl+Shift+R) и нажми снова.');
      return;
    }
    const seen = new Set<string>();
    const tracks: Track[] = [];
    for (const r of game.rounds) {
      const pl = playlists.find(p => p.id === r.playlistId);
      for (const t of buildPlayQueue(pl?.tracks || [], dbTracks)) {
        if (seen.has(String(t.id))) continue;
        seen.add(String(t.id));
        tracks.push(t);
      }
    }
    if (tracks.length === 0) { showToast('В турах нет треков'); return; }

    try {
      // 1) свежие ссылки — по 4 параллельно, бережно к Deezer
      setGameOffline({ phase: 'Получаем ссылки', done: 0, total: tracks.length });
      const urls: string[] = [];
      let resolved = 0, missing = 0;
      for (let i = 0; i < tracks.length; i += 4) {
        const part = await Promise.all(tracks.slice(i, i + 4).map(t => resolveTrackUrl(t).catch(() => null)));
        part.forEach(u => (u ? urls.push(u) : missing++));
        resolved += part.length;
        setGameOffline({ phase: 'Получаем ссылки', done: resolved, total: tracks.length });
      }
      // 2) скачивание в кэш
      setGameOffline({ phase: 'Скачиваем', done: 0, total: urls.length });
      await cacheTracks(urls, (done, total) => setGameOffline({ phase: 'Скачиваем', done, total }));
      showToast(missing
        ? `Готово: ${urls.length} треков офлайн. Не удалось получить: ${missing}`
        : `Готово: все ${urls.length} треков игры доступны офлайн`);
    } catch {
      showToast('Не удалось скачать игру офлайн. Проверь интернет и попробуй ещё раз.');
    } finally {
      setGameOffline(null);
    }
  };

  const[viewingGame, setViewingGame] = useState<Game | null>(null);
  const[isCreateGameModalOpen, setIsCreateGameModalOpen] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [isAddRoundModalOpen, setIsAddRoundModalOpen] = useState(false);
  const[newRound, setNewRound] = useState<Partial<Round>>({ winCondition: '1_line' });

  const [cardGeneratorSetup, setCardGeneratorSetup] = useState<{ game: Game; round: Round } | null>(null);
  // Повторное скачивание уже созданных карточек (без новой генерации)
  const [reprint, setReprint] = useState<{ round: Round; index: number } | null>(null);
  const [reprintTemplateId, setReprintTemplateId] = useState<string>('');

  // Какой шаблон предложить: тот, которым печатали; иначе «Тур N» по номеру тура; иначе первый
  const guessTemplate = (round: Round, index: number): string => {
    if (round.templateId && templates.some(t => t.id === round.templateId)) return round.templateId;
    const byName = templates.find(t => t.name.replace(/\s+/g, ' ').trim().toLowerCase() === `тур ${index + 1}`);
    return (byName || templates[0])?.id || '';
  };

  const openReprint = (round: Round, index: number) => {
    if (!round.cards?.length) return;
    if (templates.length === 0) { showToast('Нет шаблонов карточек — создай шаблон во вкладке «Шаблоны»'); return; }
    const guessed = guessTemplate(round, index);
    // Один шаблон или шаблон уже запомнен — открываем сразу, без лишнего окна
    if (templates.length === 1 || (round.templateId && guessed === round.templateId)) {
      const template = templates.find(t => t.id === guessed)!;
      setPrintViewCards({ cards: round.cards, template });
      return;
    }
    setReprintTemplateId(guessed);
    setReprint({ round, index });
  };
  const [cardsCount, setCardsCount] = useState<number>(20);
  // Тексты в числовых полях. Храним отдельно от чисел: раньше поле сразу
  // превращало пустоту в «1», и стереть цифру, чтобы вписать 80, было нельзя.
  const [cardsDraft, setCardsDraft] = useState('20');
  // Моменты победы: авто (как раньше — просто разные) или заданные вручную
  const [winMode, setWinMode] = useState<'auto' | 'manual'>('auto');
  const [firstWinSong, setFirstWinSong] = useState<number>(25);   // номер песни (с 1)
  const [lastWinSong, setLastWinSong] = useState<number>(50);     // номер песни последней победы
  const [firstDraft, setFirstDraft] = useState('25');
  const [lastDraft, setLastDraft] = useState('50');
  // Ввод в числовое поле: текст храним как есть, число обновляем только когда оно валидно
  const numInput = (setDraft: (v: string) => void, setNum: (n: number) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/[^\d]/g, '');
      setDraft(v);
      const n = parseInt(v, 10);
      if (n > 0) setNum(n);
    };
  // Ушёл из поля с пустотой — возвращаем последнее нормальное значение
  const numBlur = (draft: string, setDraft: (v: string) => void, current: number) => () => {
    if (!(parseInt(draft, 10) > 0)) setDraft(String(current));
  };
  // Старые карточки тура. По умолчанию заменяем: если оставить, они выиграют
  // вразнобой и собьют расписание побед у новых.
  const [replaceCards, setReplaceCards] = useState<boolean>(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const createGame = async () => {
    if (!newGameName.trim()) return;
    setIsCreateGameModalOpen(false);
    const { data } = await supabase.from('games').insert([{ name: newGameName, rounds: [] }]).select();
    if (data?.[0]) { setGames([data[0], ...games]); showToast('Игра создана'); }
    setNewGameName('');
  };

  const deleteGame = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Удалить мероприятие со всеми его турами?')) {
      setGames(games.filter(g => g.id !== id));
      if (viewingGame?.id === id) setViewingGame(null);
      await supabase.from('games').delete().eq('id', id);
      showToast('Мероприятие удалено');
    }
  };

  const addRoundToGame = async () => {
    if (!viewingGame || !newRound.name || !newRound.playlistId) return;
    const roundToAdd: Round = {
      id: crypto.randomUUID(), name: newRound.name,
      playlistId: newRound.playlistId, winCondition: newRound.winCondition as any, cards:[],
    };
    const updatedGame = { ...viewingGame, rounds:[...viewingGame.rounds, roundToAdd] };
    setGames(games.map(g => g.id === viewingGame.id ? updatedGame : g));
    setViewingGame(updatedGame);
    setIsAddRoundModalOpen(false);
    setNewRound({ winCondition: '1_line' });
    await supabase.from('games').update({ rounds: updatedGame.rounds }).eq('id', viewingGame.id);
    showToast('Тур добавлен');
  };

  const deleteRound = async (roundId: string) => {
    if (!viewingGame) return;
    if (confirm('Удалить тур? Все карточки будут удалены.')) {
      const updatedRounds = viewingGame.rounds.filter(r => r.id !== roundId);
      const updatedGame = { ...viewingGame, rounds: updatedRounds };
      setGames(games.map(g => g.id === viewingGame.id ? updatedGame : g));
      setViewingGame(updatedGame);
      await supabase.from('games').update({ rounds: updatedRounds }).eq('id', viewingGame.id);
      showToast('Тур удалён');
    }
  };

  // Открываем генератор с осмысленными числами: победы по умолчанию идут
  // ближе к концу тура, но внутри разрешённого для этого условия окна.
  const openGenerator = (game: Game, round: Round) => {
    const queue = buildPlayQueue(playlists.find(p => p.id === round.playlistId)?.tracks || [], dbTracks);
    const lo = minWinIndex(round.winCondition) + 1;
    const hi = maxWinIndex(round.winCondition, queue.length) + 1;
    if (hi >= lo) {
      setLastWinSong(hi);
      setFirstWinSong(Math.max(lo, hi - Math.round((hi - lo) * 0.7)));
    }
    setReplaceCards(true);
    setCardGeneratorSetup({ game, round });
  };

  const generateCards = async () => {
    if (!cardGeneratorSetup || !selectedTemplateId) return;
    const { game, round } = cardGeneratorSetup;
    const playlist = playlists.find(p => p.id === round.playlistId);
    if (!playlist || playlist.tracks.length < 24) return showToast('Ошибка: в плейлисте меньше 24 треков');
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;
    
    // Карточки собираем РОВНО из той очереди, которая прозвучит в туре
    // (buildPlayQueue — тот же код, что и в старте тура). Раньше здесь треки
    // уникализировались только по id, а очередь выбрасывала ещё и дубли по
    // названию — и трек, попавший в клетку, но не в очередь, не закрывался
    // никогда. Для условия «вся карточка» одного такого трека хватало, чтобы
    // убить треть карточек, а нескольких — чтобы не было ни одного бинго.
    // Порядок известен заранее, поэтому карточки раздаём так, чтобы они
    // «выстреливали» на РАЗНЫХ треках — тогда не будет 2-3 бинго одновременно.
    const uniqueTracks = buildPlayQueue(playlist.tracks, dbTracks);
    if (uniqueTracks.length < 24) return showToast(`Ошибка: нужно минимум 24 уникальных трека (сейчас ${uniqueTracks.length})`);
    const dropped = playlist.tracks.length - uniqueTracks.length;

    const playIndexOf = new Map<string, number>();
    uniqueTracks.forEach((t, idx) => playIndexOf.set(String(t.id), idx));

    const newCards: BingoCard[] = [];
    const keptCards = replaceCards ? [] : (round.cards || []);
    const startId = 1000 + keptCards.length + 1;
    const winIndices: number[] = [];
    let collisions = 0;
    let missedTargets = 0;

    if (winMode === 'manual') {
      // ── РУЧНЫЕ МОМЕНТЫ ПОБЕДЫ ──────────────────────────────────────────
      // Ведущий сам говорит, на какой песне закроется первая карточка и через
      // сколько песен следующая. Карточка собирается ПОД эту песню: победная
      // линия из треков «до» неё + сама она, остальные клетки — в основном
      // из треков «после», чтобы раньше времени ничего не закрылось.
      const lo = minWinIndex(round.winCondition);
      const hi = maxWinIndex(round.winCondition, uniqueTracks.length);
      // Границы всегда загоняем в допустимое окно: раньше карточка с целью
      // «за пределами тура» молча собиралась случайной и выигрывала когда попало.
      const from = Math.min(Math.max(firstWinSong - 1, lo), hi);
      const to   = Math.min(Math.max(lastWinSong  - 1, from), hi);
      const built: { cells: Cells; winAt: number }[] = [];
      for (let i = 0; i < cardsCount; i++) {
        // равномерно раскидываем победы между первой и последней песней
        const target = cardsCount > 1
          ? Math.round(from + ((to - from) * i) / (cardsCount - 1))
          : from;
        let cells = buildCardForWinIndex(uniqueTracks, round.winCondition, target, playIndexOf);
        if (!cells) { missedTargets++; cells = buildRandomCells(uniqueTracks); }
        built.push({ cells, winAt: winIndexForCard(cells, playIndexOf, round.winCondition) });
      }
      // Номера раздаём В СЛУЧАЙНОМ порядке. Если бы #1001 выигрывал первым,
      // #1002 вторым и так далее, зал бы за пару туров понял, что победители
      // расписаны заранее. Ведущий порядок всё равно видит — в экране игры
      // показывается ближайшая победа (#номер и песня).
      const ids = built.map((_, i) => startId + i);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      built.forEach((b, i) => {
        winIndices.push(b.winAt);
        newCards.push({ id: String(ids[i]), cells: b.cells, winAt: b.winAt });
      });
      // В печать и в базу — по возрастанию номера, чтобы пачка карточек была
      // по порядку и по ней ничего нельзя было понять.
      newCards.sort((a, b) => Number(a.id) - Number(b.id));
    } else {
      // ── АВТОМАТИЧЕСКИ ──────────────────────────────────────────────────
      // Случайные карточки, но с разными «моментами победы», чтобы не было
      // двух-трёх бинго одновременно.
      const usedWinIndices = new Set<number>();
      keptCards.forEach(c => usedWinIndices.add(winIndexForCard(c.cells, playIndexOf, round.winCondition)));
      const MAX_TRIES = 300;
      for (let i = 0; i < cardsCount; i++) {
        let cells = buildRandomCells(uniqueTracks);
        let winIdx = winIndexForCard(cells, playIndexOf, round.winCondition);
        let tries = 0;
        while (usedWinIndices.has(winIdx) && tries < MAX_TRIES) {
          cells = buildRandomCells(uniqueTracks);
          winIdx = winIndexForCard(cells, playIndexOf, round.winCondition);
          tries++;
        }
        if (usedWinIndices.has(winIdx)) collisions++;
        usedWinIndices.add(winIdx);
        winIndices.push(winIdx);
        newCards.push({ id: String(startId + i), cells, winAt: winIdx });
      }
    }

    // Очередь известна заранее, поэтому можно честно сказать, КОГДА будет бинго.
    // «Вся карточка» на большом плейлисте закрывается только под самый конец —
    // без этой подсказки тур выглядит как «бинго не случилось».
    const first = Math.min(...winIndices) + 1;
    const last  = Math.max(...winIndices) + 1;
    const when = `Первое бинго — на ${first}-й песне из ${uniqueTracks.length}, последняя карточка закроется на ${last}-й.`;
    const droppedHint = dropped > 0
      ? ` Из плейлиста выброшено ${dropped} повторов (тот же трек или та же песня) — в туре прозвучит ${uniqueTracks.length} песен.`
      : '';
    if (winMode === 'manual') {
      const missHint = missedTargets > 0
        ? ` ${missedTargets} карточкам не удалось попасть в заданную песню — они собраны случайно.`
        : '';
      showToast(`Готово. ${when}${missHint}${droppedHint}`, { sticky: true });
    } else if (collisions > 0) {
      const lineHint = round.winCondition === '1_line'
        ? ' Совет: 1 линия закрывается рано и кучно — выбери 2–3 линии и/или добавь треков в плейлист.'
        : ` Совет: добавь больше треков в плейлист (сейчас ${uniqueTracks.length}) — тогда «моментов победы» хватит на все карточки.`;
      showToast(`Готово. ${when}${droppedHint} ${collisions} из ${cardsCount} карточек могут выстрелить одновременно.${lineHint}`, { sticky: true });
    } else {
      showToast(`Готово. ${when}${droppedHint} Все ${cardsCount} карточек выстрелят в разные моменты — толпы не будет.`, { sticky: true });
    }

    const updatedRounds = game.rounds.map(r => r.id === round.id ? { ...r, cards: [...keptCards, ...newCards], templateId: template.id } : r);
    const updatedGame = { ...game, rounds: updatedRounds };
    setGames(games.map(g => g.id === game.id ? updatedGame : g));
    if (viewingGame?.id === game.id) setViewingGame(updatedGame);
    await supabase.from('games').update({ rounds: updatedRounds }).eq('id', game.id);
    setCardGeneratorSetup(null);
    setPrintViewCards({ cards: newCards, template });
  };

  if (viewingGame) {
    const currentGame = games.find(g => g.id === viewingGame.id) || viewingGame;
    return (
      <div className=" duration-300 flex flex-col h-full">
        <button onClick={() => setViewingGame(null)} className="inline-flex items-center gap-1 text-sm text-pult-text2 hover:text-pult-text mb-4 transition-colors w-fit"><ChevronLeft size={16} /> Мероприятия</button>
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-medium mb-2">{currentGame.name}</h1>
            <div className="flex items-center gap-4 text-pult-text2"><Calendar size={16} /> {new Date(currentGame.created_at || Date.now()).toLocaleDateString('ru-RU')}<span className="text-pult-muted">·</span><span><span className="font-mono tabular-nums">{currentGame.rounds.length}</span> {plural(currentGame.rounds.length, 'тур', 'тура', 'туров')}</span></div>
          </div>
          <button onClick={e => deleteGame(currentGame.id, e)} className="h-9 px-3 rounded-lg text-sm inline-flex items-center gap-2 text-pult-muted hover:text-red-400 hover:bg-white/[0.04] transition-colors"><Trash2 size={16} /> Удалить игру</button>
        </div>
        <div className="flex-1 overflow-y-auto pr-2 pb-10 custom-scrollbar">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-medium text-pult-text">Туры</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => cacheGameOffline(viewingGame)}
                disabled={!!gameOffline || viewingGame.rounds.length === 0}
                title="Скачать треки всех туров этой игры, чтобы они играли даже без интернета. Делай дома, заранее."
                className="bg-pult-raised hover:bg-[#2b2b2e] text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {gameOffline ? <Loader2 size={18} className="animate-spin" /> : <HardDriveDownload size={18} />}
                {gameOffline ? `${gameOffline.phase}: ${gameOffline.done}/${gameOffline.total}` : 'Скачать игру офлайн'}
              </button>
              <button onClick={() => setIsAddRoundModalOpen(true)} className="bg-pult-raised hover:bg-[#2b2b2e] text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"><PlusCircle size={18} /> Добавить тур</button>
            </div>
          </div>
          {currentGame.rounds.length === 0 ? (
            <div className="text-center py-20 text-pult-muted bg-pult-card/60 rounded-2xl border border-dashed border-white/[0.08]">В этой игре пока нет туров.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentGame.rounds.map((round, index) => {
                const playlist = playlists.find(p => p.id === round.playlistId);
                const cardsCountLabel = round.cards?.length ? `${round.cards.length} карточек` : 'Нет карточек';
                const conditionText = round.winCondition === 'full' ? 'Вся карточка' : round.winCondition === '3_lines' ? '3 Линии' : round.winCondition === '2_lines' ? '2 Линии' : '1 Линия';
                return (
                  <div key={round.id} className="bg-pult-card border border-white/[0.08] rounded-xl p-5 flex flex-col group relative">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-sm text-pult-text2">Тур <span className="font-mono tabular-nums">{index + 1}</span> · {conditionText.toLowerCase()}</span>
                      <button onClick={() => deleteRound(round.id)} className="text-pult-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                    </div>
                    <h3 className="text-lg font-medium mb-2 truncate">{round.name}</h3>
                    <p className="text-pult-text2 text-sm mb-2 flex items-center gap-2"><ListMusic size={16} /> {playlist ? `${playlist.name} (${playlist.tracks.length} треков)` : 'Плейлист удалён'}</p>
                    <p className="text-pult-muted text-sm mb-6 flex items-center gap-2"><LayoutTemplate size={16} /> {cardsCountLabel}</p>
                    {!!round.cards?.length && (
                      <button
                        onClick={() => openReprint(round, index)}
                        title="Открыть уже созданные карточки ещё раз — скачать или распечатать. Новые не создаются."
                        className="mb-3 w-full bg-pult-bg border border-white/[0.08] hover:border-white/20 text-pult-text hover:text-white py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <Download size={16} /> Скачать готовые ({round.cards.length})
                      </button>
                    )}
                    <div className="mt-auto flex gap-3">
                      <button onClick={() => startHostSession(currentGame, round)} disabled={!playlist} className="flex-1 bg-lime hover:bg-[#d4ff63] text-[#141415] py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"><Play size={20} fill="currentColor" /> Играть</button>
                      <button onClick={() => { if (templates.length > 0 && !selectedTemplateId) setSelectedTemplateId(templates[0].id); openGenerator(currentGame, round); }} disabled={!playlist || playlist.tracks.length < 24} className="flex-1 bg-pult-raised hover:bg-[#2b2b2e] text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"><Printer size={20} /> Карточки</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Повторное скачивание готовых карточек */}
        {reprint && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setReprint(null)}>
            <div className="bg-pult-card border border-white/[0.08] rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-medium mb-1">Скачать готовые карточки</h3>
              <p className="text-pult-text2 text-sm mb-5">
                {reprint.round.name}: {reprint.round.cards?.length} карточек. Это те же карточки, что уже созданы, —
                новые не генерируются, расписание побед не меняется.
              </p>
              <label className="block text-xs text-pult-muted mb-1">Шаблон оформления</label>
              <select value={reprintTemplateId} onChange={e => setReprintTemplateId(e.target.value)}
                className="w-full bg-pult-bg border border-white/[0.08] rounded-xl py-3 px-4 text-white focus:border-lime/60 mb-6">
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setReprint(null)} className="flex-1 py-3 bg-pult-raised rounded-xl font-medium">Отмена</button>
                <button
                  onClick={() => {
                    const template = templates.find(t => t.id === reprintTemplateId);
                    if (!template || !reprint.round.cards?.length) return;
                    setPrintViewCards({ cards: reprint.round.cards, template });
                    setReprint(null);
                  }}
                  className="flex-1 py-3 bg-lime hover:bg-[#d4ff63] rounded-xl font-medium flex items-center justify-center gap-2 text-[#141415]"
                >
                  <Download size={18} /> Открыть
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Модалки туров и генерации здесь же */}
        {isAddRoundModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
             <div className="bg-pult-card border border-white/[0.08] rounded-2xl w-full max-w-md p-6">
                <h3 className="text-xl font-medium mb-4">Добавить тур</h3>
                <input type="text" value={newRound.name || ''} onChange={e => setNewRound({ ...newRound, name: e.target.value })} placeholder="Название тура" className="w-full bg-pult-bg border border-white/[0.08] rounded-xl py-3 px-4 text-white focus:border-lime/60 mb-4" />
                <select value={newRound.playlistId || ''} onChange={e => setNewRound({ ...newRound, playlistId: e.target.value })} className="w-full bg-pult-bg border border-white/[0.08] rounded-xl py-3 px-4 text-white focus:border-lime/60 mb-4">
                  <option value="" disabled>Выберите плейлист (мин. 24 трека)...</option>
                  {playlists.filter(p => p.tracks.length >= 24).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={newRound.winCondition || '1_line'} onChange={e => setNewRound({ ...newRound, winCondition: e.target.value as any })} className="w-full bg-pult-bg border border-white/[0.08] rounded-xl py-3 px-4 text-white focus:border-lime/60 mb-4">
                  <option value="1_line">1 Линия</option>
                  <option value="2_lines">2 Линии</option>
                  <option value="3_lines">3 Линии</option>
                  <option value="full">Вся карточка</option>
                </select>
                <div className="flex gap-4">
                  <button onClick={() => setIsAddRoundModalOpen(false)} className="flex-1 py-3 bg-pult-raised rounded-xl font-medium">Отмена</button>
                  <button onClick={addRoundToGame} className="flex-1 py-3 bg-lime rounded-xl font-medium text-[#141415]">Добавить</button>
                </div>
             </div>
          </div>
        )}

        {cardGeneratorSetup && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4">
            <div className="bg-pult-card border border-white/[0.08] rounded-3xl w-full max-w-md p-6">
              <h3 className="text-xl font-medium mb-6">Генератор карточек</h3>
              <div className="mb-4">
                <label className="block text-sm text-pult-text2 mb-2">Количество</label>
                <input type="text" inputMode="numeric" value={cardsDraft}
                  onChange={numInput(setCardsDraft, setCardsCount)}
                  onBlur={numBlur(cardsDraft, setCardsDraft, cardsCount)}
                  onFocus={e => e.target.select()}
                  className="w-full bg-pult-bg border border-white/[0.08] py-3 text-center rounded-xl font-medium" />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-pult-text2 mb-2">Шаблон</label>
                <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} className="w-full bg-pult-bg border border-white/[0.08] rounded-xl py-3 px-4 text-white">{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </div>

              {/* Моменты победы: авто или заданные вручную */}
              <div className="mb-6">
                <label className="block text-sm text-pult-text2 mb-2">Когда карточки выигрывают</label>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setWinMode('auto')}
                    className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors ${winMode === 'auto' ? 'bg-lime text-[#141415]' : 'bg-pult-bg border border-white/[0.08] text-pult-text2'}`}>
                    Автоматически
                  </button>
                  <button onClick={() => setWinMode('manual')}
                    className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors ${winMode === 'manual' ? 'bg-lime text-[#141415]' : 'bg-pult-bg border border-white/[0.08] text-pult-text2'}`}>
                    Задать самому
                  </button>
                </div>

                {winMode === 'manual' ? (() => {
                  const queue = buildPlayQueue(
                    playlists.find(p => p.id === cardGeneratorSetup.round.playlistId)?.tracks || [],
                    dbTracks
                  );
                  const cond = cardGeneratorSetup.round.winCondition;
                  const condName = cond === 'full' ? 'вся карточка' : cond === '3_lines' ? '3 линии' : cond === '2_lines' ? '2 линии' : '1 линия';
                  const lo = minWinIndex(cond) + 1;
                  const hi = maxWinIndex(cond, queue.length) + 1;
                  const from = Math.min(Math.max(firstWinSong, lo), hi);
                  const to   = Math.min(Math.max(lastWinSong, from), hi);
                  const clamped = from !== firstWinSong || to !== lastWinSong;
                  const at = (i: number) => cardsCount > 1
                    ? Math.round(from + ((to - from) * i) / (cardsCount - 1))
                    : from;
                  const sameSong = cardsCount > 1 && (to - from) < cardsCount - 1;
                  return (
                    <>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <span className="block text-xs text-pult-muted mb-1">Первое бинго на песне №</span>
                          <input type="text" inputMode="numeric" value={firstDraft}
                            onChange={numInput(setFirstDraft, setFirstWinSong)}
                            onBlur={numBlur(firstDraft, setFirstDraft, firstWinSong)}
                            onFocus={e => e.target.select()}
                            className="w-full bg-pult-bg border border-white/[0.08] py-3 text-center rounded-xl font-medium" />
                        </div>
                        <div className="flex-1">
                          <span className="block text-xs text-pult-muted mb-1">Последнее бинго на песне №</span>
                          <input type="text" inputMode="numeric" value={lastDraft}
                            onChange={numInput(setLastDraft, setLastWinSong)}
                            onBlur={numBlur(lastDraft, setLastDraft, lastWinSong)}
                            onFocus={e => e.target.select()}
                            className="w-full bg-pult-bg border border-white/[0.08] py-3 text-center rounded-xl font-medium" />
                        </div>
                      </div>
                      {queue.length < 24 ? (
                        <p className="text-xs mt-2 text-amber-300">В плейлисте меньше 24 песен.</p>
                      ) : (
                        <p className="text-xs mt-2 text-pult-muted">
                          Победы на песнях: {at(0)}, {at(1)}, {at(2)}… последняя на {at(cardsCount - 1)}-й из {queue.length}.
                          {' '}Номера карточек раздаются вразнобой, чтобы зал не понял, что победители расписаны — тебе порядок виден в экране игры.
                        </p>
                      )}
                      {clamped && queue.length >= 24 && (
                        <p className="text-xs mt-1 text-amber-300">
                          Для условия «{condName}» победа возможна с {lo}-й по {hi}-ю песню — цифры подогнаны под диапазон.
                          {' '}Раньше {lo}-й не закрыть {cond === 'full' ? '24 клетки' : `${minWinIndex(cond) + 1} клеток`};
                          {cond !== 'full' && ` последние ${queue.length - hi} песен нужны как запас — иначе остальные линии закроются раньше и карточка выиграет не тогда, когда задумано.`}
                        </p>
                      )}
                      {sameSong && queue.length >= 24 && (
                        <p className="text-xs mt-1 text-amber-300">
                          Карточек больше, чем песен в промежутке — несколько закроются на одной песне.
                        </p>
                      )}
                    </>
                  );
                })() : (
                  <p className="text-xs text-pult-muted">Приложение само разведёт карточки по разным песням, чтобы не было двух бинго подряд.</p>
                )}
              </div>
              {(cardGeneratorSetup.round.cards?.length || 0) > 0 && (
                <label className="flex items-start gap-3 mb-6 p-3 rounded-xl bg-pult-bg border border-white/[0.08] cursor-pointer">
                  <input type="checkbox" checked={replaceCards} onChange={e => setReplaceCards(e.target.checked)} className="mt-1 accent-purple-500 w-4 h-4" />
                  <span className="text-sm">
                    Заменить старые карточки ({cardGeneratorSetup.round.cards?.length} шт.)
                    <span className="block text-xs text-pult-muted mt-1">
                      Старые уже напечатаны и раздадите их снова? Сними галочку — новые добавятся к ним. Но тогда старые выиграют вразнобой и собьют расписание.
                    </span>
                  </span>
                </label>
              )}
              <div className="flex gap-4">
                <button onClick={() => setCardGeneratorSetup(null)} className="flex-1 py-4 bg-pult-raised rounded-xl font-medium">Отмена</button>
                <button onClick={generateCards} className="flex-1 py-4 bg-lime rounded-xl font-medium text-[#141415]">Сгенерировать</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className=" duration-300 h-full overflow-y-auto custom-scrollbar pr-2 pb-10">
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">Мероприятия</h1>
          <p className="mt-1 text-sm text-pult-text2">Игра — это вечер в заведении: туры, бланки и сам ход игры</p>
        </div>
        <button onClick={() => setIsCreateGameModalOpen(true)} className="h-9 px-4 rounded-lg text-sm font-medium inline-flex items-center gap-2 bg-lime text-[#141415] hover:bg-[#d4ff63] transition-colors">
          <PlusCircle size={16} /> Новая игра
        </button>
      </header>
      <div className="rounded-xl border border-white/[0.08] bg-pult-card divide-y divide-white/[0.06]">
        {games.length === 0 && <p className="p-6 text-sm text-pult-text2">Игр пока нет</p>}
        {games.map(game => {
          const rounds = game.rounds?.length || 0;
          const cards = (game.rounds || []).reduce((n, r) => n + (r.cards?.length || 0), 0);
          return (
            <div key={game.id} onClick={() => setViewingGame(game)}
              className="group grid grid-cols-[1fr_120px_140px_110px_32px] items-center gap-4 h-14 px-4 cursor-pointer hover:bg-white/[0.03] transition-colors">
              <span className="truncate">{game.name}</span>
              <span className="text-sm text-pult-text2"><span className="font-mono tabular-nums">{rounds}</span> {plural(rounds, 'тур', 'тура', 'туров')}</span>
              <span className="text-sm text-pult-muted">{cards ? <><span className="font-mono tabular-nums">{cards}</span> {plural(cards, 'бланк', 'бланка', 'бланков')}</> : 'без бланков'}</span>
              <span className="font-mono text-sm tabular-nums text-pult-muted">{game.created_at ? new Date(game.created_at).toLocaleDateString('ru-RU') : ''}</span>
              <button onClick={e => deleteGame(game.id, e)} title="Удалить игру" className="p-1.5 rounded-md text-pult-muted hover:text-red-400 hover:bg-white/[0.04] transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
            </div>
          );
        })}
      </div>

      {isCreateGameModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-pult-card border border-white/[0.08] rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-medium mb-4">Новое мероприятие</h3>
            <input autoFocus type="text" value={newGameName} onChange={e => setNewGameName(e.target.value)} placeholder="Название игры"  />
            <div className="flex gap-4"><button onClick={() => setIsCreateGameModalOpen(false)} className="flex-1 py-3 rounded-xl font-medium bg-pult-raised">Отмена</button><button onClick={createGame} className="flex-1 py-3 rounded-xl font-medium bg-lime text-[#141415]">Создать</button></div>
          </div>
        </div>
      )}
    </div>
  );
}