import { useEffect, useState } from 'react';
import { BlobProvider } from '@react-pdf/renderer';
import { ChevronLeft, Printer, Download, Loader2, AlertTriangle } from 'lucide-react';
import { BingoCard, Template } from '../../types';
import { CardsDocument } from '../../lib/CardPdf';
import { qrDataUrl, buildQrPayload } from '../../lib/qr';

interface PrintViewProps {
  printViewCards: { cards: BingoCard[]; template: Template } | null;
  setPrintViewCards: (val: null) => void;
}

export default function PrintView({ printViewCards, setPrintViewCards }: PrintViewProps) {
  const [qrs, setQrs] = useState<(string | null)[] | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  // Генерим QR-коды локально, параллельно. Без сетевых вызовов — оффлайн ок.
  useEffect(() => {
    if (!printViewCards) return;
    let cancelled = false;
    setQrs(null);
    setQrError(null);
    const { cards, template } = printViewCards;
    (async () => {
      try {
        const arr = await Promise.all(cards.map(async (c) => {
          if (!template.config.qrSlot.enabled) return null;
          const payload = buildQrPayload(template.config.qrPayloadTemplate, c.id);
          return qrDataUrl(payload);
        }));
        if (!cancelled) setQrs(arr);
      } catch (e: any) {
        if (!cancelled) setQrError(e?.message ?? 'QR error');
      }
    })();
    return () => { cancelled = true; };
  }, [printViewCards]);

  if (!printViewCards) return null;
  const { cards, template } = printViewCards;

  return (
    <div className="fixed inset-0 bg-gray-900 text-black z-[500] flex flex-col font-sans overflow-hidden">
      {/* ШАПКА */}
      <div className="h-20 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0 shadow-xl relative z-10 text-white">
        <div className="flex items-center gap-6">
          <button onClick={() => setPrintViewCards(null)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={24} />
            <span className="font-bold">Назад</span>
          </button>
          <div className="flex flex-col">
            <span className="text-white font-bold text-lg leading-none">Печать карточек</span>
            <span className="text-gray-500 text-sm">{cards.length} шт. · {template.name}</span>
          </div>
        </div>

        {qrs && !qrError ? (
          <BlobProvider document={<CardsDocument cards={cards} template={template} qrPngDataUrls={qrs} />}>
            {({ url, blob, loading, error }) => (
              <div className="flex items-center gap-3">
                {error && (
                  <span className="text-red-400 text-sm flex items-center gap-2"><AlertTriangle size={16} />Ошибка PDF</span>
                )}
                <button
                  disabled={!url || loading}
                  onClick={() => {
                    if (!url) return;
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${sanitize(template.name)}_${cards.length}cards.pdf`;
                    a.click();
                  }}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition border border-gray-700">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  Скачать PDF
                </button>
                <button
                  disabled={!blob || loading}
                  onClick={() => { if (blob) printBlob(blob); }}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl font-black flex items-center gap-2 transition shadow-lg shadow-purple-500/20">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Printer size={20} />}
                  ПЕЧАТЬ
                </button>
              </div>
            )}
          </BlobProvider>
        ) : (
          <div className="text-gray-400 text-sm flex items-center gap-2">
            {qrError ? <><AlertTriangle size={16} className="text-red-400" /> {qrError}</> : <><Loader2 size={16} className="animate-spin" /> Генерация QR-кодов…</>}
          </div>
        )}
      </div>

      {/* ПРЕВЬЮ PDF */}
      <div className="flex-1 bg-gray-800/50 relative overflow-hidden">
        {!qrs ? (
          <CenterLoader text="Готовим карточки…" />
        ) : qrError ? (
          <CenterError text={qrError} />
        ) : (
          <BlobProvider document={<CardsDocument cards={cards} template={template} qrPngDataUrls={qrs} />}>
            {({ url, loading, error }) => {
              if (error)  return <CenterError text={String(error)} />;
              if (loading || !url) return <CenterLoader text="Собираем PDF…" />;
              return (
                <iframe
                  key={url}
                  title="cards-pdf"
                  src={url}
                  className="w-full h-full border-0 bg-gray-900"
                />
              );
            }}
          </BlobProvider>
        )}
      </div>
    </div>
  );
}

function CenterLoader({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
      <Loader2 size={36} className="animate-spin text-purple-400" />
      <span className="text-gray-300">{text}</span>
    </div>
  );
}

function CenterError({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-300 px-10 text-center">
      <AlertTriangle size={36} />
      <span className="font-bold">Не удалось собрать PDF</span>
      <span className="text-sm text-red-200/80">{text}</span>
    </div>
  );
}

// ─── Печать через невидимый iframe (надёжнее, чем window.open) ───
function printBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        // если печать упёрлась в политику браузера — открываем в новой вкладке
        window.open(url, '_blank');
      }
    }, 250);
  };
  document.body.appendChild(iframe);
  // подчищаем через минуту
  setTimeout(() => {
    URL.revokeObjectURL(url);
    iframe.remove();
  }, 60_000);
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Zа-яА-Я0-9\-_]+/g, '_').slice(0, 40) || 'cards';
}
