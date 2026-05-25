import { Template, TemplateConfig, DEFAULT_TEMPLATE_CONFIG } from '../types';

// Приводит любой template (старая или новая схема config) к актуальному формату.
// Старые шаблоны (bgColor/cardTitle/layout '1'|'2'|'4') теряют декоративные настройки —
// но получают дефолтные слоты, фон-картинку (если был) и могут быть допилены в редакторе.
export function migrateTemplate(t: Template): Template {
  return { ...t, config: migrateTemplateConfig(t.config as any) };
}

export function migrateTemplateConfig(raw: any): TemplateConfig {
  if (raw && raw.grid && raw.idSlot && raw.qrSlot && typeof raw.backgroundImageUrl !== 'undefined') {
    // Уже новая схема — мерджим с дефолтом
    // Если поле .source отсутствует в trackTitle/trackArtist (шаблоны до этой правки),
    // считаем что использовалась легаси-семантика: главная строка = название, доп. = исполнитель.
    // Так визуально ничего не меняется для тех кто уже включил доп. строку.
    return {
      ...DEFAULT_TEMPLATE_CONFIG,
      ...raw,
      grid:        { ...DEFAULT_TEMPLATE_CONFIG.grid,        ...raw.grid },
      idSlot:      { ...DEFAULT_TEMPLATE_CONFIG.idSlot,      ...raw.idSlot },
      qrSlot:      { ...DEFAULT_TEMPLATE_CONFIG.qrSlot,      ...raw.qrSlot },
      trackTitle:  {
        ...DEFAULT_TEMPLATE_CONFIG.trackTitle,
        source: 'title',                     // legacy semantics
        ...raw.trackTitle,                   // явное значение source из raw переопределяет
      },
      trackArtist: {
        ...DEFAULT_TEMPLATE_CONFIG.trackArtist,
        source: 'artist',                    // legacy semantics
        ...raw.trackArtist,
      },
      freeSpace:   { ...DEFAULT_TEMPLATE_CONFIG.freeSpace,   ...raw.freeSpace },
      idText:      { ...DEFAULT_TEMPLATE_CONFIG.idText,      ...raw.idText },
      idSubText:   { ...DEFAULT_TEMPLATE_CONFIG.idSubText,   ...raw.idSubText },
    };
  }
  // Старая схема — берём текущий дефолт (главный=artist, доп. выключена) + переносим что есть
  return {
    ...DEFAULT_TEMPLATE_CONFIG,
    backgroundImageUrl: raw?.backgroundImageUrl ?? DEFAULT_TEMPLATE_CONFIG.backgroundImageUrl,
    orientation: raw?.layout === '2' ? 'landscape' : 'portrait',
    qrSlot: { ...DEFAULT_TEMPLATE_CONFIG.qrSlot, enabled: raw?.showQR ?? true },
    freeSpace: { ...DEFAULT_TEMPLATE_CONFIG.freeSpace, content: raw?.centerText ?? DEFAULT_TEMPLATE_CONFIG.freeSpace.content },
    idSubText: { ...DEFAULT_TEMPLATE_CONFIG.idSubText, content: raw?.footerText ?? DEFAULT_TEMPLATE_CONFIG.idSubText.content },
    qrPayloadTemplate: raw?.qrUrl ?? DEFAULT_TEMPLATE_CONFIG.qrPayloadTemplate,
  };
}
