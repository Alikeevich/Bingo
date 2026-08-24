#!/usr/bin/env node
/**
 * Массовая заливка полных MP3 в MuzBingo.
 *
 * Что делает:
 *   1. читает папку с аудиофайлами
 *   2. сопоставляет каждый файл с треком в базе (по «Исполнитель - Название» из имени файла)
 *   3. сжимает через ffmpeg до 128 kbps
 *   4. заливает в Cloudflare R2
 *   5. проставляет mp3_path у трека
 *
 * Запуск:
 *   node scripts/bulk-upload.mjs --dir "C:/музыка"            # посмотреть совпадения (ничего не меняет)
 *   node scripts/bulk-upload.mjs --dir "C:/музыка" --go       # реально залить
 *   node scripts/bulk-upload.mjs --dir "C:/музыка" --go --limit 5
 *
 * Ключи читаются из .env.local (тот же файл, что использует dev-сервер).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const run = promisify(execFile);

// ── аргументы ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argOf = (name, def = null) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};
const DIR = argOf('--dir');
const GO = args.includes('--go');
const LIMIT = Number(argOf('--limit', '0')) || 0;
const BITRATE = argOf('--bitrate', '128');

if (!DIR) {
  console.error('Укажи папку: --dir "C:/путь/к/музыке"');
  process.exit(1);
}

// ── env из .env.local ────────────────────────────────────────────────────
const env = {};
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
}
const need = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'];
const missing = need.filter(k => !env[k] && !process.env[k]);
const SUPA_URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (missing.length) { console.error('Нет ключей в .env.local:', missing.join(', ')); process.exit(1); }
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Нужны VITE_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local');
  process.exit(1);
}
const val = k => env[k] || process.env[k];

const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
const s3 = new S3Client({
  region: 'auto',
  endpoint: val('R2_ENDPOINT'),
  credentials: { accessKeyId: val('R2_ACCESS_KEY_ID'), secretAccessKey: val('R2_SECRET_ACCESS_KEY') },
});

// ── нормализация для сопоставления ───────────────────────────────────────
const norm = s => (s || '')
  .toLowerCase()
  .replace(/\.(mp3|m4a|wav|flac|ogg|aac)$/i, '')
  .replace(/[([{].*$/, '')          // «(feat. …)», «(Remastered)»
  .replace(/\s-\s(radio edit|remix|remastered).*$/i, '')
  .replace(/\b(feat|ft|featuring)\b.*$/i, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')  // только буквы/цифры (работает и с кириллицей)
  .trim()
  .replace(/\s+/g, ' ');

// «Artist - Title.mp3» → { artist, title }; если разделителя нет — всё в title
const parseName = file => {
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  const parts = base.split(/\s+[-–—]\s+/);
  return parts.length > 1
    ? { artist: parts[0], title: parts.slice(1).join(' - ') }
    : { artist: '', title: base };
};

// Оценка совпадения файла и трека из базы: 0 — мимо, больше — лучше
const score = (f, t) => {
  const fT = norm(f.title), fA = norm(f.artist);
  const tT = norm(t.title), tA = norm(t.artist);
  if (!fT || !tT) return 0;
  const titleHit = tT === fT || tT.includes(fT) || fT.includes(tT);
  if (!titleHit) return 0;
  let s = tT === fT ? 3 : 1;
  if (fA && tA && (tA.includes(fA) || fA.includes(tA))) s += 2;
  return s;
};

// ── основной сценарий ────────────────────────────────────────────────────
const files = fs.readdirSync(DIR)
  .filter(f => /\.(mp3|m4a|wav|flac|ogg|aac)$/i.test(f))
  .sort();
if (!files.length) { console.error('В папке нет аудиофайлов:', DIR); process.exit(1); }

const { data: tracks, error } = await supabase
  .from('tracks').select('id,title,artist,mp3_path,is_custom');
if (error) { console.error('Supabase:', error.message); process.exit(1); }

console.log(`Файлов в папке: ${files.length} | треков в базе: ${tracks.length}`);
console.log(GO ? 'РЕЖИМ: заливка\n' : 'РЕЖИМ: пробный прогон (ничего не меняется). Добавь --go чтобы залить.\n');

const plan = [];
const skipped = [];
for (const file of files) {
  const parsed = parseName(file);
  let best = null, bestScore = 0;
  for (const t of tracks) {
    const s = score(parsed, t);
    if (s > bestScore) { bestScore = s; best = t; }
  }
  if (!best) { skipped.push({ file, why: 'нет совпадения в базе' }); continue; }
  if (best.mp3_path) { skipped.push({ file, why: `уже есть полная версия (${best.title})` }); continue; }
  if (plan.some(p => String(p.track.id) === String(best.id))) {
    skipped.push({ file, why: `дубль на тот же трек (${best.title})` });
    continue;
  }
  plan.push({ file, track: best, score: bestScore });
}

console.log('=== БУДЕТ ЗАЛИТО ===');
for (const p of plan.slice(0, LIMIT || plan.length)) {
  const mark = p.score >= 5 ? 'точно' : p.score >= 3 ? 'вероятно' : 'похоже';
  console.log(`  [${mark}] ${p.file}\n           -> ${p.track.artist} — ${p.track.title}`);
}
if (skipped.length) {
  console.log(`\n=== ПРОПУЩЕНО (${skipped.length}) ===`);
  for (const s of skipped.slice(0, 15)) console.log(`  ${s.file} — ${s.why}`);
  if (skipped.length > 15) console.log(`  …и ещё ${skipped.length - 15}`);
}

const todo = LIMIT ? plan.slice(0, LIMIT) : plan;
console.log(`\nИтого к заливке: ${todo.length}`);
if (!GO) { console.log('Это был пробный прогон. Проверь совпадения и запусти с --go'); process.exit(0); }

// ── заливка ──────────────────────────────────────────────────────────────
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muzbingo-'));
let ok = 0, fail = 0, savedBytes = 0;

for (const [i, item] of todo.entries()) {
  const src = path.join(DIR, item.file);
  const out = path.join(tmpDir, `${Date.now()}_${i}.mp3`);
  const label = `[${i + 1}/${todo.length}] ${item.track.artist} — ${item.track.title}`;
  try {
    process.stdout.write(`${label}\n   сжимаю…`);
    await run('ffmpeg', ['-y', '-i', src, '-vn', '-codec:a', 'libmp3lame', '-b:a', `${BITRATE}k`, out]);
    const before = fs.statSync(src).size, after = fs.statSync(out).size;
    savedBytes += Math.max(0, before - after);
    process.stdout.write(` ${(before / 1048576).toFixed(1)}→${(after / 1048576).toFixed(1)} МБ, заливаю…`);

    const key = `tracks/${item.track.id}_${Date.now()}.mp3`;
    await s3.send(new PutObjectCommand({
      Bucket: val('R2_BUCKET'), Key: key,
      Body: fs.readFileSync(out), ContentType: 'audio/mpeg',
    }));

    const publicUrl = `${val('R2_PUBLIC_URL').replace(/\/+$/, '')}/${key}`;
    const { error: upErr } = await supabase
      .from('tracks').update({ mp3_path: publicUrl }).eq('id', item.track.id);
    if (upErr) throw new Error(upErr.message);

    console.log(' готово');
    ok++;
  } catch (e) {
    console.log(`\n   ОШИБКА: ${e.message?.split('\n')[0] || e}`);
    fail++;
  } finally {
    fs.rmSync(out, { force: true });
  }
}
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\nГотово. Залито: ${ok}, ошибок: ${fail}, сэкономлено: ${(savedBytes / 1048576).toFixed(0)} МБ`);
if (ok) console.log('Проверь во вкладке «Миграция MP3» — фильтр «С MP3».');
