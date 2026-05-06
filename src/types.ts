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
  tags?: string[]; // <-- Новое поле
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

export interface TemplateConfig {
  bgColor: string;
  textColor: string;
  accentColor: string;
  fontFamily?: string
  gridColor: string;
  cardTitle: string;
  showArtist: boolean;
  centerText: string;
  footerText: string;
  showQR: boolean;
  layout: '1' | '2' | '4';
  backgroundImageUrl?: string;
  qrUrl?: string;
  fontFamily?: string;
}

export interface Template {
  id: string;
  name: string;
  config: TemplateConfig;
  created_at?: string;
}