/*
  # Add preview start/end seconds to tracks

  Позволяет привязать к загруженному MP3 «фрагмент»: при воспроизведении
  плеер начинает с preview_start и останавливается на preview_end.
  Сам файл не режется — просто две метки в секундах от начала.

  - preview_start: numeric (секунды от 0), nullable. NULL = с начала
  - preview_end:   numeric (секунды от 0), nullable. NULL = до конца
*/

ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS preview_start numeric,
  ADD COLUMN IF NOT EXISTS preview_end   numeric;
