export const chunkArray = (arr: any[], size: number) =>
  arr.reduce((acc: any[], _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]),[]);

export const formatTime = (time: number) => {
  if (isNaN(time) || !isFinite(time)) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const getProxiedUrl = (url: string): string => {
  if (!url) return url;
  return url.replace('http://', 'https://');
};