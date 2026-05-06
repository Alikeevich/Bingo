import { ChevronLeft, Printer } from 'lucide-react';
import { BingoCard, Template, Track } from '../../types';
import { chunkArray } from '../../utils';

interface PrintViewProps {
  printViewCards: { cards: BingoCard[]; template: Template } | null;
  setPrintViewCards: (val: null) => void;
}

export default function PrintView({ printViewCards, setPrintViewCards }: PrintViewProps) {
  if (!printViewCards) return null;
  const { cards, template } = printViewCards;
  const layoutNum = parseInt(template.config.layout || '1');
  const pages = chunkArray(cards, layoutNum);

  return (
    <div className="bg-gray-200 min-h-screen text-black print:bg-white overflow-y-auto z-[200] relative font-sans print:m-0 print:p-0">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 text-white p-4 flex justify-between items-center z-50 print:hidden shadow-lg border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button onClick={() => setPrintViewCards(null)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition font-medium"><ChevronLeft size={20} /> Назад</button>
          <div><div className="font-bold">Генерация карточек</div><div className="text-sm text-gray-400">Сгенерировано {cards.length} шт. Шаблон: {template.name}</div></div>
        </div>
        <button onClick={() => window.print()} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition"><Printer size={20} /> Распечатать (A4)</button>
      </div>
      <div className="pt-24 print:pt-0 pb-20 print:pb-0 flex flex-col items-center gap-8 print:block">
        {pages.map((pageCards: BingoCard[], pageIndex: number) => (
          <div key={pageIndex} className="w-[210mm] h-[297mm] bg-white shadow-2xl print:shadow-none print:w-full print:h-screen print:page-break-after-always overflow-hidden">
            <div className={`w-full h-full p-[10mm] gap-[10mm] ${layoutNum === 1 ? 'flex flex-col' : layoutNum === 2 ? 'grid grid-cols-1 grid-rows-2' : 'grid grid-cols-2 grid-rows-2'}`}>
              {pageCards.map((card) => (
                <div key={card.id} style={{ backgroundColor: template.config.bgColor, color: template.config.textColor, backgroundImage: template.config.backgroundImageUrl ? `url(${template.config.backgroundImageUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', fontFamily: template.config.fontFamily || '"Inter", sans-serif' }} className="relative flex flex-col rounded-xl overflow-hidden p-6 print:p-4 border-2 border-dashed border-gray-300">
                  <div style={{ color: template.config.accentColor, borderColor: `${template.config.accentColor}44` }} className={`text-center font-black border-b-4 uppercase italic tracking-tighter ${layoutNum === 4 ? 'text-2xl mb-2 pb-2 border-b-2' : 'text-5xl mb-6 pb-4'}`}>{template.config.cardTitle}</div>
                  <div className="grid grid-cols-5 gap-1.5 print:gap-1 flex-1">
                    {card.cells.map((cell, i) => {
                      const isFree = 'isFreeSpace' in cell;
                      return (
                        <div key={i} style={{ backgroundColor: template.config.gridColor }} className="rounded-lg border border-white/10 flex flex-col items-center justify-center text-center p-1.5 print:p-1 overflow-hidden">
                          {isFree
                            ? <div style={{ color: template.config.accentColor }} className={`font-black uppercase leading-tight ${layoutNum === 4 ? 'text-xs' : 'text-xl'}`}>{template.config.centerText}</div>
                            : <><div className={`font-bold leading-tight opacity-90 line-clamp-3 break-words w-full px-0.5 ${layoutNum === 4 ? 'text-[8px]' : 'text-[13px]'}`}>{(cell as Track).title}</div>{template.config.showArtist && <div style={{ color: template.config.accentColor }} className={`font-medium leading-tight opacity-90 italic mt-0.5 line-clamp-2 break-words w-full px-0.5 ${layoutNum === 4 ? 'text-[6px]' : 'text-[11px]'}`}>{(cell as Track).artist}</div>}</>}
                        </div>
                      );
                    })}
                  </div>
                  <div className={`mt-4 flex justify-between items-end ${layoutNum === 4 ? 'mt-2' : ''}`}>
                    <div className="flex flex-col bg-white/50 p-1 rounded-md"><div className={`opacity-80 uppercase font-bold tracking-widest ${layoutNum === 4 ? 'text-[8px]' : 'text-sm'}`}>ID: #{card.id}</div><div className={`opacity-70 font-medium ${layoutNum === 4 ? 'text-[6px]' : 'text-xs'}`}>{template.config.footerText}</div></div>
                    {template.config.showQR && (
                      <div className={`bg-white/90 border border-white/20 flex items-center justify-center p-1 ${layoutNum === 4 ? 'w-10 h-10 rounded-md' : 'w-16 h-16 rounded-xl'}`}>
                        {template.config.qrUrl ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(template.config.qrUrl)}`} className="w-full h-full object-contain mix-blend-multiply" alt="QR" /> : <div className={`font-bold opacity-50 text-center leading-none text-black ${layoutNum === 4 ? 'text-[5px]' : 'text-[8px]'}`}>МЕСТО ДЛЯ<br />QR КОДА</div>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}