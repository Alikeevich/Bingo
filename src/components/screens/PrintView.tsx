import { ChevronLeft, Printer } from 'lucide-react';
import { BingoCard, Template, Track } from '../../types';
import { chunkArray } from '../../utils';

interface PrintViewProps {
  printViewCards: { cards: BingoCard[]; template: Template } | null;
  setPrintViewCards: (val: null) => void;
}

// ================================================================
//  ЗОНЫ КАРТОЧКИ — захардкожены по дизайн-гайду
//  Источник: SVG 2480 × 3508 px (A4 @ 300 dpi = 210 × 297 мм)
//  Формула: px / total_px * mm_сторона
//
//  Лист A4: padding листа 10 мм → зона карточек:
//    Layout 1 → 190 × 277 мм  → контент (−2.7 мм) → 184.6 × 271.6 мм
//    Layout 2 → 190 × 133.5 мм → контент           → 184.6 × 128.1 мм
//    Layout 4 →  90 × 133.5 мм → контент           →  84.6 × 128.1 мм
// ================================================================
const ZONES = {

  // Внутренний отступ карточки:
  //   Гайд safe margin = 150 px / 2480 px * 210 мм = 12.7 мм от края листа
  //   Лист уже даёт 10 мм → остаток внутри карточки = 2.7 мм
  PAD: 2.7,

  // ── Layout 1 ─────────────────────────────────────────────────
  1: {
    headerH:  21.2,   // 250 px / 3508 * 297
    headerGap: 4.2,   //  50 px / 3508 * 297
    gridH:   211.7,   // 2500 px / 3508 * 297
    footerH:  34.5,   // остаток: 271.6 − 21.2 − 4.2 − 211.7
    qrSize:   29.6,   // 350 px / 2480 * 210  (и по H: 350/3508*297 ≈ 29.6 — квадрат ✓)
    idH:      20.3,   // 240 px / 3508 * 297
    idW:      25.4,   // 300 px / 2480 * 210
    cellGap:   1.5,
    titleFz:  13.0,
    trackFz:   3.5,
    artistFz:  2.7,
    centerFz:  5.0,
    idFz:      2.8,
    idSubFz:   2.0,
    qrPhFz:    2.5,
  },

  // ── Layout 2 (H scale = 128.1 / 271.6 = 0.4717) ─────────────
  2: {
    headerH:  10.0,   // 21.2 × 0.4717
    headerGap: 2.0,   //  4.2 × 0.4717
    gridH:    99.8,   // 211.7 × 0.4717
    footerH:  16.3,   // остаток: 128.1 − 10 − 2 − 99.8
    qrSize:   14.0,   // 29.6 × 0.4717
    idH:       9.6,   // 20.3 × 0.4717
    idW:      25.4,   // ширина карточки та же → не масштабируем
    cellGap:   0.8,
    titleFz:   6.1,
    trackFz:   1.65,
    artistFz:  1.27,
    centerFz:  2.36,
    idFz:      1.4,
    idSubFz:   1.0,
    qrPhFz:    1.2,
  },

  // ── Layout 4 (H scale = 0.4717, W scale = 84.6/184.6 = 0.4583) ──
  4: {
    headerH:  10.0,
    headerGap: 2.0,
    gridH:    99.8,
    footerH:  16.3,
    qrSize:   12.0,   // немного меньше — карточка уже по ширине
    idH:       9.6,
    idW:      11.6,   // 25.4 × 0.4583
    cellGap:   0.5,
    titleFz:   5.0,
    trackFz:   1.3,
    artistFz:  1.0,
    centerFz:  1.8,
    idFz:      1.1,
    idSubFz:   0.8,
    qrPhFz:    1.0,
  },
} as const;

// Хелпер: число → CSS-строка в мм
const mm = (v: number) => `${v}mm`;

export default function PrintView({ printViewCards, setPrintViewCards }: PrintViewProps) {
  if (!printViewCards) return null;

  const { cards, template } = printViewCards;
  const layoutNum = parseInt(template.config.layout || '1') as 1 | 2 | 4;
  const pages = chunkArray(cards, layoutNum);
  const g = ZONES[layoutNum];
  const p = ZONES.PAD;

  // Стиль страницы A4 — зависит от раскладки
  const pageStyle: React.CSSProperties = {
    width: '210mm',
    height: '297mm',
    backgroundColor: 'white',
    overflow: 'hidden',
    padding: '10mm',
    gap: '10mm',
    boxSizing: 'border-box',
    ...(layoutNum === 1
      ? { display: 'flex', flexDirection: 'column' }
      : layoutNum === 2
      ? { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' }
      : { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }),
  };

  return (
    <div className="bg-gray-200 min-h-screen text-black print:bg-white overflow-y-auto z-[200] relative font-sans print:m-0 print:p-0">

      {/* ── Панель управления (скрыта при печати) ───────────────── */}
      <div className="fixed top-0 left-0 right-0 bg-gray-900 text-white p-4 flex justify-between items-center z-50 print:hidden shadow-lg border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPrintViewCards(null)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition font-medium"
          >
            <ChevronLeft size={20} /> Назад
          </button>
          <div>
            <div className="font-bold">Генерация карточек</div>
            <div className="text-sm text-gray-400">
              Сгенерировано {cards.length} шт. · Шаблон: {template.name}
            </div>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition"
        >
          <Printer size={20} /> Распечатать (A4)
        </button>
      </div>

      {/* ── Страницы ─────────────────────────────────────────────── */}
      <div className="pt-24 print:pt-0 pb-20 print:pb-0 flex flex-col items-center gap-8 print:block">
        {pages.map((pageCards: BingoCard[], pageIndex: number) => (
          <div
            key={pageIndex}
            style={pageStyle}
            className="shadow-2xl print:shadow-none print:page-break-after-always"
          >
            {pageCards.map((card) => (
              <div
                key={card.id}
                style={{
                  // Layout 1: карточка растягивается на всю высоту flex-контейнера
                  flex: layoutNum === 1 ? '1 1 auto' : undefined,
                  // Внутренняя компоновка — строго колонка, никаких авто-размеров
                  display: 'flex',
                  flexDirection: 'column',
                  // Отступ точно по гайду: 12.7 мм total − 10 мм листа = 2.7 мм
                  padding: mm(p),
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  // Визуальное оформление
                  backgroundColor: template.config.bgColor,
                  color: template.config.textColor,
                  backgroundImage: template.config.backgroundImageUrl
                    ? `url(${template.config.backgroundImageUrl})`
                    : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  fontFamily: template.config.fontFamily || '"Inter", sans-serif',
                  borderRadius: '3mm',
                  border: '0.4mm dashed #9ca3af',
                }}
              >

                {/* ══════════════════════════════════════════════════
                    ЗОНА 1 — ЗАГОЛОВОК
                    Layout 1: 21.2 мм  (250 px / 3508 px * 297 мм)
                    Layout 2/4: 10.0 мм (масштаб × 0.4717)
                    ══════════════════════════════════════════════════ */}
                <div
                  style={{
                    height:    mm(g.headerH),
                    minHeight: mm(g.headerH),
                    maxHeight: mm(g.headerH),
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: `0.7mm solid ${template.config.accentColor}55`,
                    color: template.config.accentColor,
                    fontSize: mm(g.titleFz),
                    fontWeight: 900,
                    fontStyle: 'italic',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.03em',
                    overflow: 'hidden',
                  }}
                >
                  {template.config.cardTitle}
                </div>

                {/* ══════════════════════════════════════════════════
                    ЗОНА 2 — GAP между заголовком и сеткой
                    Layout 1: 4.2 мм  (50 px / 3508 px * 297 мм)
                    Layout 2/4: 2.0 мм
                    ══════════════════════════════════════════════════ */}
                <div style={{ height: mm(g.headerGap), flexShrink: 0 }} />

                {/* ══════════════════════════════════════════════════
                    ЗОНА 3 — СЕТКА 5 × 5
                    Layout 1: 211.7 мм  (2500 px / 3508 px * 297 мм)
                    Layout 2/4:  99.8 мм
                    ══════════════════════════════════════════════════ */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gridTemplateRows: 'repeat(5, 1fr)',
                    gap: mm(g.cellGap),
                    height:    mm(g.gridH),
                    minHeight: mm(g.gridH),
                    maxHeight: mm(g.gridH),
                    flexShrink: 0,
                  }}
                >
                  {card.cells.map((cell, i) => {
                    const isFree = 'isFreeSpace' in cell;
                    return (
                      <div
                        key={i}
                        style={{
                          backgroundColor: template.config.gridColor,
                          borderRadius: '0.8mm',
                          border: '0.2mm solid rgba(255,255,255,0.1)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          padding: '0.5mm',
                          overflow: 'hidden',
                        }}
                      >
                        {isFree ? (
                          <div
                            style={{
                              color: template.config.accentColor,
                              fontSize: mm(g.centerFz),
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              lineHeight: 1.1,
                            }}
                          >
                            {template.config.centerText}
                          </div>
                        ) : (
                          <>
                            <div
                              style={{
                                fontSize: mm(g.trackFz),
                                fontWeight: 700,
                                lineHeight: 1.2,
                                opacity: 0.9,
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                wordBreak: 'break-word',
                                width: '100%',
                                padding: '0 0.3mm',
                              } as React.CSSProperties}
                            >
                              {(cell as Track).title}
                            </div>
                            {template.config.showArtist && (
                              <div
                                style={{
                                  color: template.config.accentColor,
                                  fontSize: mm(g.artistFz),
                                  fontWeight: 500,
                                  fontStyle: 'italic',
                                  lineHeight: 1.2,
                                  opacity: 0.9,
                                  marginTop: '0.3mm',
                                  overflow: 'hidden',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  wordBreak: 'break-word',
                                  width: '100%',
                                  padding: '0 0.3mm',
                                } as React.CSSProperties}
                              >
                                {(cell as Track).artist}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ══════════════════════════════════════════════════
                    ЗОНА 4 — ПОДВАЛ
                    Layout 1: 34.5 мм  (остаток: 271.6 − 237.1)
                    Layout 2/4: 16.3 мм
                    items-end: QR и ID прижаты к нижнему краю,
                    что соответствует выравниванию в гайде:
                      QR bottom = content bottom (y=3350)
                      ID bottom = content bottom (y=3350)
                    ══════════════════════════════════════════════════ */}
                <div
                  style={{
                    height:    mm(g.footerH),
                    minHeight: mm(g.footerH),
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                  }}
                >
                  {/* ID-блок
                      Layout 1: 25.4 × 20.3 мм  (300 px × 240 px из гайда)
                      Layout 4: 11.6 × 9.6 мм   (масштаб по ширине + высоте) */}
                  <div
                    style={{
                      width:     mm(g.idW),
                      height:    mm(g.idH),
                      minWidth:  mm(g.idW),
                      flexShrink: 0,
                      backgroundColor: 'rgba(255,255,255,0.5)',
                      borderRadius: '1mm',
                      padding: '0.5mm 1mm',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        fontSize: mm(g.idFz),
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        opacity: 0.8,
                        lineHeight: 1.2,
                        color: template.config.textColor,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                      }}
                    >
                      ID: #{card.id}
                    </div>
                    <div
                      style={{
                        fontSize: mm(g.idSubFz),
                        fontWeight: 500,
                        opacity: 0.7,
                        lineHeight: 1.2,
                        color: template.config.textColor,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                      }}
                    >
                      {template.config.footerText}
                    </div>
                  </div>

                  {/* QR-блок
                      Layout 1: 29.6 × 29.6 мм  (350 px из гайда — квадрат)
                      Layout 2:  14.0 × 14.0 мм
                      Layout 4:  12.0 × 12.0 мм */}
                  {template.config.showQR && (
                    <div
                      style={{
                        width:     mm(g.qrSize),
                        height:    mm(g.qrSize),
                        minWidth:  mm(g.qrSize),
                        flexShrink: 0,
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        border: '0.2mm solid rgba(255,255,255,0.2)',
                        borderRadius: '2mm',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1mm',
                        boxSizing: 'border-box',
                      }}
                    >
                      {template.config.qrUrl ? (
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                            template.config.qrUrl
                          )}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            mixBlendMode: 'multiply',
                          }}
                          alt="QR"
                        />
                      ) : (
                        <div
                          style={{
                            fontSize: mm(g.qrPhFz),
                            fontWeight: 700,
                            opacity: 0.5,
                            textAlign: 'center',
                            lineHeight: 1.2,
                            color: '#000',
                          }}
                        >
                          МЕСТО ДЛЯ
                          <br />
                          QR КОДА
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}