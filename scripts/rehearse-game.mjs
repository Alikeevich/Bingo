#!/usr/bin/env node
/**
 * Проверка перед игрой: очередь каждого тура, проигрываемость КАЖДОГО трека через
 * прод-прокси (как на игре), симуляция побед по реальным карточкам.
 *
 *   node scripts/rehearse-game.mjs                 # самая свежая игра
 *   node scripts/rehearse-game.mjs Экибастуз        # по части названия
 *   node scripts/rehearse-game.mjs 64a78e2d        # по началу id
 *
 * Только чтение: ничего в базе не меняет. Ключи — из .env.local.
 * Логика очереди/побед — копия src/utils.ts и src/lib/cardBuilder.ts:
 * если там что-то поменяется, обнови и здесь.
 */
import fs from 'node:fs';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].trim();
}
const SUPA = env.VITE_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !KEY) { console.error('Нужны VITE_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local'); process.exit(1); }
const get = async t => (await fetch(`${SUPA}/rest/v1/${t}?select=*`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json();
const [games, playlists, tracksRaw, events, signups] = await Promise.all(['games', 'playlists', 'tracks', 'events', 'signups'].map(get));
const GAME_ID = (process.argv[2] || '').toLowerCase();

console.log('\n=== БЛИЖАЙШИЕ ИГРЫ И ЗАПИСИ ===');
for (const e of events.filter(e => new Date(e.starts_at) > Date.now() - 6 * 3600e3).sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
  const s = signups.filter(x => x.event_id === e.id);
  console.log(`  ${new Date(e.starts_at).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })} ${e.city || 'Астана'} · ${e.venue || ''} · цена ${e.price ?? '—'} · заявок ${s.length}, людей ${s.reduce((a, x) => a + (x.people_count || 0), 0)}`);
}

// ── копия utils.ts ──
const splitArtists = a => !a ? [] : a.toLowerCase().replace(/[()[\]]/g, ' ')
  .replace(/\b(feat|ft|featuring|with|vs|versus)\b\.?/gi, ',').replace(/\s+x\s+/gi, ',')
  .replace(/\s+\/\s+/g, ',').replace(/\s+и\s+/gi, ',').replace(/[&×;]/g, ',')
  .split(',').map(x => x.trim()).filter(Boolean);
const songKey = (title, artist) => {
  const full = (title || '').toLowerCase().replace(/[^a-zа-яё0-9]+/gi, ' ').trim().replace(/\s+/g, ' ');
  const stripped = (title || '').toLowerCase().replace(/[([{].*$/, '').replace(/\s-\s.*$/, '')
    .replace(/\b(feat|ft|featuring|with)\b.*$/i, '').replace(/[^a-zа-яё0-9]+/gi, ' ').trim().replace(/\s+/g, ' ');
  return (stripped || full) + '|' + (splitArtists(artist)[0] || (artist || '').trim().toLowerCase());
};
const dbTracks = tracksRaw.map(t => ({
  id: t.id, title: t.title, artist: t.artist, cover: t.cover, preview: t.preview, isCustom: t.is_custom,
  previewStart: t.preview_start, previewEnd: t.preview_end, mp3Path: t.mp3_path || undefined,
}));
const buildPlayQueue = (pt, db) => {
  const fresh = new Map(db.map(t => [String(t.id), t])); const ids = new Set(), songs = new Set(), q = [];
  for (const raw of pt || []) {
    const id = String(raw.id); if (ids.has(id)) continue;
    const f = fresh.get(id); const t = f ? { ...raw, ...f } : raw;
    const k = songKey(t.title, t.artist); if (songs.has(k)) continue;
    ids.add(id); songs.add(k); q.push(t);
  }
  return q;
};
// ── копия cardBuilder.ts ──
const WIN_LINES = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
  [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],[0,6,12,18,24],[4,8,12,16,20]];
const winIndexForCard = (cells, idx, cond) => {
  const cp = cells.map(c => c.isFreeSpace ? -1 : (idx.get(String(c.id)) ?? Infinity));
  const done = WIN_LINES.map(l => Math.max(...l.map(i => cp[i]))).sort((a, b) => a - b);
  if (cond === '1_line') return done[0]; if (cond === '2_lines') return done[1];
  if (cond === '3_lines') return done[2]; return Math.max(...cp);
};

// ── проверка проигрываемости (как resolveTrackUrl в App.tsx) ──
async function head(url) {
  try { const r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1023' }, signal: AbortSignal.timeout(20000) });
    return r.ok || r.status === 206; } catch { return false; }
}
async function checkTrack(t) {
  if (t.mp3Path) {
    const u = /^https?:/i.test(t.mp3Path) ? t.mp3Path : `${SUPA}/storage/v1/object/public/audio-tracks/${t.mp3Path}`;
    return (await head(u)) ? 'ok:MP3' : 'FAIL:MP3 недоступен';
  }
  if (t.isCustom) return (await head(`${SUPA}/storage/v1/object/public/audio-tracks/${encodeURIComponent(String(t.id))}`)) ? 'ok:свой' : 'FAIL:свой файл недоступен';
  const p = t.preview || '';
  if (!p) return 'FAIL:нет превью';
  if (!p.includes('exp=')) return (await head(p)) ? 'ok:превью' : 'FAIL:превью недоступно';
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(`https://muzbingo.com/api/deezer/track/${t.id}`, { signal: AbortSignal.timeout(20000) });
      const d = await r.json();
      if (d?.error?.code === 4) { await new Promise(s => setTimeout(s, 1500)); continue; } // лимит Deezer
      if (!d?.preview) return 'FAIL:Deezer убрал превью';
      return (await head(d.preview)) ? 'ok:Deezer' : 'FAIL:Deezer превью не качается';
    } catch { await new Promise(s => setTimeout(s, 1000)); }
  }
  return 'FAIL:Deezer не отвечает';
}
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

const game = GAME_ID
  ? games.find(g => g.id.toLowerCase().startsWith(GAME_ID) || (g.name || '').toLowerCase().includes(GAME_ID))
  : [...games].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
if (!game) { console.error('Игра не найдена. Есть:', games.map(g => g.name).join(' | ')); process.exit(1); }
console.log(`\n████ ИГРА «${game.name}» — туров ${game.rounds.length}\n`);
for (const r of game.rounds) {
  const pl = playlists.find(p => p.id === r.playlistId);
  console.log(`━━ ${r.name} | ${r.winCondition} | плейлист «${pl?.name}» (${pl?.tracks.length} тр.) | карточек ${r.cards?.length || 0}`);
  if (!pl) { console.log('   !!! ПЛЕЙЛИСТ НЕ НАЙДЕН'); continue; }
  const queue = buildPlayQueue(pl.tracks, dbTracks);
  const dropped = pl.tracks.length - queue.length;
  console.log(`   очередь: ${queue.length} треков${dropped ? ` (выкинуто дублей: ${dropped})` : ''}`);

  const res = await pool(queue, 6, checkTrack);
  const kinds = {}; res.forEach(x => { kinds[x] = (kinds[x] || 0) + 1; });
  console.log('   проигрываемость:', Object.entries(kinds).map(([k, v]) => `${k}=${v}`).join(', '));
  const bad = queue.map((t, i) => ({ t, i, s: res[i] })).filter(x => x.s.startsWith('FAIL'));
  for (const b of bad) console.log(`   !!! #${b.i + 1} ${b.t.artist} — ${b.t.title} [id ${b.t.id}] → ${b.s}`);
  const trimmed = queue.filter(t => t.previewStart || t.previewEnd).length;
  const full = queue.filter(t => t.mp3Path || t.isCustom).length;
  console.log(`   полных MP3: ${full}, с заданным фрагментом: ${trimmed}`);

  const rr = /* сводка тура */ { name: r.name, cond: r.winCondition, playlist: pl.name, queue: queue.length, cards: r.cards?.length || 0,
    bad: bad.map(b => ({ pos: b.i + 1, artist: b.t.artist, title: b.t.title, id: String(b.t.id), why: b.s })) };

  if (r.cards?.length) {
    const idx = new Map(queue.map((t, i) => [String(t.id), i]));
    const badIds = new Set(bad.map(b => String(b.t.id)));
    const wins = r.cards.map(c => ({ id: c.id, at: winIndexForCard(c.cells, idx, r.winCondition),
      notInQueue: c.cells.filter(x => !x.isFreeSpace && !idx.has(String(x.id))).length,
      deadCells: c.cells.filter(x => !x.isFreeSpace && badIds.has(String(x.id))).length }));
    const never = wins.filter(w => !Number.isFinite(w.at));
    const byAt = {}; wins.filter(w => Number.isFinite(w.at)).forEach(w => { (byAt[w.at] ||= []).push(w.id); });
    const crowds = Object.entries(byAt).filter(([, v]) => v.length > 1);
    const ats = wins.map(w => w.at).filter(Number.isFinite).sort((a, b) => a - b);
    console.log(`   симуляция: первая победа на песне №${ats[0] + 1}, последняя на №${ats[ats.length - 1] + 1}`);
    console.log(`   одновременных побед (толпа): ${crowds.length ? crowds.map(([a, v]) => `песня №${+a + 1}: ${v.length} карт.`).join(', ') : 'нет'}`);
    if (never.length) console.log(`   !!! НИКОГДА НЕ ВЫИГРАЮТ: ${never.length} карт. (${never.map(w => w.id.slice(0, 8)).join(', ')})`);
    const withNotQ = wins.filter(w => w.notInQueue); if (withNotQ.length) console.log(`   !!! клетки с треками не из очереди: ${withNotQ.length} карт.`);
    const withDead = wins.filter(w => w.deadCells); if (withDead.length) console.log(`   !!! клетки с неиграющими треками: ${withDead.length} карт.`);
    // Сколько песен нужно, чтобы были разыграны все карточки
    console.log(`   до последней победы надо сыграть ${ats[ats.length - 1] + 1} из ${queue.length} песен`);
    // Песни, на которых что-то выигрывает и которые не играют
    const killers = bad.filter(b => byAt[b.i]);
    if (killers.length) console.log(`   !!! на неиграющей песне кто-то выигрывает: ${killers.map(b => '№' + (b.i + 1)).join(', ')}`);
    Object.assign(rr, { firstWin: ats[0] + 1, lastWin: ats[ats.length - 1] + 1, crowds: crowds.length, never: never.length,
      notInQueue: withNotQ.length, deadCells: withDead.length });
  }
  console.log();
}
