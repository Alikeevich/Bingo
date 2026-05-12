import { Document, Page, View, Text, Image, Font, StyleSheet } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { BingoCard, Template, Track, TextStyle, SlotRect, GridSlot } from '../types';

// ────────────────────────────────────────────────────────────────────────
// РЕГИСТРАЦИЯ ШРИФТОВ (один раз, при импорте модуля)
// TTF лежат в public/fonts → доступны по абсолютному пути от origin.
// Кириллица поддерживается, нет сетевой зависимости от CDN.
// ────────────────────────────────────────────────────────────────────────

const FONTS_REGISTERED_KEY = '__muzbingo_pdf_fonts_registered__';
declare global {
  interface Window { [FONTS_REGISTERED_KEY]?: boolean }
}

function origin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

if (typeof window !== 'undefined' && !window[FONTS_REGISTERED_KEY]) {
  const o = origin();
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: `${o}/fonts/Roboto-Regular.ttf` },
      { src: `${o}/fonts/Roboto-Bold.ttf`,        fontWeight: 'bold' },
      { src: `${o}/fonts/Roboto-Italic.ttf`,      fontStyle: 'italic' },
      { src: `${o}/fonts/Roboto-BoldItalic.ttf`,  fontWeight: 'bold', fontStyle: 'italic' },
    ],
  });
  Font.register({
    family: 'RobotoMono',
    fonts: [
      { src: `${o}/fonts/RobotoMono-Regular.ttf` },
      { src: `${o}/fonts/RobotoMono-Bold.ttf`, fontWeight: 'bold' },
    ],
  });
  // Отключаем хитрый перенос — нам нужны простые предсказуемые переносы по словам
  Font.registerHyphenationCallback(word => [word]);
  window[FONTS_REGISTERED_KEY] = true;
}

export const ALLOWED_FONTS = ['Roboto', 'RobotoMono'] as const;
export type AllowedFont = typeof ALLOWED_FONTS[number];

// ────────────────────────────────────────────────────────────────────────
// ХЕЛПЕРЫ
// ────────────────────────────────────────────────────────────────────────

const mm = (v: number) => `${v}mm`;

function textStyleToReact(s: TextStyle): Style {
  return {
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    color: s.color,
    fontWeight: s.bold ? 'bold' : 'normal',
    fontStyle: s.italic ? 'italic' : 'normal',
    textAlign: s.align ?? 'center',
    lineHeight: 1.15,
  };
}

const styles = StyleSheet.create({
  page: { position: 'relative', backgroundColor: 'white' },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  slot:    { position: 'absolute', overflow: 'hidden' },
  gridCell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridRow: { display: 'flex', flexDirection: 'row', flex: 1 },
  qrInner: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'white',
  },
});

function rectStyle(r: SlotRect) {
  return { left: mm(r.x), top: mm(r.y), width: mm(r.width), height: mm(r.height) };
}

// ────────────────────────────────────────────────────────────────────────
// СЕТКА (5×5)
// ────────────────────────────────────────────────────────────────────────

function GridSlotView({ grid, cells, template }: {
  grid: GridSlot;
  cells: BingoCard['cells'];
  template: Template;
}) {
  const { cols, rows, cellGap, cellPad } = grid;
  const { trackTitle, trackArtist, freeSpace } = template.config;
  const cellTitleStyle  = textStyleToReact(trackTitle);
  const cellArtistStyle = textStyleToReact(trackArtist);
  const freeStyle       = textStyleToReact(freeSpace);

  const rowsArr: BingoCard['cells'][] = [];
  for (let r = 0; r < rows; r++) rowsArr.push(cells.slice(r * cols, (r + 1) * cols));

  return (
    <View style={[styles.slot, rectStyle(grid)]}>
      <View style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {rowsArr.map((row, ri) => (
          <View
            key={ri}
            style={[
              styles.gridRow,
              ri > 0 ? { marginTop: mm(cellGap) } : {},
            ]}
          >
            {row.map((cell, ci) => {
              const isFree = cell && 'isFreeSpace' in cell;
              return (
                <View
                  key={ci}
                  style={[
                    styles.gridCell,
                    { padding: mm(cellPad) },
                    ci > 0 ? { marginLeft: mm(cellGap) } : {},
                  ]}
                >
                  {isFree ? (
                    <Text style={freeStyle}>{freeSpace.content}</Text>
                  ) : (
                    <>
                      <Text style={cellTitleStyle}>
                        {clamp((cell as Track).title, trackTitle.lineClamp)}
                      </Text>
                      {trackArtist.enabled && (
                        <Text style={[cellArtistStyle, { marginTop: mm(0.4) }]}>
                          {clamp((cell as Track).artist, trackArtist.lineClamp)}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// Грубо обрезает длинные строки до lineClamp*~20 символов чтобы PDF не растекался
function clamp(text: string, lineClamp?: number): string {
  if (!lineClamp || lineClamp <= 0) return text;
  const maxChars = lineClamp * 22;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
}

// ────────────────────────────────────────────────────────────────────────
// ОДНА СТРАНИЦА = ОДНА КАРТОЧКА
// ────────────────────────────────────────────────────────────────────────

interface CardPageProps {
  card: BingoCard;
  template: Template;
  qrPngDataUrl: string | null;  // null = QR не нужен
}

function CardPage({ card, template, qrPngDataUrl }: CardPageProps) {
  const { backgroundImageUrl, orientation, grid, idSlot, qrSlot, idText, idSubText } = template.config;

  return (
    <Page size="A4" orientation={orientation} style={styles.page}>
      {/* ФОН — дизайнерская картинка во всю страницу */}
      {backgroundImageUrl && (
        // src — строка-URL; react-pdf сам скачает
        <Image src={backgroundImageUrl} style={styles.bgImage} />
      )}

      {/* СЕТКА */}
      <GridSlotView grid={grid} cells={card.cells} template={template} />

      {/* ID-БЛОК */}
      <View style={[styles.slot, rectStyle(idSlot), {
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }]}>
        <Text style={textStyleToReact(idText)}>
          {idText.prefix}{card.id.slice(0, 8)}
        </Text>
        {idSubText.enabled && (
          <Text style={[textStyleToReact(idSubText), { marginTop: mm(0.5) }]}>
            {idSubText.content}
          </Text>
        )}
      </View>

      {/* QR */}
      {qrSlot.enabled && qrPngDataUrl && (
        <View style={[styles.slot, rectStyle(qrSlot), {
          padding: mm(qrSlot.margin),
          backgroundColor: 'white',
        }]}>
          <View style={styles.qrInner}>
            <Image src={qrPngDataUrl} style={{ width: '100%', height: '100%' }} />
          </View>
        </View>
      )}
    </Page>
  );
}

// ────────────────────────────────────────────────────────────────────────
// ДОКУМЕНТ — N СТРАНИЦ ДЛЯ N КАРТОЧЕК
// ────────────────────────────────────────────────────────────────────────

export interface CardsDocumentProps {
  cards: BingoCard[];
  template: Template;
  qrPngDataUrls: (string | null)[];   // длина = cards.length
}

export function CardsDocument({ cards, template, qrPngDataUrls }: CardsDocumentProps) {
  return (
    <Document title={template.name}>
      {cards.map((card, i) => (
        <CardPage key={card.id} card={card} template={template} qrPngDataUrl={qrPngDataUrls[i] ?? null} />
      ))}
    </Document>
  );
}
