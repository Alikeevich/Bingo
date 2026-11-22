import { Track } from '../types';

// Поиск — по стору US: там полный западный каталог И рус/каз артисты (в kz-сторе
// западное урезано лицензиями). Ссылки на превью iTunes не протухают, поэтому
// такие песни можно класть в плейлист сразу, без сохранения в базу.
export const COUNTRY_SEARCH = 'us';

// Обложку 100x100 апскейлим до 600x600
export const bigCover = (url: string) => (url || '').replace(/\/\d+x\d+bb\./, '/600x600bb.');

// iTunes Search result → Track
export const parseITunes = (results: any[]): Track[] =>
  results
    .filter((t) => t.previewUrl && t.trackName)
    .map((t) => ({
      id: t.trackId,
      title: t.trackName,
      artist: t.artistName,
      cover: bigCover(t.artworkUrl100 || t.artworkUrl60 || ''),
      preview: t.previewUrl,
      isCustom: false,
    }));

export async function searchITunes(query: string, limit = 200): Promise<Track[]> {
  const res = await fetch(`/api/itunes/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}&country=${COUNTRY_SEARCH}`);
  const data = await res.json();
  return parseITunes(data.results || []);
}
