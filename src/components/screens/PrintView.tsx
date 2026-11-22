import '../../lib/pdfPolyfill'; // Buffer для @react-pdf — до самой библиотеки
import { useEffect, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { ChevronLeft, Printer, Download, Loader2, AlertTriangle } from 'lucide-react';
import { BingoCard, Template } from '../../types';
import { CardsDocument, refreshPdfFonts } from '../../lib/CardPdf';
import { qrDataUrl, buildQrPayload } from '../../lib/qr';

interface PrintViewProps {
  printViewCards: { cards: BingoCard[]; template: Template } | null;
  setPrintViewCards: (val: null) => void;
}

export default function PrintView({ printViewCards, setPrintViewCards }: PrintViewProps) {
  const [qrs, setQrs] = useState<(string | null)[] | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  // Фон шаблона — картинка ~1.5 МБ. Если начать рендер до её загрузки,
  // @react-pdf МОЛЧА пропускает изображение и печатается пустой лист без макета.
  // Поэтому ждём картинку и честно сообщаем, если не удалось.
  const [bgReady, setBgReady] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  // Готовый PDF: один на всё — превью, «Скачать» и «Печать»
  const [doc, setDoc] = useState<{ url: string; blob: Blob } | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [stage, setStage] = useState<'fonts' | 'pdf'>('fonts');

  const bgUrl = printViewCards?.template.config.backgroundImageUrl || '';
  useEffect(() => {
    let cancelled = false;
    setBgReady(false);
    setBgError(null);
    if (!bgUrl) { setBgReady(true); return; }   // шаблон без фона — печатаем на белом
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (!cancelled) setBgReady(true); };
    img.onerror = () => {
      if (!cancelled) setBgError('Не удалось загрузить фон шаблона. Проверь интернет и попробуй снова — без фона карточки печатать нельзя.');
    };
    img.src = bgUrl;
    return () => { cancelled = true; };
  }, [bgUrl]);

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

  // ─── СБОРКА PDF ────────────────────────────────────────────────────────
  // Один рендер на весь экран. Раньше здесь стояли ДВА <BlobProvider> с одним и
  // тем же документом (для кнопок и для превью) — они собирали PDF ПАРАЛЛЕЛЬНО,
  // вдвое дольше и вдвое больше памяти, но главное: оба рендера работают с одним
  // общим кешем глифов шрифта, и пока один дописывал файл (и портил кеш), второй
  // ещё считал раскладку — отсюда буквы, пропадавшие на части карточек.
  useEffect(() => {
    if (!printViewCards || !qrs || !bgReady) return;
    const { cards, template } = printViewCards;
    let cancelled = false;
    let url: string | null = null;
    setDoc(null);
    setDocError(null);
    setStage('fonts');
    (async () => {
      try {
        await refreshPdfFonts();          // чистые шрифты на каждую печать
        if (cancelled) return;
        setStage('pdf');
        const blob = await pdf(
          <CardsDocument cards={cards} template={template} qrPngDataUrls={qrs} />
        ).toBlob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setDoc({ url, blob });
      } catch (e: unknown) {
        if (!cancelled) setDocError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [printViewCards, qrs, bgReady]);

  if (!printViewCards) return null;
  const { cards, template } = printViewCards;

  return (
    <div className="fixed inset-0 bg-pult-card text-black z-[500] flex flex-col font-sans overflow-hidden">
      {/* ШАПКА */}
      <div className="h-20 bg-pult-card border-b border-white/[0.08] flex items-center justify-between px-6 shrink-0 relative z-10 text-white">
        <div className="flex items-center gap-6">
          <button onClick={() => setPrintViewCards(null)}
            className="flex items-center gap-2 text-pult-text2 hover:text-white transition-colors">
            <ChevronLeft size={24} />
            <span className="font-medium">Назад</span>
          </button>
          <div className="flex flex-col">
            <span className="text-white font-medium text-lg leading-none">Печать карточек</span>
            <span className="text-pult-muted text-sm">{cards.length} шт. · {template.name}</span>
          </div>
        </div>

        {qrError || bgError || docError ? (
          <div className="text-pult-text2 text-sm flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" /> {qrError || bgError || docError}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              disabled={!doc}
              onClick={() => {
                if (!doc) return;
                const a = document.createElement('a');
                a.href = doc.url;
                a.download = `${sanitize(template.name)}_${cards.length}cards.pdf`;
                a.click();
              }}
              className="bg-pult-raised hover:bg-[#2b2b2e] disabled:opacity-50 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors border border-white/[0.08]">
              {doc ? <Download size={18} /> : <Loader2 size={18} className="animate-spin" />}
              Скачать PDF
            </button>
            <button
              disabled={!doc}
              onClick={() => { if (doc) printBlob(doc.blob); }}
              className="bg-lime hover:bg-[#d4ff63] disabled:opacity-50 text-[#141415] px-8 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors">
              {doc ? <Printer size={20} /> : <Loader2 size={18} className="animate-spin" />}
              ПЕЧАТЬ
            </button>
          </div>
        )}
      </div>

      {/* ПРЕВЬЮ PDF */}
      <div className="flex-1 bg-pult-raised/60 relative overflow-hidden">
        {bgError ? (
          <CenterError text={bgError} />
        ) : qrError ? (
          <CenterError text={qrError} />
        ) : docError ? (
          <CenterError text={docError} />
        ) : !qrs ? (
          <CenterLoader text="Генерация QR-кодов…" />
        ) : !bgReady ? (
          <CenterLoader text="Загружаем фон шаблона…" />
        ) : !doc ? (
          <CenterLoader text={stage === 'fonts' ? 'Загружаем шрифты…' : 'Собираем PDF…'} />
        ) : (
          <iframe
            key={doc.url}
            title="cards-pdf"
            src={doc.url}
            className="w-full h-full border-0 bg-pult-card"
          />
        )}
      </div>
    </div>
  );
}

function CenterLoader({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
      <Loader2 size={36} className="animate-spin text-lime" />
      <span className="text-pult-text">{text}</span>
    </div>
  );
}

function CenterError({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-300 px-10 text-center">
      <AlertTriangle size={36} />
      <span className="font-medium">Не удалось собрать PDF</span>
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
