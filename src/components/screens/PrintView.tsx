import { ChevronLeft, Printer } from 'lucide-react';
import { BingoCard, Template, Track } from '../../types';
import { chunkArray } from '../../utils';

interface PrintViewProps {
  printViewCards: { cards: BingoCard[]; template: Template } | null;
  setPrintViewCards: (val: null) => void;
}

// ================================================================
//  ЗОНЫ КАРТОЧКИ — Выверены математически по дизайн-гайду
//  Формула: px / total_px * mm_сторона
// ================================================================
const ZONES = {
  // Внутренний отступ карточки (от края рамки до контента)
  PAD: 2.7,

  // ── Layout 1 (1 на А4) — A4 Portrait (210×297) ───────────────
  1: {
    headerH:  21.2,   // 250 px
    headerGap: 4.2,   // 50 px
    gridH:   211.7,   // 2500 px
    footerH:  34.5,   // остаток
    qrSize:   29.6,   // 350 px
    idH:      20.3,   // 240 px
    idW:      25.4,   // 300 px
    cellGap:   1.5,
    titleFz:  13.0,
    trackFz:   3.5,
    artistFz:  2.7,
    centerFz:  5.0,
    idFz:      2.8,
    idSubFz:   2.0,
    qrPhFz:    2.5,
  },

  // ── Layout 2 (2 на А4) — A4 Landscape (297×210) ───────────────
  // Лист перевернут. Карточки стоят рядом. Масштаб ≈ 0.68 от оригинала
  2: {
    headerH:  14.4,
    headerGap: 2.8,
    gridH:   143.9,
    footerH:  23.5,
    qrSize:   20.1,
    idH:      13.8,
    idW:      17.2,
    cellGap:   1.0,
    titleFz:   8.8,
    trackFz:   2.4,
    artistFz:  1.8,
    centerFz:  3.4,
    idFz:      1.9,
    idSubFz:   1.4,
    qrPhFz:    1.7,
  },

  // ── Layout 4 (4 на А4) — A4 Portrait (210×297) ────────────────
  // Сетка 2x2. Масштаб ≈ 0.47
  4: {
    headerH:  10.0,
    headerGap: 2.0,
    gridH:    99.8,
    footerH:  16.3,
    qrSize:   14.0,
    idH:       9.6,
    idW:      12.0,
    cellGap:   0.7,
    titleFz:   6.1,
    trackFz:   1.6,
    artistFz:  1.2,
    centerFz:  2.3,
    idFz:      1.3,
    idSubFz:   0.9,
    qrPhFz:    1.2,
  },
} as const;

const mm = (v: number) => `${v}mm`;

export default function PrintView({ printViewCards, setPrintViewCards }: PrintViewProps) {
  if (!printViewCards) return null;

  const { cards, template } = printViewCards;
  const layoutNum = parseInt(template.config.layout || '1') as 1 | 2 | 4;
  const pages = chunkArray(cards, layoutNum);
  
  const g = ZONES[layoutNum];
  const p = ZONES.PAD;
  const isLandscape = layoutNum === 2;

  // Настройка стилей страницы А4
  const pageStyle: React.CSSProperties = {
    width: isLandscape ? '297mm' : '210mm',
    height: isLandscape ? '210mm' : '297mm',
    backgroundColor: 'white',
    overflow: 'hidden',
    padding: '10mm',
    gap: '10mm',
    boxSizing: 'border-box',
    display: 'grid',
    ...(layoutNum === 1
      ? { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
      : layoutNum === 2
      ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' }
      : { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }),
  };

  return (
    <div className="bg-gray-200 min-h-screen text-black print:bg-white overflow-y-auto z-[200] relative font-sans print:m-0 print:p-0">
      
      {/* CSS-инъекция для управления принтером */}
      <style type="text/css">
        {`
          @media print {
            @page {
              size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
              margin: 0;
            }
            body { margin: 0; }
          }
        `}
      </style>

      {/* Панель управления */}
      <div className="fixed top-0 left-0 right-0 bg-gray-900 text-white p-4 flex justify-between items-center z-50 print:hidden shadow-lg border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPrintViewCards(null)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition font-medium"
          >
            <ChevronLeft size={20} /> Назад
          </button>
          <div>
            <div className="font-bold">Печать: {cards.length} шт.</div>
            <div className="text-sm text-gray-400">
              Шаблон: {template.name} · Ориентация: {isLandscape ? 'Альбомная' : 'Книжная'}
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

      {/* Страницы */}
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
                  display: 'flex',
                  flexDirection: 'column',
                  padding: mm(p),
                  boxSizing: 'border-box',
                  overflow: 'hidden',
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
                  height: '100%', // Чтобы в сетке занимала всё место
                }}
              >
                {/* ЗОНА 1 — ЗАГОЛОВОК */}
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

                {/* ЗОНА 2 — GAP */}
                <div style={{ height: mm(g.headerGap), flexShrink: 0 }} />

                {/* ЗОНА 3 — СЕТКА */}
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

                {/* ЗОНА 4 — ПОДВАЛ */}
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
                          МЕСТО ДЛЯ<br />QR КОДА
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