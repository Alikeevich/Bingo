import { useState } from 'react';
import { supabase } from '../../supabase';
import { Template } from '../../types';
import { Palette, Download, Upload, Save, Eye, Trash2, X } from 'lucide-react';

interface TemplatesTabProps {
  templates: Template[];
  setTemplates: (val: Template[]) => void;
  showToast: (msg: string) => void;
}

const FONTS =[
  { name: 'Inter (Стандартный)', value: '"Inter", sans-serif' },
  { name: 'Montserrat (Стильный)', value: '"Montserrat", sans-serif' },
  { name: 'Golos Text (Современный)', value: '"Golos Text", sans-serif' },
  { name: 'Roboto (Классика)', value: '"Roboto", sans-serif' },
  { name: 'Rubik (Скругленный)', value: '"Rubik", sans-serif' },
];

const ZONES = {
  PAD: 2.7,
  
  // ── Layout 1 (1 на А4) — A4 Portrait (210×297) ───────────────
  1: {
    headerH:  21.2, headerGap: 4.2, gridH: 211.7, footerH: 34.5, qrSize: 29.6, idH: 20.3, idW: 25.4, cellGap: 1.5,
    titleFz:  13.0, trackFz: 3.5, artistFz: 2.7, centerFz: 5.0, idFz: 2.8, idSubFz: 2.0, qrPhFz: 2.5,
  },
  
  // ── Layout 2 (2 на А4) — A4 Landscape (297×210) ───────────────
  // Лист перевернут. Карточки стоят рядом (2 колонки, 1 строка)
  // Идеально сохраняет пропорции вертикальной карточки.
  2: {
    headerH:  14.4, headerGap: 2.8, gridH: 143.9, footerH: 23.5, qrSize: 20.1, idH: 13.8, idW: 17.6, cellGap: 1.0,
    titleFz:   8.8, trackFz: 2.4, artistFz: 1.8, centerFz: 3.4, idFz: 1.9, idSubFz: 1.4, qrPhFz: 1.7,
  },
  
  // ── Layout 4 (4 на А4) — A4 Portrait (210×297) ────────────────
  // Сетка 2x2. Карточки тоже остаются вертикальными.
  4: {
    headerH:  10.0, headerGap: 2.0, gridH:  99.8, footerH: 16.3, qrSize: 14.0, idH:  9.6, idW: 12.0, cellGap: 0.7,
    titleFz:   6.1, trackFz: 1.6, artistFz: 1.2, centerFz: 2.3, idFz: 1.3, idSubFz: 0.9, qrPhFz: 1.2,
  },
} as const;

const mm = (v: number) => `${v}mm`;

export default function TemplatesTab({ templates, setTemplates, showToast }: TemplatesTabProps) {
  const[isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<Template>>({
    name: '',
    config: {
      bgColor: '#1e1b4b', textColor: '#ffffff', accentColor: '#8b5cf6',
      gridColor: '#2e1065', cardTitle: 'MUZ BINGO', showArtist: true,
      centerText: 'FREE SPACE', footerText: 'MuzBingo', showQR: true, 
      layout: '2', fontFamily: '"Inter", sans-serif'
    },
  });

  const uploadTemplateBackground = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const fileName = `template_bg_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('template-backgrounds').upload(fileName, file, { upsert: true });
    if (error) { showToast('Ошибка загрузки: ' + error.message); return null; }
    const { data: urlData } = supabase.storage.from('template-backgrounds').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const downloadDesignGuide = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2480" height="3508" viewBox="0 0 2480 3508"><rect width="2480" height="3508" fill="#f3f4f6"/><rect x="150" y="150" width="2180" height="3200" fill="none" stroke="#9ca3af" stroke-width="4" stroke-dasharray="20,20"/><rect x="150" y="150" width="2180" height="250" fill="#fca5a5" opacity="0.6" rx="20"/><text x="1240" y="310" font-family="sans-serif" font-size="90" font-weight="black" font-style="italic" text-anchor="middle" fill="#991b1b">ЗАГОЛОВОК (TITLE)</text><rect x="150" y="450" width="2180" height="2500" fill="#86efac" opacity="0.6" rx="20"/><text x="1240" y="1660" font-family="sans-serif" font-size="140" font-weight="black" text-anchor="middle" fill="#166534">СЕТКА ТРЕКОВ (5x5)</text><rect x="150" y="3110" width="300" height="240" fill="#fcd34d" opacity="0.6" rx="15"/><text x="180" y="3195" font-family="sans-serif" font-size="60" font-weight="bold" fill="#854d0e">ID: #1042</text><rect x="1980" y="3000" width="350" height="350" fill="#93c5fd" opacity="0.6" rx="20"/><text x="2155" y="3190" font-family="sans-serif" font-size="60" font-weight="bold" text-anchor="middle" fill="#1e3a8a">QR-КОД</text></svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'MuzBingo_Design_Guide_A4.svg'; a.click();
    URL.revokeObjectURL(url);
  };

  const saveTemplate = async () => {
    if (!editingTemplate.name) return showToast('Введите название шаблона');
    const { data } = await supabase.from('templates').insert([{ name: editingTemplate.name, config: editingTemplate.config }]).select();
    if (data) { 
      setTemplates([data[0], ...templates]); 
      setIsCreateTemplateModalOpen(false); 
      showToast('Шаблон сохранён!'); 
    }
  };

  const deleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Удалить шаблон?')) {
      setTemplates(templates.filter(t => t.id !== id));
      await supabase.from('templates').delete().eq('id', id);
      showToast('Шаблон удалён');
    }
  };

  const layoutNum = parseInt(editingTemplate.config?.layout || '1') as 1 | 2 | 4;
  const isLandscape = layoutNum === 2; // Если формат 2 -> лист альбомный
  const g = ZONES[layoutNum];
  const p = ZONES.PAD;
  
  const pageStyle: React.CSSProperties = {
    // Размеры листа меняются местами для Landscape
    width: isLandscape ? '297mm' : '210mm',
    height: isLandscape ? '210mm' : '297mm',
    backgroundColor: 'white',
    overflow: 'hidden',
    padding: '10mm',
    gap: '10mm',
    boxSizing: 'border-box',
    ...(layoutNum === 1
      ? { display: 'flex', flexDirection: 'column' }
      : layoutNum === 2
      // Две колонки, одна строка
      ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' }
      // Две колонки, две строки
      : { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }),
  };

  return (
    <div className="animate-in fade-in duration-300 h-full flex flex-col">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Шаблоны карточек</h1>
          <p className="text-gray-400">Настройте внешний вид бинго-карточек.</p>
        </div>
        <button 
          onClick={() => { 
            setEditingTemplate({ 
              name: '', 
              config: { 
                bgColor: '#1e1b4b', textColor: '#ffffff', accentColor: '#8b5cf6', 
                gridColor: '#2e1065', cardTitle: 'MUZ BINGO', showArtist: true, 
                centerText: 'FREE SPACE', footerText: 'MuzBingo', showQR: true, 
                layout: '2', fontFamily: '"Inter", sans-serif' 
              } 
            }); 
            setIsCreateTemplateModalOpen(true); 
          }} 
          className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition flex items-center gap-2"
        >
          <Palette size={20} /> Создать шаблон
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
        {templates.map(template => (
          <div key={template.id} className="group relative bg-gray-900 border border-gray-800 p-4 rounded-2xl">
            <div style={{ 
              backgroundColor: template.config.bgColor, 
              backgroundImage: template.config.backgroundImageUrl ? `url(${template.config.backgroundImageUrl})` : 'none', 
              backgroundSize: 'cover', 
              backgroundPosition: 'center',
              fontFamily: template.config.fontFamily || 'sans-serif'
            }} className="aspect-[3/4] rounded-xl p-3 shadow-inner border border-white/10 overflow-hidden mb-4 relative">
              <div style={{ color: template.config.accentColor }} className="text-center font-black text-[10px] mb-2 border-b pb-1 border-white/10 uppercase truncate">{template.config.cardTitle}</div>
              <div className="grid grid-cols-5 gap-0.5 opacity-40">
                {[...Array(25)].map((_, i) => (
                  <div key={i} style={{ backgroundColor: template.config.gridColor }} className="aspect-square rounded-sm border border-white/5" />
                ))}
              </div>
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/50 rounded text-[10px] text-white">{template.config.layout} на А4</div>
            </div>
            <div className="flex justify-between items-center mt-2">
              <h3 className="font-bold truncate pr-2">{template.name}</h3>
              <button onClick={(e) => deleteTemplate(template.id, e)} className="p-2 bg-gray-800 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isCreateTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex overflow-hidden">
          <div className="w-[450px] bg-gray-900 border-r border-gray-800 p-8 overflow-y-auto custom-scrollbar flex flex-col">
            {/* Панель настроек (без изменений) */}
            <div className="flex items-center gap-3 mb-8 text-purple-400 border-b border-gray-800 pb-6">
              <Palette size={28} />
              <h2 className="text-2xl font-bold text-white">Конструктор стиля</h2>
            </div>
            
            <div className="space-y-6 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Название шаблона</label>
                <input type="text" value={editingTemplate.name} onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none" placeholder="Напр: Классика 2 на А4" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Шрифт (с поддержкой Қазақша)</label>
                <select 
                  value={editingTemplate.config?.fontFamily} 
                  onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, fontFamily: e.target.value } })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                >
                  {FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Заголовок</label>
                  <input type="text" value={editingTemplate.config?.cardTitle} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, cardTitle: e.target.value } })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Центр. клетка</label>
                  <input type="text" value={editingTemplate.config?.centerText} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, centerText: e.target.value } })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none" />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-800">
                <label className="block text-sm font-medium text-gray-400 mb-2">Фоновое изображение (PNG/JPG)</label>
                {editingTemplate.config?.backgroundImageUrl && (
                  <div className="relative rounded-xl overflow-hidden border border-gray-700 mb-4">
                    <img src={editingTemplate.config.backgroundImageUrl} className="w-full h-32 object-cover opacity-80" alt="bg preview" />
                    <button onClick={() => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, backgroundImageUrl: undefined } })} className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-lg hover:bg-red-500 transition"><X size={16} /></button>
                  </div>
                )}
                <label className="flex items-center justify-center gap-3 w-full py-3 mb-3 bg-gray-800 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-purple-500 hover:bg-gray-700/50 transition">
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    if (file.size > 10 * 1024 * 1024) return showToast('Файл слишком большой');
                    showToast('Загружаем изображение...');
                    const url = await uploadTemplateBackground(file);
                    if (url) { setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, backgroundImageUrl: url } }); showToast('Изображение загружено!'); }
                  }} />
                  <Upload size={20} className="text-gray-400" />
                  <span className="text-gray-400 font-medium">Загрузить PNG/JPG</span>
                </label>
                <button onClick={downloadDesignGuide} className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition font-medium border border-gray-700"><Download size={18} /> Скачать разметку для дизайнера (SVG)</button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Раскладка для печати</label>
                <div className="flex gap-2 p-1 bg-gray-800 rounded-xl">
                  {(['1', '2', '4'] as const).map(layout => (
                    <button key={layout} onClick={() => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, layout } })} className={`flex-1 py-2 rounded-lg font-bold transition ${editingTemplate.config?.layout === layout ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>{layout} {layout === '1' ? '(А4)' : layout === '2' ? '(А5)' : '(А6)'}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col"><label className="text-xs font-medium text-gray-400 mb-2 text-center">Цвет Фона</label><input type="color" value={editingTemplate.config?.bgColor} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, bgColor: e.target.value } })} className="w-full h-12 bg-gray-800 border border-gray-700 rounded-xl cursor-pointer" /></div>
                <div className="flex flex-col"><label className="text-xs font-medium text-gray-400 mb-2 text-center">Акцент</label><input type="color" value={editingTemplate.config?.accentColor} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, accentColor: e.target.value } })} className="w-full h-12 bg-gray-800 border border-gray-700 rounded-xl cursor-pointer" /></div>
                <div className="flex flex-col"><label className="text-xs font-medium text-gray-400 mb-2 text-center">Цвет Сетки</label><input type="color" value={editingTemplate.config?.gridColor} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, gridColor: e.target.value } })} className="w-full h-12 bg-gray-800 border border-gray-700 rounded-xl cursor-pointer" /></div>
              </div>

              <div><label className="block text-sm font-medium text-gray-400 mb-2">Текст в подвале</label><input type="text" value={editingTemplate.config?.footerText} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, footerText: e.target.value } })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none" /></div>

              <div className="space-y-3 pt-4 border-t border-gray-800">
                <label className="flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-700 transition cursor-pointer rounded-xl border border-gray-700"><span className="font-medium">Показывать исполнителя</span><input type="checkbox" checked={editingTemplate.config?.showArtist} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, showArtist: e.target.checked } })} className="w-5 h-5 accent-purple-600" /></label>
                <label className="flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-700 transition cursor-pointer rounded-xl border border-gray-700"><span className="font-medium">Добавить блок QR-кода</span><input type="checkbox" checked={editingTemplate.config?.showQR} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, showQR: e.target.checked } })} className="w-5 h-5 accent-purple-600" /></label>
              </div>
            </div>

            <div className="mt-8 flex gap-3 pt-6 border-t border-gray-800">
              <button onClick={() => setIsCreateTemplateModalOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 py-4 rounded-xl font-bold transition">Отмена</button>
              <button onClick={saveTemplate} className="flex-1 bg-purple-600 hover:bg-purple-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition"><Save size={20} /> Сохранить</button>
            </div>
          </div>

          {/* ПРАВАЯ ЧАСТЬ С ПРЕДПРОСМОТРОМ */}
          <div className="flex-1 flex flex-col items-center justify-center p-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 to-black relative overflow-hidden">
             <div className="absolute top-10 left-10 flex flex-col text-gray-400 z-10">
               <span className="flex items-center gap-2 font-bold text-white mb-1"><Eye size={20} /> Предпросмотр печати</span>
               <span className="text-sm">Точные пропорции гайда (масштабировано под экран)</span>
             </div>
             
             <div className="relative w-full h-full flex items-center justify-center">
               {/* 
                 Динамический скейл: автоматически подстраивается под высоту экрана!
                 1122px — это примерная высота 297мм на экране, чтобы лист всегда помещался 
                 без обрезания по краям на любых ноутбуках. 
               */}
               <div style={{ 
                 position: 'absolute', 
                 transform: 'scale(min(0.5, calc((100vh - 80px) / 1122)))', 
                 transformOrigin: 'center center',
                 transition: 'all 0.3s ease' 
               }}>
                 <div style={pageStyle} className="shadow-[0_0_80px_rgba(0,0,0,0.8)]">
                   {[...Array(layoutNum)].map((_, cardIndex) => (
                     <div
                       key={cardIndex}
                       style={{
                         flex: layoutNum === 1 ? '1 1 auto' : undefined,
                         width: '100%',      // Жёстко заставляем занимать всю ячейку
                         height: '100%',     // Жёстко заставляем занимать всю ячейку
                         minHeight: '100%',  // Блокируем сжатие карточки
                         flexShrink: 0,
                         display: 'flex',
                         flexDirection: 'column',
                         padding: mm(p),
                         boxSizing: 'border-box',
                         overflow: 'hidden',
                         backgroundColor: editingTemplate.config?.bgColor,
                         color: editingTemplate.config?.textColor,
                         backgroundImage: editingTemplate.config?.backgroundImageUrl
                           ? `url(${editingTemplate.config.backgroundImageUrl})`
                           : 'none',
                         backgroundSize: 'cover',
                         backgroundPosition: 'center',
                         fontFamily: editingTemplate.config?.fontFamily || '"Inter", sans-serif',
                         borderRadius: '3mm',
                         border: '0.4mm dashed #9ca3af',
                       }}
                     >
                       {/* ЗОНА 1 — ЗАГОЛОВОК */}
                       <div
                         style={{
                           height:    mm(g.headerH),
                           minHeight: mm(g.headerH),
                           maxHeight: mm(g.headerH),
                           flexShrink: 0, // Запрет сжатия
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           borderBottom: `0.7mm solid ${editingTemplate.config?.accentColor}55`,
                           color: editingTemplate.config?.accentColor,
                           fontSize: mm(g.titleFz),
                           fontWeight: 900,
                           fontStyle: 'italic',
                           textTransform: 'uppercase',
                           letterSpacing: '-0.03em',
                           overflow: 'hidden',
                         }}
                       >
                         {editingTemplate.config?.cardTitle}
                       </div>

                       {/* ЗОНА 2 — GAP */}
                       <div style={{ height: mm(g.headerGap), minHeight: mm(g.headerGap), flexShrink: 0 }} />

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
                           flexShrink: 0, // Запрет сжатия
                         }}
                       >
                         {[...Array(25)].map((_, i) => {
                           const isFree = i === 12;
                           return (
                             <div
                               key={i}
                               style={{
                                 backgroundColor: editingTemplate.config?.gridColor,
                                 borderRadius: '0.8mm',
                                 border: '0.2mm solid rgba(255,255,255,0.1)',
                                 display: 'flex',
                                 flexDirection: 'column',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 textAlign: 'center',
                                 padding: '0.5mm',
                                 overflow: 'hidden',
                                 minHeight: 0, // Запрещаем тексту растягивать ячейку за пределы контейнера!
                               }}
                             >
                               {isFree ? (
                                 <div
                                   style={{
                                     color: editingTemplate.config?.accentColor,
                                     fontSize: mm(g.centerFz),
                                     fontWeight: 900,
                                     textTransform: 'uppercase',
                                     lineHeight: 1.1,
                                   }}
                                 >
                                   {editingTemplate.config?.centerText}
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
                                     ТРЕК {i + 1}
                                   </div>
                                   {editingTemplate.config?.showArtist && (
                                     <div
                                       style={{
                                         color: editingTemplate.config?.accentColor,
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
                                       Исполнитель
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
                           maxHeight: mm(g.footerH),
                           flexShrink: 0, // Запрет сжатия
                           display: 'flex',
                           justifyContent: 'space-between',
                           alignItems: 'flex-end',
                         }}
                       >
                         {/* ID-блок */}
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
                               color: editingTemplate.config?.textColor,
                               whiteSpace: 'nowrap',
                               overflow: 'hidden',
                             }}
                           >
                             ID: #1042
                           </div>
                           <div
                             style={{
                               fontSize: mm(g.idSubFz),
                               fontWeight: 500,
                               opacity: 0.7,
                               lineHeight: 1.2,
                               color: editingTemplate.config?.textColor,
                               whiteSpace: 'nowrap',
                               overflow: 'hidden',
                             }}
                           >
                             {editingTemplate.config?.footerText}
                           </div>
                         </div>

                         {/* QR-блок */}
                         {editingTemplate.config?.showQR && (
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
                           </div>
                         )}
                       </div>

                     </div>
                   ))}
                 </div>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}