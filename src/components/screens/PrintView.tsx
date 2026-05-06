import { useState } from 'react';
import { ChevronLeft, Printer, ZoomIn, ZoomOut } from 'lucide-react';
import { BingoCard, Template, Track } from '../../types';
import { chunkArray } from '../../utils';

interface PrintViewProps {
  printViewCards: { cards: BingoCard[]; template: Template } | null;
  setPrintViewCards: (val: null) => void;
}

const ZONES = {
  PAD: 2.7,
  1: {
    headerH:  21.2, headerGap: 4.2, gridH: 211.7, footerH: 34.5, qrSize: 29.6, idH: 20.3, idW: 25.4, cellGap: 1.5,
    titleFz:  13.0, trackFz: 3.5, artistFz: 2.7, centerFz: 5.0, idFz: 2.8, idSubFz: 2.0, qrPhFz: 2.5,
  },
  2: {
    headerH:  14.4, headerGap: 2.8, gridH: 143.9, footerH: 23.5, qrSize: 20.1, idH: 13.8, idW: 17.2, cellGap: 1.0,
    titleFz:   8.8, trackFz: 2.4, artistFz: 1.8, centerFz: 3.4, idFz: 1.9, idSubFz: 1.4, qrPhFz: 1.7,
  },
  4: {
    headerH:  10.0, headerGap: 2.0, gridH:  99.8, footerH: 16.3, qrSize: 14.0, idH:  9.6, idW: 12.0, cellGap: 0.7,
    titleFz:   6.1, trackFz: 1.6, artistFz: 1.2, centerFz: 2.3, idFz: 1.3, idSubFz: 0.9, qrPhFz: 1.2,
  },
} as const;

const mm = (v: number) => `${v}mm`;

export default function PrintView({ printViewCards, setPrintViewCards }: PrintViewProps) {
  // Добавляем состояние для масштаба предпросмотра на мониторе
  const [scale, setScale] = useState(0.6); 

  if (!printViewCards) return null;

  const { cards, template } = printViewCards;
  const layoutNum = parseInt(template.config.layout || '1') as 1 | 2 | 4;
  const pages = chunkArray(cards, layoutNum);
  
  const g = ZONES[layoutNum];
  const p = ZONES.PAD;
  const isLandscape = layoutNum === 2;

  const pageStyle: React.CSSProperties = {
    width: isLandscape ? '297mm' : '210mm',
    height: isLandscape ? '210mm' : '297mm',
    backgroundColor: 'white',
    overflow: 'hidden',
    padding: '10mm',
    gap: '10mm',
    boxSizing: 'border-box',
    display: 'grid',
    flexShrink: 0,
    ...(layoutNum === 1
      ? { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
      : layoutNum === 2
      ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' }
      : { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }),
  };

  return (
    <div className="bg-gray-800 min-h-screen text-black print:bg-white overflow-y-auto z-[200] relative font-sans print:m-0 print:p-0">
      
      <style type="text/css">
        {`
          @media print {
            @page {
              size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
              margin: 0;
            }
            body { margin: 0; background: white; }
            .no-print { display: none !important; }
          }
        `}
      </style>

      {/* Панель управления (no-print) */}
      <div className="fixed top-0 left-0 right-0 bg-gray-900 text-white p-4 flex justify-between items-center z-50 print:hidden shadow-2xl border-b border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPrintViewCards(null)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition font-medium"
          >
            <ChevronLeft size={20} /> Назад
          </button>
          <div className="h-8 w-[1px] bg-gray-700 mx-2" />
          <div>
            <div className="font-bold text-lg leading-tight">{cards.length} карточек</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">{template.name}</div>
          </div>
        </div>

        {/* Слайдер масштаба для монитора */}
        <div className="flex items-center gap-4 bg-black/30 px-4 py-2 rounded-xl border border-white/10">
          <ZoomOut size={18} className="text-gray-400" />
          <input 
            type="range" min="0.3" max="1.2" step="0.05" 
            value={scale} 
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-32 accent-purple-500"
          />
          <ZoomIn size={18} className="text-gray-400" />
          <span className="text-sm font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
        </div>

        <button
          onClick={() => window.print()}
          className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition transform active:scale-95 shadow-lg shadow-purple-500/20"
        >
          <Printer size={22} /> Печать
        </button>
      </div>

      {/* Контейнер страниц */}
      <div 
        className="pt-32 pb-20 flex flex-col items-center gap-12 print:p-0 print:block print:bg-white"
        style={{ 
          // Масштабируем всё содержимое только для экрана
          transform: `scale(${scale})`, 
          transformOrigin: 'top center',
          // Компенсируем высоту, так как scale не меняет физический размер контейнера в DOM
          marginBottom: `-${(1 - scale) * 100}%` 
        }}
      >
        {pages.map((pageCards: BingoCard[], pageIndex: number) => (
          <div
            key={pageIndex}
            style={pageStyle}
            className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] print:shadow-none print:page-break-after-always print:transform-none"
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
                  height: '100%',
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