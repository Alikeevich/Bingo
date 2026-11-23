import { supabase } from '../supabase';

// /api/r2-sign пускает только вошедшего ведущего — передаём его токен Supabase
export const authHeader = async (): Promise<Record<string, string>> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Кладёт MP3 в Cloudflare R2 и возвращает публичную ссылку.
 * Все MP3 живут в R2 (10 ГБ бесплатно): бесплатный Supabase Storage — всего 1 ГБ,
 * и при переполнении Supabase блокирует весь проект, включая базу и запись гостей.
 * Бросает ошибку, если R2 недоступен, — вызывающий решает, что делать дальше.
 */
export async function uploadMp3ToR2(blob: Blob, trackId: string): Promise<string> {
  const signRes = await fetch('/api/r2-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ trackId }),
  });
  if (!signRes.ok) throw new Error(`r2-sign ${signRes.status}`);
  const { signedUrl, publicUrl } = await signRes.json();
  const put = await fetch(signedUrl, {
    method: 'PUT',
    body: blob,
    // Content-Type и Cache-Control обязаны совпадать с тем, что заложено в подпись,
    // иначе R2 отклонит загрузку с ошибкой подписи.
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
  if (!put.ok) throw new Error(`R2 отказал (${put.status})`);
  return publicUrl;
}

// Загружать можно только MP3: так файл гарантированно ляжет в R2 и сыграет в любом браузере.
// Новые форматы добавляем осознанно, по просьбе ведущих.
export const isMp3File = (f: File) => /\.mp3$/i.test(f.name) || f.type === 'audio/mpeg';
export const MP3_ONLY_MSG = 'Можно загружать только MP3. Другие форматы пока не поддерживаются';
export const MP3_ACCEPT = '.mp3,audio/mpeg';
