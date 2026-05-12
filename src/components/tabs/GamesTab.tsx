import { useState } from 'react';
import { supabase } from '../../supabase';
import { Game, Round, Playlist, Template, BingoCard } from '../../types';
import { ChevronLeft, Calendar, Trash2, PlusCircle, ListMusic, LayoutTemplate, Play, Printer, PartyPopper } from 'lucide-react';

interface GamesTabProps {
  games: Game[];
  setGames: (val: Game[]) => void;
  playlists: Playlist[];
  templates: Template[];
  showToast: (msg: string) => void;
  startHostSession: (game: Game, round: Round) => void;
  setPrintViewCards: (val: { cards: BingoCard[]; template: Template }) => void;
}

export default function GamesTab({ games, setGames, playlists, templates, showToast, startHostSession, setPrintViewCards }: GamesTabProps) {
  const[viewingGame, setViewingGame] = useState<Game | null>(null);
  const[isCreateGameModalOpen, setIsCreateGameModalOpen] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [isAddRoundModalOpen, setIsAddRoundModalOpen] = useState(false);
  const[newRound, setNewRound] = useState<Partial<Round>>({ winCondition: '1_line' });

  const [cardGeneratorSetup, setCardGeneratorSetup] = useState<{ game: Game; round: Round } | null>(null);
  const [cardsCount, setCardsCount] = useState<number>(20);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const createGame = async () => {
    if (!newGameName.trim()) return;
    setIsCreateGameModalOpen(false);
    const { data } = await supabase.from('games').insert([{ name: newGameName, rounds: [] }]).select();
    if (data?.[0]) { setGames([data[0], ...games]); showToast('Игра создана!'); }
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
    showToast('Тур добавлен!');
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

  const generateCards = async () => {
    if (!cardGeneratorSetup || !selectedTemplateId) return;
    const { game, round } = cardGeneratorSetup;
    const playlist = playlists.find(p => p.id === round.playlistId);
    if (!playlist || playlist.tracks.length < 24) return showToast('Ошибка: в плейлисте меньше 24 треков!');
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;
    
    const newCards: BingoCard[] =[];
    const startId = 1000 + (round.cards?.length || 0) + 1;
    for (let i = 0; i < cardsCount; i++) {
      const shuffled = [...playlist.tracks].sort(() => Math.random() - 0.5);
      const cardTracks = shuffled.slice(0, 24);
      const cells: any[] =[...cardTracks.slice(0, 12), { isFreeSpace: true }, ...cardTracks.slice(12, 24)];
      newCards.push({ id: String(startId + i), cells });
    }
    
    const updatedRounds = game.rounds.map(r => r.id === round.id ? { ...r, cards:[...(r.cards || []), ...newCards] } : r);
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
      <div className="animate-in slide-in-from-right-8 duration-300 flex flex-col h-full">
        <button onClick={() => setViewingGame(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition w-fit"><ChevronLeft size={20} /> Назад к списку игр</button>
        <div className="flex items-end justify-between mb-8 border-b border-gray-800 pb-8">
          <div>
            <h1 className="text-4xl font-black mb-2">{currentGame.name}</h1>
            <div className="flex items-center gap-4 text-gray-400"><Calendar size={16} /> {new Date(currentGame.created_at || Date.now()).toLocaleDateString('ru-RU')}<span className="w-1 h-1 bg-gray-600 rounded-full" /><span>{currentGame.rounds.length} туров</span></div>
          </div>
          <button onClick={e => deleteGame(currentGame.id, e)} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition font-bold"><Trash2 size={20} /> Удалить мероприятие</button>
        </div>
        <div className="flex-1 overflow-y-auto pr-2 pb-10 custom-scrollbar">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Туры</h2>
            <button onClick={() => setIsAddRoundModalOpen(true)} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"><PlusCircle size={18} /> Добавить тур</button>
          </div>
          {currentGame.rounds.length === 0 ? (
            <div className="text-center py-20 text-gray-500 bg-gray-900/50 rounded-2xl border border-dashed border-gray-800">В этой игре пока нет туров.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentGame.rounds.map((round, index) => {
                const playlist = playlists.find(p => p.id === round.playlistId);
                const cardsCountLabel = round.cards?.length ? `${round.cards.length} карточек` : 'Нет карточек';
                const conditionText = round.winCondition === 'full' ? 'Бинго' : round.winCondition === '2_lines' ? '2 Линии' : '1 Линия';
                return (
                  <div key={round.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col group relative shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-purple-400 font-bold bg-purple-500/10 px-3 py-1.5 rounded-lg text-sm flex gap-2 items-center">Тур {index + 1} <span className="text-gray-400 text-xs font-normal">({conditionText})</span></span>
                      <button onClick={() => deleteRound(round.id)} className="text-gray-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                    </div>
                    <h3 className="text-2xl font-black mb-2 truncate">{round.name}</h3>
                    <p className="text-gray-400 text-sm mb-2 flex items-center gap-2"><ListMusic size={16} /> {playlist ? `${playlist.name} (${playlist.tracks.length} треков)` : 'Плейлист удалён'}</p>
                    <p className="text-gray-500 text-sm mb-6 flex items-center gap-2"><LayoutTemplate size={16} /> {cardsCountLabel}</p>
                    <div className="mt-auto flex gap-3">
                      <button onClick={() => startHostSession(currentGame, round)} disabled={!playlist} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"><Play size={20} fill="currentColor" /> Играть</button>
                      <button onClick={() => { if (templates.length > 0 && !selectedTemplateId) setSelectedTemplateId(templates[0].id); setCardGeneratorSetup({ game: currentGame, round }); }} disabled={!playlist || playlist.tracks.length < 24} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"><Printer size={20} /> Карточки</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Модалки туров и генерации здесь же */}
        {isAddRoundModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
             <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4">Добавить тур</h3>
                <input type="text" value={newRound.name || ''} onChange={e => setNewRound({ ...newRound, name: e.target.value })} placeholder="Название тура" className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-purple-500 mb-4" />
                <select value={newRound.playlistId || ''} onChange={e => setNewRound({ ...newRound, playlistId: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-purple-500 mb-4">
                  <option value="" disabled>Выберите плейлист (мин. 24 трека)...</option>
                  {playlists.filter(p => p.tracks.length >= 24).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={newRound.winCondition || '1_line'} onChange={e => setNewRound({ ...newRound, winCondition: e.target.value as any })} className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-purple-500 mb-4">
                  <option value="1_line">1 Линия</option>
                  <option value="2_lines">2 Линии</option>
                  <option value="full">Вся карточка</option>
                </select>
                <div className="flex gap-4">
                  <button onClick={() => setIsAddRoundModalOpen(false)} className="flex-1 py-3 bg-gray-800 rounded-xl font-bold">Отмена</button>
                  <button onClick={addRoundToGame} className="flex-1 py-3 bg-purple-600 rounded-xl font-bold">Добавить</button>
                </div>
             </div>
          </div>
        )}

        {cardGeneratorSetup && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md p-6">
              <h3 className="text-xl font-bold mb-6">Генератор карточек</h3>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Количество</label>
                <input type="number" value={cardsCount} onChange={e => setCardsCount(Number(e.target.value) || 1)} className="w-full bg-gray-950 border border-gray-800 py-3 text-center rounded-xl font-bold" />
              </div>
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Шаблон</label>
                <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-white">{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setCardGeneratorSetup(null)} className="flex-1 py-4 bg-gray-800 rounded-xl font-bold">Отмена</button>
                <button onClick={generateCards} className="flex-1 py-4 bg-purple-600 rounded-xl font-bold">Сгенерировать</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold mb-2">Мероприятия</h1>
      <p className="text-gray-400 mb-8">Создавайте игры, добавляйте в них туры и генерируйте карточки.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div onClick={() => setIsCreateGameModalOpen(true)} className="bg-gray-900/50 border-2 border-dashed border-gray-700 rounded-2xl h-56 flex flex-col items-center justify-center text-gray-400 hover:border-purple-500 hover:text-purple-400 transition cursor-pointer"><PartyPopper size={40} className="mb-4" /><span className="font-bold text-lg">Создать игру</span></div>
        {games.map(game => (
          <div key={game.id} onClick={() => setViewingGame(game)} className="bg-gray-900 border border-gray-800 rounded-2xl h-56 p-6 flex flex-col hover:border-purple-500/50 transition cursor-pointer relative shadow-lg group">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-auto text-purple-400"><PartyPopper size={24} /></div>
            <button onClick={e => deleteGame(game.id, e)} className="absolute top-4 right-4 p-2 text-gray-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
            <div><h3 className="font-bold text-xl mb-1 truncate">{game.name}</h3><p className="text-sm text-gray-500">{game.rounds?.length || 0} туров</p></div>
          </div>
        ))}
      </div>

      {isCreateGameModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">Новое мероприятие</h3>
            <input autoFocus type="text" value={newGameName} onChange={e => setNewGameName(e.target.value)} placeholder="Название игры" className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-white mb-6" onKeyDown={e => e.key === 'Enter' && createGame()} />
            <div className="flex gap-4"><button onClick={() => setIsCreateGameModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold bg-gray-800">Отмена</button><button onClick={createGame} className="flex-1 py-3 rounded-xl font-bold bg-purple-600">Создать</button></div>
          </div>
        </div>
      )}
    </div>
  );
}