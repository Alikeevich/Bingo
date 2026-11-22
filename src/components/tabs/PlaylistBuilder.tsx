import { useMemo, useRef, useState } from 'react';
import { Game, Playlist, Tag, Track } from '../../types';
import { searchITunes } from '../../lib/itunes';
import { playlistArtistSet, sharesArtist, splitArtists, songKey } from '../../utils';
import {
  ArrowRight, ArrowLeft, Search, X, Shuffle, Download, Layers, Lock, Play, Pause, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';

/**
 * Набор песен в плейлист: слева «Моя база» или общий каталог (iTunes), справа плейлист.
 * Галочками отмечаешь, кнопкой переносишь пачкой. Плюс три помощника:
 * случайное добавление, загрузка из другого тура и подсветка песен,
 * которые уже звучали на другой игре.
 *
 * Правило «один исполнитель на плейлист» (с учётом фитов) действует при любом
 * способе добавления — поэтому добавиться может меньше, чем выбрано.
 */

interface Props {
  playlist: Playlist;
  playlists: Playlist[];
  dbTracks: Track[];
  dbTags: Tag[];
  games: Game[];
  locked: boolean;                       // по плейлисту уже собраны карточки
  onUnlockRequest: () => void;
  onSave: (tracks: Track[]) => Promise<void>;
  showToast: (msg: string, opts?: { sticky?: boolean }) => void;
  togglePlay: (t: Track) => void;
  playingTrackId: string | number | null;
  isPaused: boolean;
}

const PAGE = 50;

// Добавляет кандидатов по порядку, пропуская тех, чей исполнитель уже есть
function addRespectingArtists(current: Track[], candidates: Track[]) {
  const present = playlistArtistSet(current);
  const ids = new Set(current.map(t => String(t.id)));
  const added: Track[] = [];
  const skipped: Track[] = [];
  for (const t of candidates) {
    if (ids.has(String(t.id))) continue;
    if (sharesArtist(t.artist, present)) { skipped.push(t); continue; }
    added.push(t);
    ids.add(String(t.id));
    for (const a of splitArtists(t.artist)) present.add(a);
  }
  return { added, skipped };
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PlaylistBuilder(p: Props) {
  const inPlaylist = useMemo(() => new Set(p.playlist.tracks.map(t => String(t.id))), [p.playlist.tracks]);

  // ── источник левой панели: своя база или общий каталог ──
  const [source, setSource] = useState<'db' | 'catalog'>('db');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalog, setCatalog] = useState<Track[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearched, setCatalogSearched] = useState(false);
  const reqRef = useRef(0);
  const runCatalogSearch = async () => {
    const q = catalogQuery.trim();
    if (!q) return;
    const rid = ++reqRef.current;
    setCatalogLoading(true); setPage(0); setLeftSel(new Set());
    try {
      const found = await searchITunes(q);
      if (rid === reqRef.current) { setCatalog(found); setCatalogSearched(true); }
    } catch {
      if (rid === reqRef.current) { setCatalog([]); setCatalogSearched(true); p.showToast('Каталог не ответил — проверь интернет и попробуй ещё раз'); }
    } finally {
      if (rid === reqRef.current) setCatalogLoading(false);
    }
  };
  const switchSource = (next: 'db' | 'catalog') => { setSource(next); setPage(0); setLeftSel(new Set()); };

  // ── фильтры левой панели ──
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [hideBlocked, setHideBlocked] = useState(false);
  const [page, setPage] = useState(0);
  const [leftSel, setLeftSel] = useState<Set<string>>(new Set());
  const [rightSel, setRightSel] = useState<Set<string>>(new Set());
  const [rightQuery, setRightQuery] = useState('');

  // ── пересечение с другой игрой ──
  const [crossGameId, setCrossGameId] = useState('');
  const crossKeys = useMemo(() => {
    const g = p.games.find(x => x.id === crossGameId);
    if (!g) return null;
    const keys = new Set<string>();
    for (const r of g.rounds) {
      const pl = p.playlists.find(x => x.id === r.playlistId);
      for (const t of pl?.tracks || []) { keys.add('id:' + String(t.id)); keys.add('song:' + songKey(t.title, t.artist)); }
    }
    return keys;
  }, [crossGameId, p.games, p.playlists]);
  const wasInCross = (t: Track) =>
    !!crossKeys && (crossKeys.has('id:' + String(t.id)) || crossKeys.has('song:' + songKey(t.title, t.artist)));

  // ── модалки ──
  const [modal, setModal] = useState<null | 'random' | 'fromRound' | 'cross'>(null);
  const [randomCount, setRandomCount] = useState('10');
  const [srcGameId, setSrcGameId] = useState('');
  const [srcRoundId, setSrcRoundId] = useState('');

  const presentArtists = useMemo(() => playlistArtistSet(p.playlist.tracks), [p.playlist.tracks]);
  const isBlocked = (t: Track) => sharesArtist(t.artist, presentArtists);

  const left = useMemo(() => {
    if (source === 'catalog') {
      return catalog.filter(t => !inPlaylist.has(String(t.id)) && !(hideBlocked && isBlocked(t)));
    }
    const q = query.trim().toLowerCase();
    return p.dbTracks.filter(t => {
      if (inPlaylist.has(String(t.id))) return false;
      if (tag && !(t.tags || []).includes(tag)) return false;
      if (hideBlocked && isBlocked(t)) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, catalog, p.dbTracks, inPlaylist, query, tag, hideBlocked, presentArtists]);

  const pages = Math.max(1, Math.ceil(left.length / PAGE));
  const curPage = Math.min(page, pages - 1);
  const leftPage = left.slice(curPage * PAGE, curPage * PAGE + PAGE);

  const right = useMemo(() => {
    const q = rightQuery.trim().toLowerCase();
    return p.playlist.tracks.filter(t => !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
  }, [p.playlist.tracks, rightQuery]);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n);
  };

  const report = (added: number, skipped: Track[], what = 'Добавлено') => {
    const names = skipped.slice(0, 3).map(t => t.artist).join(', ');
    p.showToast(
      skipped.length
        ? `${what}: ${added}. Пропущено ${skipped.length} — исполнитель уже есть в плейлисте (${names}${skipped.length > 3 ? '…' : ''})`
        : `${what}: ${added}`,
      { sticky: skipped.length > 0 }
    );
  };

  const addSelected = async () => {
    const chosen = left.filter(t => leftSel.has(String(t.id)));
    if (!chosen.length) return;
    const { added, skipped } = addRespectingArtists(p.playlist.tracks, chosen);
    if (added.length) await p.onSave([...p.playlist.tracks, ...added]);
    setLeftSel(new Set());
    report(added.length, skipped);
  };

  const removeSelected = async () => {
    if (!rightSel.size) return;
    const next = p.playlist.tracks.filter(t => !rightSel.has(String(t.id)));
    await p.onSave(next);
    p.showToast(`Убрано из плейлиста: ${p.playlist.tracks.length - next.length}`);
    setRightSel(new Set());
  };

  const addRandom = async () => {
    const n = Math.max(1, parseInt(randomCount, 10) || 0);
    // Берём из того, что сейчас отфильтровано слева, — так можно «10 случайных русских хитов»
    const { added } = addRespectingArtists(p.playlist.tracks, shuffled(left));
    const take = added.slice(0, n);
    if (take.length) await p.onSave([...p.playlist.tracks, ...take]);
    setModal(null);
    p.showToast(take.length < n
      ? `Добавлено ${take.length} из ${n}: больше нет песен с новыми исполнителями под этот фильтр`
      : `Добавлено случайных песен: ${take.length}`, { sticky: take.length < n });
  };

  const srcGame = p.games.find(g => g.id === srcGameId);
  const loadFromRound = async () => {
    const round = srcGame?.rounds.find(r => r.id === srcRoundId);
    const pl = p.playlists.find(x => x.id === round?.playlistId);
    if (!pl) return;
    const { added, skipped } = addRespectingArtists(p.playlist.tracks, pl.tracks);
    if (added.length) await p.onSave([...p.playlist.tracks, ...added]);
    setModal(null);
    report(added.length, skipped, `Из тура «${round?.name}» добавлено`);
  };

  const allLeftOnPage = leftPage.length > 0 && leftPage.every(t => leftSel.has(String(t.id)));
  const allRight = right.length > 0 && right.every(t => rightSel.has(String(t.id)));

  const renderRow = (t: Track, side: 'l' | 'r') => {
    const id = String(t.id);
    const sel = side === 'l' ? leftSel : rightSel;
    const setSel = side === 'l' ? setLeftSel : setRightSel;
    const blocked = side === 'l' && isBlocked(t);
    const cross = wasInCross(t);
    const playing = p.playingTrackId === t.id && !p.isPaused;
    return (
      <label
        key={id}
        className={`grid grid-cols-[20px_32px_1fr] items-center gap-3 h-11 px-3 rounded-lg cursor-pointer transition-colors ${
          sel.has(id) ? 'bg-pult-raised' : 'hover:bg-white/[0.03]'
        }`}
      >
        <input
          type="checkbox"
          checked={sel.has(id)}
          disabled={p.locked}
          onChange={() => toggle(sel, setSel, id)}
          className="accent-lime w-4 h-4"
        />
        <button
          type="button"
          onClick={e => { e.preventDefault(); p.togglePlay(t); }}
          className="relative w-8 h-8 rounded overflow-hidden bg-pult-raised group"
          title="Послушать"
        >
          {t.cover && <img src={t.cover} alt="" className="w-full h-full object-cover" loading="lazy" />}
          <span className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${playing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {playing ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white" />}
          </span>
        </button>
        <span className="min-w-0 flex items-baseline gap-2">
          <span className={`truncate text-sm ${blocked ? 'text-pult-muted' : 'text-pult-text'}`}>{t.artist}</span>
          <span className="truncate text-sm text-pult-text2">{t.title}</span>
          {cross && <span className="ml-auto shrink-0 text-xs text-sky-300" title="Эта песня уже звучала на выбранной игре">было</span>}
          {blocked && !cross && <span className="ml-auto shrink-0 text-xs text-pult-muted" title="Исполнитель уже есть в плейлисте">исполнитель есть</span>}
        </span>
      </label>
    );
  };

  const btn = 'h-9 px-4 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const btnQuiet = `${btn} bg-pult-raised text-pult-text hover:bg-[#2b2b2e] border border-white/[0.06]`;
  const field = 'h-9 w-full rounded-lg bg-pult-raised border border-white/[0.06] px-3 text-sm text-pult-text placeholder:text-pult-muted focus:outline-none focus:border-lime/60';

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      {p.locked && (
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-pult-card px-4 py-3 text-sm text-pult-text2">
          <Lock size={16} className="text-pult-muted shrink-0" />
          <span className="flex-1">
            По этому плейлисту уже созданы бланки. Если поменять песни, напечатанные карточки будут выигрывать не на тех песнях
          </span>
          <button onClick={p.onUnlockRequest} className={btnQuiet}>Всё равно изменить</button>
        </div>
      )}

      {/* помощники */}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={p.locked} onClick={() => setModal('fromRound')} className={btnQuiet}><Download size={16} /> Из другого тура</button>
        <button onClick={() => setModal('cross')} className={btnQuiet}><Layers size={16} /> Пересечение с игрой</button>
        <button disabled={p.locked} onClick={() => setModal('random')} className={btnQuiet}><Shuffle size={16} /> Случайные</button>
        {crossKeys && (
          <span className="ml-2 inline-flex items-center gap-2 text-sm text-pult-text2">
            <span className="w-2 h-2 rounded-full bg-sky-300" />
            подсвечены песни игры «{p.games.find(g => g.id === crossGameId)?.name}»
            <button onClick={() => setCrossGameId('')} className="text-pult-muted hover:text-pult-text" title="Убрать подсветку"><X size={14} /></button>
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 min-h-0 flex-1">
        {/* ── ЛЕВО: вся база ── */}
        <section className="flex flex-col min-h-0 rounded-xl border border-white/[0.08] bg-pult-card">
          <header className="p-4 pb-3 flex flex-col gap-3 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div className="inline-flex rounded-lg bg-pult-raised p-0.5 border border-white/[0.06]">
                {([['db', 'Моя база'], ['catalog', 'Каталог']] as const).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => switchSource(k)}
                    className={`h-8 px-3 rounded-md text-sm transition-colors ${source === k ? 'bg-pult-card text-pult-text' : 'text-pult-text2 hover:text-pult-text'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="font-mono text-xs tabular-nums text-pult-muted">{left.length} песен</span>
            </div>
            {source === 'catalog' ? (
              <form onSubmit={e => { e.preventDefault(); runCatalogSearch(); }} className="grid grid-cols-[1fr_auto] gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pult-muted" />
                  <input value={catalogQuery} onChange={e => setCatalogQuery(e.target.value)} placeholder="Поиск по всему каталогу: исполнитель или песня" className={`${field} pl-8`} />
                </div>
                <button type="submit" disabled={catalogLoading || !catalogQuery.trim()} className={`${btn} bg-lime text-[#141415] hover:bg-[#d4ff63] min-w-[84px] justify-center`}>
                  {catalogLoading ? <Loader2 size={16} className="animate-spin" /> : 'Найти'}
                </button>
              </form>
            ) : (
            <div className="grid grid-cols-[1fr_160px] gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pult-muted" />
                <input value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Исполнитель или название" className={`${field} pl-8`} />
              </div>
              <select value={tag} onChange={e => { setTag(e.target.value); setPage(0); }} className={field}>
                <option value="">Все теги</option>
                {p.dbTags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2 text-pult-text2 cursor-pointer">
                <input type="checkbox" checked={allLeftOnPage} disabled={p.locked} onChange={() => {
                  const n = new Set(leftSel);
                  leftPage.forEach(t => allLeftOnPage ? n.delete(String(t.id)) : n.add(String(t.id)));
                  setLeftSel(n);
                }} className="accent-lime w-4 h-4" />
                Выбрать страницу
              </label>
              <label className="inline-flex items-center gap-2 text-pult-text2 cursor-pointer">
                <input type="checkbox" checked={hideBlocked} onChange={e => { setHideBlocked(e.target.checked); setPage(0); }} className="accent-lime w-4 h-4" />
                Скрыть повторы исполнителей
              </label>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-0.5">
            {leftPage.map(t => renderRow(t, 'l'))}
            {leftPage.length === 0 && (
              <p className="p-6 text-center text-sm text-pult-muted">
                {source === 'catalog' && !catalogSearched
                  ? 'Найди песни в общем каталоге — их можно добавить в плейлист сразу, без сохранения в базу'
                  : 'Ничего не найдено'}
              </p>
            )}
          </div>
          <footer className="flex items-center justify-between px-4 h-12 border-t border-white/[0.06] text-sm text-pult-text2">
            <span className="font-mono tabular-nums">выбрано {leftSel.size}</span>
            <span className="inline-flex items-center gap-1">
              <button disabled={curPage === 0} onClick={() => setPage(curPage - 1)} className="p-1.5 rounded-md hover:bg-pult-raised disabled:opacity-30"><ChevronLeft size={16} /></button>
              <span className="font-mono tabular-nums text-pult-muted">{curPage + 1} / {pages}</span>
              <button disabled={curPage >= pages - 1} onClick={() => setPage(curPage + 1)} className="p-1.5 rounded-md hover:bg-pult-raised disabled:opacity-30"><ChevronRight size={16} /></button>
            </span>
          </footer>
        </section>

        {/* ── перенос ── */}
        <div className="flex flex-col items-center justify-center gap-2">
          <button
            disabled={p.locked || leftSel.size === 0}
            onClick={addSelected}
            title="Добавить отмеченные в плейлист"
            className="h-10 w-10 rounded-lg inline-flex items-center justify-center bg-lime text-[#141415] hover:bg-[#d4ff63] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowRight size={18} />
          </button>
          <button
            disabled={p.locked || rightSel.size === 0}
            onClick={removeSelected}
            title="Убрать отмеченные из плейлиста"
            className="h-10 w-10 rounded-lg inline-flex items-center justify-center bg-pult-raised text-pult-text border border-white/[0.06] hover:bg-[#2b2b2e] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={18} />
          </button>
        </div>

        {/* ── ПРАВО: плейлист ── */}
        <section className="flex flex-col min-h-0 rounded-xl border border-white/[0.08] bg-pult-card">
          <header className="p-4 pb-3 flex flex-col gap-3 border-b border-white/[0.06]">
            <div className="flex items-baseline justify-between">
              <h3 className="text-base font-medium text-pult-text">В плейлисте</h3>
              <span className="font-mono text-xs tabular-nums text-pult-muted">{p.playlist.tracks.length} песен</span>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pult-muted" />
              <input value={rightQuery} onChange={e => setRightQuery(e.target.value)} placeholder="Исполнитель или название" className={`${field} pl-8`} />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-pult-text2 cursor-pointer">
              <input type="checkbox" checked={allRight} disabled={p.locked} onChange={() => setRightSel(allRight ? new Set() : new Set(right.map(t => String(t.id))))} className="accent-lime w-4 h-4" />
              Выбрать все
            </label>
          </header>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-0.5">
            {right.map(t => renderRow(t, 'r'))}
            {right.length === 0 && <p className="p-6 text-center text-sm text-pult-muted">Плейлист пуст — отметь песни слева и нажми стрелку</p>}
          </div>
          <footer className="flex items-center px-4 h-12 border-t border-white/[0.06] text-sm text-pult-text2">
            <span className="font-mono tabular-nums">выбрано {rightSel.size}</span>
          </footer>
        </section>
      </div>

      {/* ── модалки ── */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-pult-card p-6" onClick={e => e.stopPropagation()}>
            {modal === 'random' && (
              <>
                <h3 className="text-lg font-medium text-pult-text mb-1">Случайные песни</h3>
                <p className="text-sm text-pult-text2 mb-5">
                  Берутся из того, что сейчас отфильтровано слева ({left.length}). Исполнители не повторяются, поэтому песен может добавиться меньше
                </p>
                <label className="block text-xs text-pult-muted mb-1.5">Сколько добавить</label>
                <input type="text" inputMode="numeric" value={randomCount} onFocus={e => e.target.select()}
                  onChange={e => setRandomCount(e.target.value.replace(/[^\d]/g, ''))} className={`${field} h-10 font-mono tabular-nums mb-6`} />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setModal(null)} className={btnQuiet}>Отмена</button>
                  <button onClick={addRandom} disabled={!(parseInt(randomCount, 10) > 0) || left.length === 0}
                    className={`${btn} bg-lime text-[#141415] hover:bg-[#d4ff63]`}>Добавить</button>
                </div>
              </>
            )}

            {modal === 'fromRound' && (
              <>
                <h3 className="text-lg font-medium text-pult-text mb-1">Песни из другого тура</h3>
                <p className="text-sm text-pult-text2 mb-5">Добавятся песни плейлиста выбранного тура. Повторы исполнителей пропускаются</p>
                <label className="block text-xs text-pult-muted mb-1.5">Игра</label>
                <select value={srcGameId} onChange={e => { setSrcGameId(e.target.value); setSrcRoundId(''); }} className={`${field} h-10 mb-4`}>
                  <option value="">Выбери игру</option>
                  {p.games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <label className="block text-xs text-pult-muted mb-1.5">Тур</label>
                <select value={srcRoundId} onChange={e => setSrcRoundId(e.target.value)} disabled={!srcGame} className={`${field} h-10 mb-6`}>
                  <option value="">Выбери тур</option>
                  {srcGame?.rounds.map(r => {
                    const pl = p.playlists.find(x => x.id === r.playlistId);
                    return <option key={r.id} value={r.id}>{r.name}{pl ? ` · ${pl.tracks.length} песен` : ''}</option>;
                  })}
                </select>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setModal(null)} className={btnQuiet}>Отмена</button>
                  <button onClick={loadFromRound} disabled={!srcRoundId} className={`${btn} bg-lime text-[#141415] hover:bg-[#d4ff63]`}>Добавить</button>
                </div>
              </>
            )}

            {modal === 'cross' && (
              <>
                <h3 className="text-lg font-medium text-pult-text mb-1">Пересечение с игрой</h3>
                <p className="text-sm text-pult-text2 mb-5">
                  Песни, которые уже звучали на выбранной игре, получат метку «было» — в обоих списках. Удобно, чтобы постоянные гости не слышали одно и то же
                </p>
                <label className="block text-xs text-pult-muted mb-1.5">Игра</label>
                <select value={crossGameId} onChange={e => setCrossGameId(e.target.value)} className={`${field} h-10 mb-6`}>
                  <option value="">Без подсветки</option>
                  {p.games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <div className="flex justify-end">
                  <button onClick={() => setModal(null)} className={`${btn} bg-lime text-[#141415] hover:bg-[#d4ff63]`}>Готово</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
