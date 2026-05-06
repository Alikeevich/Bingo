import { useState } from 'react';
import { supabase } from '../../supabase';
import { Template } from '../../types';
import { Palette, Download, Upload, Save, Eye, Trash2, X } from 'lucide-react';

interface TemplatesTabProps {
  templates: Template[];
  setTemplates: (val: Template[]) => void;
  showToast: (msg: string) => void;
}

// Список шрифтов с поддержкой кириллицы и казахских символов
const FONTS = [
  { name: 'Inter (Стандартный)', value: '"Inter", sans-serif' },
  { name: 'Montserrat (Стильный)', value: '"Montserrat", sans-serif' },
  { name: 'Golos Text (Современный)', value: '"Golos Text", sans-serif' },
  { name: 'Roboto (Классика)', value: '"Roboto", sans-serif' },
  { name: 'Rubik (Скругленный)', value: '"Rubik", sans-serif' },
];

export default function TemplatesTab({ templates, setTemplates, showToast }: TemplatesTabProps) {
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
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
            <div className="flex items-center gap-3 mb-8 text-purple-400 border-b border-gray-800 pb-6">
              <Palette size={28} />
              <h2 className="text-2xl font-bold text-white">Конструктор стиля</h2>
            </div>
            
            <div className="space-y-6 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Название шаблона</label>
                <input type="text" value={editingTemplate.name} onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none" placeholder="Напр: Классика 2 на А4" />
              </div>

              {/* ШРИФТЫ */}
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

              {/* ДИЗАЙН И РАЗМЕТКА */}
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

          <div className="flex-1 flex flex-col items-center justify-center p-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 to-black relative overflow-hidden">
             <div className="absolute top-10 left-10 flex flex-col text-gray-400"><span className="flex items-center gap-2 font-bold text-white mb-1"><Eye size={20} /> Предпросмотр печати</span><span className="text-sm">Пример генерации на листе бумаги</span></div>
             
             <div className={`bg-white shadow-[0_0_60px_rgba(0,0,0,0.8)] flex items-center justify-center gap-4 p-4 transition-all duration-500 ${editingTemplate.config?.layout === '1' ? 'w-[400px] aspect-[1/1.414]' : editingTemplate.config?.layout === '2' ? 'w-[600px] aspect-[1.414/1] flex-row' : 'w-[450px] aspect-[1/1.414] grid grid-cols-2 grid-rows-2'}`}>
                {[...Array(Number(editingTemplate.config?.layout || 1))].map((_, cardIndex) => (
                  <div key={cardIndex} style={{ 
                    backgroundColor: editingTemplate.config?.bgColor, 
                    color: editingTemplate.config?.textColor, 
                    fontFamily: editingTemplate.config?.fontFamily,
                    backgroundImage: editingTemplate.config?.backgroundImageUrl ? `url(${editingTemplate.config.backgroundImageUrl})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }} className={`relative flex flex-col rounded shadow-md overflow-hidden ${editingTemplate.config?.layout === '1' ? 'w-full h-full p-8 border-2 border-dashed border-gray-300' : editingTemplate.config?.layout === '2' ? 'w-1/2 h-full p-6 border border-dashed border-gray-300' : 'w-full h-full p-3 border border-dashed border-gray-300'}`}>
                    <div style={{ color: editingTemplate.config?.accentColor, borderColor: `${editingTemplate.config?.accentColor}44` }} className={`text-center font-black border-b-4 uppercase italic tracking-tighter ${editingTemplate.config?.layout === '4' ? 'text-xl mb-2 pb-1 border-b-2' : 'text-3xl mb-4 pb-3'}`}>{editingTemplate.config?.cardTitle}</div>
                    
                    <div className="grid grid-cols-5 gap-1 flex-1">
                      {[...Array(25)].map((_, i) => (
                        <div key={i} style={{ backgroundColor: editingTemplate.config?.gridColor }} className="rounded border border-white/10 flex flex-col items-center justify-center text-center p-1 overflow-hidden">
                          {i === 12 
                            ? <div style={{ color: editingTemplate.config?.accentColor }} className={`font-black uppercase leading-tight ${editingTemplate.config?.layout === '4' ? 'text-[8px]' : 'text-xs'}`}>{editingTemplate.config?.centerText}</div>
                            : <>
                                <div className={`font-bold leading-tight opacity-90 uppercase ${editingTemplate.config?.layout === '4' ? 'text-[6px]' : 'text-[9px]'}`}>ТРЕК {i + 1}</div>
                                {editingTemplate.config?.showArtist && <div style={{ color: editingTemplate.config?.accentColor }} className={`font-medium leading-tight opacity-90 italic mt-0.5 ${editingTemplate.config?.layout === '4' ? 'text-[5px]' : 'text-[7px]'}`}>Исполнитель</div>}
                              </>
                          }
                        </div>
                      ))}
                    </div>

                    <div className={`mt-4 flex justify-between items-end ${editingTemplate.config?.layout === '4' ? 'mt-2' : ''}`}>
                      <div className="flex flex-col bg-white/50 p-1 rounded-sm">
                        <div className={`opacity-80 uppercase font-bold ${editingTemplate.config?.layout === '4' ? 'text-[6px]' : 'text-[9px]'}`}>ID: #1042</div>
                        <div className={`opacity-70 font-medium ${editingTemplate.config?.layout === '4' ? 'text-[5px]' : 'text-[7px]'}`}>{editingTemplate.config?.footerText}</div>
                      </div>
                      {editingTemplate.config?.showQR && <div className={`bg-white/90 border border-white/20 flex items-center justify-center p-1 ${editingTemplate.config?.layout === '4' ? 'w-8 h-8 rounded-sm' : 'w-12 h-12 rounded'}`}><div className="text-black text-[4px] font-bold">QR CODE</div></div>}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}