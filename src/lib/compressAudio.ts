import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Сжимает аудиофайл в MP3 заданного битрейта прямо в браузере.
 * Декодирует любой формат, который понимает браузер (mp3/wav/m4a/ogg/flac),
 * поэтому годится и для перекодирования уже существующих MP3 в меньший размер.
 *
 * Зачем: треки с 320 kbps весят ~6 МБ — в бесплатный тариф хранилища влезает ~160 штук.
 * На 128 kbps то же самое весит ~2.5 МБ (в пабе через колонки разницы не слышно),
 * и в тот же объём помещается уже ~400 треков.
 */

const BLOCK = 1152; // размер MP3-фрейма, с которым работает энкодер

export type CompressResult = {
  blob: Blob;
  originalBytes: number;
  compressedBytes: number;
  durationSec: number;
};

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function compressAudioToMp3(
  file: File,
  opts: { bitrateKbps?: number; onProgress?: (ratio: number) => void } = {}
): Promise<CompressResult> {
  const bitrate = opts.bitrateKbps ?? 128;
  const arrayBuf = await file.arrayBuffer();

  // AudioContext декодирует всё, что умеет браузер
  const Ctx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx();
  let audioBuf: AudioBuffer;
  try {
    audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    // освобождаем железо — иначе на нескольких файлах браузер упрётся в лимит контекстов
    void ctx.close();
  }

  const channels = Math.min(2, audioBuf.numberOfChannels);
  const sampleRate = audioBuf.sampleRate;
  const left = floatToInt16(audioBuf.getChannelData(0));
  const right =
    channels > 1 ? floatToInt16(audioBuf.getChannelData(1)) : null;

  const encoder = new Mp3Encoder(channels, sampleRate, bitrate);
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < left.length; i += BLOCK) {
    const l = left.subarray(i, i + BLOCK);
    const r = right ? right.subarray(i, i + BLOCK) : undefined;
    const buf = r ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (buf.length > 0) chunks.push(new Uint8Array(buf));
    if (opts.onProgress && i % (BLOCK * 200) === 0) {
      opts.onProgress(Math.min(1, i / left.length));
    }
    // отдаём поток браузеру, чтобы вкладка не «замерзала» на длинных треках
    if (i % (BLOCK * 800) === 0) await new Promise((r2) => setTimeout(r2, 0));
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(new Uint8Array(end));
  opts.onProgress?.(1);

  const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
  return {
    blob,
    originalBytes: file.size,
    compressedBytes: blob.size,
    durationSec: audioBuf.duration,
  };
}

export const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
