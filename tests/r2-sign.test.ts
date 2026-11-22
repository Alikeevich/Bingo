import { describe, it, expect, beforeAll } from 'vitest';
import handler from '../api/r2-sign';

// Минимальная подделка req/res Vercel: ловим статус и тело ответа
function call(body: unknown, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; json: any }>((resolve) => {
    const res = {
      code: 0,
      status(c: number) { this.code = c; return this; },
      json(j: unknown) { resolve({ status: this.code, json: j }); },
    };
    handler({ method: 'POST', headers, body }, res);
  });
}

beforeAll(() => {
  Object.assign(process.env, {
    R2_ENDPOINT: 'https://example.invalid', R2_ACCESS_KEY_ID: 'x', R2_SECRET_ACCESS_KEY: 'x',
    R2_BUCKET: 'b', R2_PUBLIC_URL: 'https://cdn.example.invalid',
    VITE_SUPABASE_URL: 'https://sb.example.invalid', VITE_SUPABASE_ANON_KEY: 'anon',
  });
});

describe('/api/r2-sign', () => {
  it('без входа ведущего нельзя удалить MP3 трека — иначе любой, кто видел ссылку, ломает игру', async () => {
    const r = await call({ action: 'delete', key: 'tracks/123_1700000000000.mp3' });
    expect(r.status).toBe(401);
  });

  it('без входа нельзя получить ссылку на загрузку', async () => {
    const r = await call({ trackId: '123' });
    expect(r.status).toBe(401);
  });
});
