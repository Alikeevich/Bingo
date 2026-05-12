export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at?: string;
}

export interface Track {
  id: number | string;
  title: string;
  artist: string;
  cover: string;
  preview: string;
  isCustom?: boolean;
  tags?: string[];
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  created_at?: string;
}

export interface BingoCard {
  id: string;
  cells: (Track | { isFreeSpace: true })[];
}

export interface Round {
  id: string;
  name: string;
  playlistId: string;
  winCondition: '1_line' | '2_lines' | 'full';
  cards?: BingoCard[];
}

export interface Game {
  id: string;
  name: string;
  rounds: Round[];
  created_at?: string;
}

// ────────────────────────────────────────────────────────────────────────
// Шаблон карточки = дизайнерский A4-фон (PNG) + 3 динамических слота на нём
// Все координаты — в МИЛЛИМЕТРАХ от верхнего-левого угла страницы
// ────────────────────────────────────────────────────────────────────────

export interface SlotRect {
  x: number;       // mm от левого края
  y: number;       // mm от верхнего края
  width: number;   // mm
  height: number;  // mm
}

export interface GridSlot extends SlotRect {
  cols: number;    // обычно 5
  rows: number;    // обычно 5
  cellGap: number; // mm — внутренний отступ между клетками
  cellPad: number; // mm — отступ от края клетки до текста
}

export interface QrSlot extends SlotRect {
  enabled: boolean;
  margin: number;  // mm — белый ободок вокруг QR внутри слота
}

export interface TextStyle {
  fontFamily: string;   // одно из ALLOWED_FONTS
  fontSize: number;     // pt (1pt ≈ 0.353mm)
  color: string;        // hex
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  lineClamp?: number;   // макс. строк (0 = без ограничения)
}

export interface TemplateConfig {
  // Дизайнерский фон страницы (A4 PNG/JPG); если не задан — печатается белый лист
  backgroundImageUrl: string;
  orientation: 'portrait' | 'landscape';

  // Слоты
  grid:    GridSlot;
  idSlot:  SlotRect;
  qrSlot:  QrSlot;

  // Стили текста
  trackTitle:  TextStyle;
  trackArtist: TextStyle & { enabled: boolean };
  freeSpace:   TextStyle & { content: string };
  idText:      TextStyle & { prefix: string };   // напр. "ID: #"
  idSubText:   TextStyle & { enabled: boolean; content: string };

  // Данные для QR (если пусто — берётся текст "MUZ-{cardId}")
  qrPayloadTemplate?: string;  // напр. "https://muzbingo.app/card/{id}"
}

export interface Template {
  id: string;
  name: string;
  config: TemplateConfig;
  created_at?: string;
}

// ────────────────────────────────────────────────────────────────────────
// Дефолтный шаблон под bundled-фон public/default-template-bg.png
// (координаты подобраны вручную под этот макет дизайнера)
// ────────────────────────────────────────────────────────────────────────

export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  backgroundImageUrl: '/default-template-bg.png',
  orientation: 'portrait',
  grid:   { x: 15,  y: 44,  width: 180, height: 212, cols: 5, rows: 5, cellGap: 0, cellPad: 2 },
  idSlot: { x: 15,  y: 260, width: 25,  height: 25 },
  qrSlot: { x: 170, y: 260, width: 25,  height: 25, enabled: true, margin: 1 },

  trackTitle:  { fontFamily: 'Roboto',     fontSize: 9,  color: '#111111', bold: true,  align: 'center', lineClamp: 2 },
  trackArtist: { fontFamily: 'Roboto',     fontSize: 7,  color: '#444444', italic: true, align: 'center', lineClamp: 1, enabled: true },
  freeSpace:   { fontFamily: 'Roboto',     fontSize: 12, color: '#8b5cf6', bold: true,  align: 'center', content: 'FREE' },
  idText:      { fontFamily: 'RobotoMono', fontSize: 8,  color: '#111111', bold: true,  align: 'center', prefix: 'ID: ' },
  idSubText:   { fontFamily: 'Roboto',     fontSize: 6,  color: '#666666', align: 'center', enabled: true, content: 'MuzBingo' },

  qrPayloadTemplate: 'MUZ-{id}',
};
