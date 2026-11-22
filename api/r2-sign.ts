// POST /api/r2-sign — выдаёт presigned URL для прямой загрузки MP3 в Cloudflare R2.
//
// Почему presigned, а не загрузка через эту функцию: serverless на Vercel ограничивает
// размер тела запроса (~4.5 МБ), а сжатый трек может весить больше. При presigned файл
// идёт из браузера прямо в R2 — без лимита и без лишнего трафика через Vercel.
//
// Секреты живут только в env на сервере и в браузер не попадают.
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';

// Только вошедший ведущий. Раньше функция подписывала загрузку и удаляла файлы для
// любого: ключ файла виден в публичной ссылке на трек, и посторонний мог стереть
// полные версии песен прямо перед игрой.
async function isSignedIn(req: any): Promise<boolean> {
  const auth = String(req.headers?.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return false;
  try {
    const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.getUser(token);
    return !error && !!data?.user;
  } catch {
    return false;
  }
}

// Удалять можно только файлы треков, которые сами и загружали: tracks/<id>_<время>.mp3
const TRACK_KEY = /^tracks\/[A-Za-z0-9_-]+\.mp3$/;

function client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const s3 = client();
  const bucket = process.env.R2_BUCKET;
  const publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  if (!s3 || !bucket || !publicUrl) {
    res.status(500).json({ error: 'R2 is not configured' });
    return;
  }

  if (!(await isSignedIn(req))) {
    res.status(401).json({ error: 'sign in required' });
    return;
  }

  let body: any = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  // Удаление файла (когда убираем полную версию у трека)
  if (body.action === 'delete') {
    const key = String(body.key || '');
    if (!TRACK_KEY.test(key)) {
      res.status(400).json({ error: 'bad key' });
      return;
    }
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      res.status(200).json({ ok: true });
    } catch (e: any) {
      res.status(502).json({ error: e?.message || 'delete failed' });
    }
    return;
  }

  // Подпись на загрузку
  const trackId = String(body.trackId || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!trackId) {
    res.status(400).json({ error: 'trackId is required' });
    return;
  }
  const key = `tracks/${trackId}_${Date.now()}.mp3`;

  try {
    const signedUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: 'audio/mpeg',
        // Имя файла уникально (id + timestamp), содержимое не меняется — можно
        // кэшировать навсегда. Без этого браузер каждый раз переспрашивал файл,
        // что на слабом интернете в заведении давало паузы между треками.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
      { expiresIn: 900 } // 15 минут на загрузку — с запасом даже на медленном интернете
    );
    res.status(200).json({ signedUrl, key, publicUrl: `${publicUrl}/${key}` });
  } catch (e: any) {
    res.status(502).json({ error: e?.message || 'sign failed' });
  }
}
