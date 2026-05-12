import { Template, TemplateConfig, DEFAULT_TEMPLATE_CONFIG } from '../types';

// Приводит любой template (старая или новая схема config) к актуальному формату.
// Старые шаблоны (bgColor/cardTitle/layout '1'|'2'|'4') теряют декоративные настройки —
// но получают дефолтные слоты, фон-картинку (если был) и могут быть допилены в редакторе.
export function migrateTemplate(t: Template): Template {
  return { ...t, config: migrateTemplateConfig(t.config as any) };
}

export function migrateTemplateConfig(raw: any): TemplateConfig {
  if (raw && raw.grid && raw.idSlot && raw.qrSlot && typeof raw.backgroundImageUrl !== 'undefined') {
    // Уже новая схема — мерджим с дефолтом, чтобы добить отсутствующие поля
    return {
      ...DEFAULT_TEMPLATE_CONFIG,
      ...raw,
      grid:        { ...DEFAULT_TEMPLATE_CONFIG.grid,        ...raw.grid },
      idSlot:      { ...DEFAULT_TEMPLATE_CONFIG.idSlot,      ...raw.idSlot },
      qrSlot:      { ...DEFAULT_TEMPLATE_CONFIG.qrSlot,      ...raw.qrSlot },
      trackTitle:  { ...DEFAULT_TEMPLATE_CONFIG.trackTitle,  ...raw.trackTitle },
      trackArtist: { ...DEFAULT_TEMPLATE_CONFIG.trackArtist, ...raw.trackArtist },
      freeSpace:   { ...DEFAULT_TEMPLATE_CONFIG.freeSpace,   ...raw.freeSpace },
      idText:      { ...DEFAULT_TEMPLATE_CONFIG.idText,      ...raw.idText },
      idSubText:   { ...DEFAULT_TEMPLATE_CONFIG.idSubText,   ...raw.idSubText },
    };
  }
  // Старая схема — берём дефолт + переносим то что есть
  return {
    ...DEFAULT_TEMPLATE_CONFIG,
    backgroundImageUrl: raw?.backgroundImageUrl ?? DEFAULT_TEMPLATE_CONFIG.backgroundImageUrl,
    orientation: raw?.layout === '2' ? 'landscape' : 'portrait',
    qrSlot: { ...DEFAULT_TEMPLATE_CONFIG.qrSlot, enabled: raw?.showQR ?? true },
    trackArtist: { ...DEFAULT_TEMPLATE_CONFIG.trackArtist, enabled: raw?.showArtist ?? true },
    freeSpace:   { ...DEFAULT_TEMPLATE_CONFIG.freeSpace,   content: raw?.centerText ?? DEFAULT_TEMPLATE_CONFIG.freeSpace.content },
    idSubText:   { ...DEFAULT_TEMPLATE_CONFIG.idSubText,   content: raw?.footerText ?? DEFAULT_TEMPLATE_CONFIG.idSubText.content },
    qrPayloadTemplate: raw?.qrUrl ?? DEFAULT_TEMPLATE_CONFIG.qrPayloadTemplate,
  };
}
