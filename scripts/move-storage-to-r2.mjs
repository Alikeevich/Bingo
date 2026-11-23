// Переносит MP3 из Supabase Storage (bucket audio-tracks) в Cloudflare R2.
//
// Зачем: бесплатный Supabase Storage — 1 ГБ на весь проект. При переполнении Supabase
// после льготного периода отвечает 402 на ВСЕ запросы проекта: пульт, плейлисты,
// запись гостей. В R2 10 ГБ бесплатно, туда уже ложатся полные версии песен.
//
// Шаги (каждый следующий — только явным флагом):
//   node scripts/move-storage-to-r2.mjs            — пробный прогон: что и сколько будет перенесено
//   node scripts/move-storage-to-r2.mjs --apply    — копирует в R2, сверяет размер, меняет ссылки
//                                                    в tracks, playlists и games
//   node scripts/move-storage-to-r2.mjs --delete   — удаляет из Supabase только те файлы, у которых
//                                                    копия в R2 проверена и на старую ссылку больше
//                                                    никто не ссылается
//
// Нужны в .env.local: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL.
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const APPLY = process.argv.includes('--apply');
const DELETE = process.argv.includes('--delete');
const BUCKET = 'audio-tracks';

const env = {};
for (const line of fs.readFileSync(path.resolve('.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}
const need = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'];
const missing = need.filter(k => !env[k]);
if (missing.length) { console.error('Нет в .env.local:', missing.join(', ')); process.exit(1); }

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const s3 = new S3Client({ region: 'auto', endpoint: env.R2_ENDPOINT, credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } });
const r2Public = env.R2_PUBLIC_URL.replace(/\/+$/, '');
const oldPublic = name => supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
// Тот же формат ключа, что у /api/r2-sign: tracks/<имя>.mp3 — его потом можно удалить из пульта
const r2Key = name => 'tracks/' + name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]/g, '_') + '.mp3';
const mb = b => (b / 1048576).toFixed(0) + ' МБ';

async function listAll() {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000, offset: off });
    if (error) throw error;
    out.push(...data.filter(f => f.id !== null).map(f => ({ name: f.name, size: f.metadata?.size || 0, type: f.metadata?.mimetype || '' })));
    if (data.length < 1000) break;
  }
  return out;
}

async function loadAll(table, cols) {
  let rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from + 999);
    if (error) throw error;
    rows = rows.concat(data);
    if (data.length < 1000) break;
  }
  return rows;
}

// Сеть рвётся (ECONNRESET и т.п.) — повторяем с паузой, а не роняем весь перенос
async function retry(fn, tries = 5) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries) throw e;
      await new Promise(r => setTimeout(r, 2000 * i));
    }
  }
}

async function r2Size(url) {
  return retry(async () => {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok ? Number(r.headers.get('content-length') || 0) : -1;
  });
}

const files = await listAll();
const mp3 = files.filter(f => /\.mp3$/i.test(f.name) || f.type === 'audio/mpeg');
const other = files.filter(f => !mp3.includes(f));
console.log(`В Supabase Storage: ${files.length} файлов, ${mb(files.reduce((s, f) => s + f.size, 0))}`);
console.log(`  MP3 к переносу: ${mp3.length}, ${mb(mp3.reduce((s, f) => s + f.size, 0))}`);
if (other.length) console.log(`  не MP3 (остаются как есть): ${other.map(f => f.name).join(', ')}`);

// старая ссылка → новая
const map = new Map(mp3.map(f => [oldPublic(f.name), `${r2Public}/${r2Key(f.name)}`]));

if (APPLY) {
  let done = 0;
  for (const f of mp3) {
    const newUrl = map.get(oldPublic(f.name));
    if ((await r2Size(newUrl)) === f.size) { done++; continue; } // уже перенесён
    const body = await retry(async () => {
      const { data, error } = await supabase.storage.from(BUCKET).download(f.name);
      if (error) throw new Error(`${f.name}: ${error.message}`);
      return Buffer.from(await data.arrayBuffer());
    });
    await retry(() => s3.send(new PutObjectCommand({
      Bucket: env.R2_BUCKET, Key: r2Key(f.name), Body: body,
      ContentType: 'audio/mpeg', CacheControl: 'public, max-age=31536000, immutable',
    })));
    const got = await r2Size(newUrl);
    if (got !== body.length) throw new Error(`${f.name}: в R2 ${got} байт вместо ${body.length} — останавливаюсь`);
    done++;
    process.stdout.write(`\r  скопировано ${done}/${mp3.length}`);
  }
  console.log(`\n  все ${done} файлов в R2, размеры сверены`);

  // Ссылки в базе: строковая замена старого URL на новый во всех местах, где лежат снимки треков
  const swap = v => {
    let s = JSON.stringify(v);
    let changed = false;
    for (const [from, to] of map) if (s.includes(from)) { s = s.split(from).join(to); changed = true; }
    return changed ? JSON.parse(s) : null;
  };
  let nTracks = 0;
  for (const t of await loadAll('tracks', 'id, preview, mp3_path')) {
    const patch = {};
    if (map.has(t.preview)) patch.preview = map.get(t.preview);
    if (t.mp3_path && !/^https?:/.test(t.mp3_path) && map.has(oldPublic(t.mp3_path))) patch.mp3_path = map.get(oldPublic(t.mp3_path));
    if (Object.keys(patch).length) {
      const { error } = await supabase.from('tracks').update(patch).eq('id', t.id);
      if (error) throw error;
      nTracks++;
    }
  }
  let nPl = 0;
  for (const p of await loadAll('playlists', 'id, tracks')) {
    const next = swap(p.tracks);
    if (next) { const { error } = await supabase.from('playlists').update({ tracks: next }).eq('id', p.id); if (error) throw error; nPl++; }
  }
  let nGames = 0;
  for (const g of await loadAll('games', 'id, rounds')) {
    const next = swap(g.rounds);
    if (next) { const { error } = await supabase.from('games').update({ rounds: next }).eq('id', g.id); if (error) throw error; nGames++; }
  }
  console.log(`  ссылки обновлены: треков ${nTracks}, плейлистов ${nPl}, игр ${nGames}`);
}

if (DELETE) {
  // Удаляем только проверенное: копия в R2 того же размера и ни одной старой ссылки в базе
  // Имя файла совпадает с id «своего» трека, поэтому ищем только ссылки: старый публичный
  // URL где угодно и голое имя в mp3_path. По id пульт теперь играет из preview (R2).
  const dump = JSON.stringify([
    await loadAll('tracks', 'preview'),
    await loadAll('playlists', 'tracks'),
    await loadAll('games', 'rounds'),
  ]);
  const mp3Names = new Set((await loadAll('tracks', 'mp3_path')).map(t => t.mp3_path).filter(Boolean));
  const removable = [];
  for (const f of mp3) {
    const oldUrl = oldPublic(f.name);
    if (dump.includes(oldUrl) || mp3Names.has(f.name)) { console.log(`  оставляю ${f.name}: на него ещё есть ссылка`); continue; }
    if ((await r2Size(map.get(oldUrl))) !== f.size) { console.log(`  оставляю ${f.name}: копии в R2 нет`); continue; }
    removable.push(f.name);
  }
  for (let i = 0; i < removable.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(removable.slice(i, i + 100));
    if (error) throw error;
  }
  console.log(`  удалено из Supabase: ${removable.length} файлов, ${mb(mp3.filter(f => removable.includes(f.name)).reduce((s, f) => s + f.size, 0))}`);
}

if (!APPLY && !DELETE) console.log('\nПробный прогон, ничего не изменено. Дальше: --apply, потом --delete');
