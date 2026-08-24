/**
 * Убирает альфа-канал из картинки, подкладывая белый фон.
 *
 * Зачем: если у фонового PNG есть альфа-канал (даже полностью непрозрачный),
 * @react-pdf кладёт в PDF SMask — маску прозрачности. Принтеры из-за неё
 * растрируют страницу и печатают ТУСКЛО, с серым «слоем» поверх макета.
 * Без альфы PDF печатается чётко и файл легче.
 */
export async function flattenToOpaquePng(file: File): Promise<File> {
  // SVG и файлы без альфы трогать незачем
  if (file.type === 'image/svg+xml') return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // не смогли декодировать — отдаём как есть

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  // Белая подложка вместо прозрачности — иначе прозрачные места станут чёрными
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const blob: Blob | null = await new Promise(res =>
    canvas.toBlob(b => res(b), 'image/png')
  );
  if (!blob) return file;

  const name = file.name.replace(/\.[^.]+$/, '') + '.png';
  return new File([blob], name, { type: 'image/png' });
}
