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
  { name: 'Inter (Стандарт)', value: '"Inter", sans-serif' },
  { name: 'Montserrat (Стильный)', value: '"Montserrat", sans-serif' },
  { name: 'Golos Text (Четкий)', value: '"Golos Text", sans-serif' },
  { name: 'Roboto (Классика)', value: '"Roboto", sans-serif' },
  { name: 'Rubik (Мягкий)', value: '"Rubik", sans-serif' },
];

export default function TemplatesTab({ templates, setTemplates, showToast }: TemplatesTabProps) {
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<Template>>({
    name: '',
    config: {
      bgColor: '#1e1b4b',
      textColor: '#ffffff',
      accentColor: '#8b5cf6',
      gridColor: '#2e1065',
      cardTitle: 'MUZ BINGO',
      showArtist: true,
      centerText: 'FREE SPACE',
      footerText: 'MuzBingo',
      showQR: true,
      layout: '2',
      fontFamily: '"Inter", sans-serif'
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
    <div className="animate-in fade-in duration-300 h-full flex flex-col font-sans">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Шаблоны карточек</h1>
          <p className="text-gray-400">Создавайте уникальные стили для ваших игр.</p>
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
          className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-purple-900/20"
        >
          <Palette size={20} /> Создать шаблон
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
        {templates.map(template => (
          <div key={template.id} className="group relative bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-xl transition-all hover:border-purple-500/50">
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
              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/50 rounded text-[8px] text-white uppercase font-bold tracking-tighter">
                Layout: {template.config.layout}
              </div>
            </div>
            <div className="flex justify-between items-center mt-2 px-1">
              <h3 className="font-bold truncate pr-2 text-sm">{template.name}</h3>
              <button onClick={(e) => deleteTemplate(template.id, e)} className="p-2 bg-gray-800 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isCreateTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex overflow-hidden animate-in fade-in">
          {/* БОКОВАЯ ПАНЕЛЬ НАСТРОЕК */}
          <div className="w-[450px] bg-gray-900 border-r border-gray-800 p-8 overflow-y-auto custom-scrollbar flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-8 border-b border-gray-800 pb-6">
              <div className="flex items-center gap-3 text-purple-400">
                <Palette size={28} />
                <h2 className="text-2xl font-bold text-white">Стиль карточки</h2>
              </div>
              <button onClick={() => setIsCreateTemplateModalOpen(false)} className="text-gray-500 hover:text-white transition">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Название шаблона</label>
                <input type="text" value={editingTemplate.name} onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition" placeholder="Напр: Классика А5" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 font-kz">Шрифт (поддержка Ә, Ң, Қ...)</label>
                <select 
                  value={editingTemplate.config?.fontFamily} 
                  onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, fontFamily: e.target.value } })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none cursor-pointer"
                >
                  {FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Заголовок</label>
                  <input type="text" value={editingTemplate.config?.cardTitle} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, cardTitle: e.target.value } })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Центр. клетка</label>
                  <input type="text" value={editingTemplate.config?.centerText} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, centerText: e.target.value } })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500" />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-800">
                <label className="block text-sm font-medium text-gray-400 mb-2">Фоновое изображение</label>
                {editingTemplate.config?.backgroundImageUrl && (
                  <div className="relative rounded-xl overflow-hidden border border-gray-700 mb-4 h-32 group">
                    <img src={editingTemplate.config.backgroundImageUrl} className="w-full h-full object-cover opacity-60" alt="bg preview" />
                    <button onClick={() => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, backgroundImageUrl: undefined } })} className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-lg hover:bg-red-500 transition shadow-lg opacity-0 group-hover:opacity-100">
                      <X size={16} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-3 py-3 bg-gray-800 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-purple-500 hover:bg-gray-800/50 transition">
                    <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      showToast('Загружаем фон...');
                      const url = await uploadTemplateBackground(file);
                      if (url) { setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, backgroundImageUrl: url } }); showToast('Фон добавлен!'); }
                    }} />
                    <Upload size={20} className="text-gray-500" />
                    <span className="text-gray-400 font-medium text-sm">Загрузить PNG/JPG</span>
                  </label>
                  <button onClick={downloadDesignGuide} className="p-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white transition" title="Скачать разметку A4">
                    <Download size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-500 mb-2 text-center uppercase">Фон</label><input type="color" value={editingTemplate.config?.bgColor} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, bgColor: e.target.value } })} className="w-full h-12 bg-gray-800 border border-gray-700 rounded-xl cursor-pointer p-1" /></div>
                <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-500 mb-2 text-center uppercase">Акцент</label><input type="color" value={editingTemplate.config?.accentColor} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, accentColor: e.target.value } })} className="w-full h-12 bg-gray-800 border border-gray-700 rounded-xl cursor-pointer p-1" /></div>
                <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-500 mb-2 text-center uppercase">Сетка</label><input type="color" value={editingTemplate.config?.gridColor} onChange={e => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, gridColor: e.target.value } })} className="w-full h-12 bg-gray-800 border border-gray-700 rounded-xl cursor-pointer p-1" /></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Раскладка на листе А4</label>
                <div className="flex gap-2 p-1 bg-gray-800 rounded-xl border border-gray-700">
                  {['1', '2', '4'].map(l => (
                    <button 
                      key={l} 
                      onClick={() => setEditingTemplate({ ...editingTemplate, config: { ...editingTemplate.config!, layout: l as any } })} 
                      className={`flex-1 py-2 rounded-lg font-bold transition-all ${editingTemplate.config?.layout === l ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {l} {l === '1' ? 'шт' : 'шт'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3 pt-6 border-t border-gray-800">
              <button onClick={() => setIsCreateTemplateModalOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-xl font-bold transition">Отмена</button>
              <button onClick={saveTemplate} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 transition">
                <Save size={20} /> Сохранить
              </button>
            </div>
          </div>

          {/* ОБЛАСТЬ ПРЕДПРОСМОТРА */}
          <div className="flex-1 flex flex-col items-center justify-center p-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800 to-black relative overflow-hidden">
             <div className="absolute top-8 left-8 text-gray-400 flex flex-col">
                <span className="flex items-center gap-2 font-bold text-white mb-1"><Eye size={18} /> Предпросмотр печати</span>
                <span className="text-xs">Размеры и пропорции зафиксированы под лист А4</span>
             </div>

             <div className={`bg-white shadow-[0_0_80px_rgba(0,0,0,0.5)] flex items-center justify-center gap-4 p-4 transition-all duration-500 ${editingTemplate.config?.layout === '1' ? 'w-[400px] aspect-[1/1.414]' : editingTemplate.config?.layout === '2' ? 'w-[650px] aspect-[1.414/1]' : 'w-[450px] aspect-[1/1.414] grid grid-cols-2 grid-rows-2'}`}>
                {[...Array(Number(editingTemplate.config?.layout || 1))].map((_, cardIndex) => (
                  <div key={cardIndex} style={{ 
                    backgroundColor: editingTemplate.config?.bgColor, 
                    color: editingTemplate.config?.textColor, 
                    fontFamily: editingTemplate.config?.fontFamily,
                    backgroundImage: editingTemplate.config?.backgroundImageUrl ? `url(${editingTemplate.config.backgroundImageUrl})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }} className="relative flex flex-col h-full w-full p-4 border border-dashed border-gray-300 overflow-hidden select-none">
                    <div style={{ color: editingTemplate.config?.accentColor, borderColor: `${editingTemplate.config?.accentColor}44` }} className="text-center font-black uppercase italic mb-3 text-lg border-b-2 pb-1 truncate tracking-tighter">
                      {editingTemplate.config?.cardTitle}
                    </div>
                    
                    <div className="grid grid-cols-5 gap-1 flex-1">
                      {[...Array(25)].map((_, i) => (
                        <div key={i} style={{ backgroundColor: editingTemplate.config?.gridColor }} className="rounded-sm border border-white/5 flex flex-col items-center justify-center text-center p-0.5 overflow-hidden">
                          {i === 12 
                            ? <div style={{ color: editingTemplate.config?.accentColor }} className="font-black text-[7px] uppercase leading-none">{editingTemplate.config?.centerText}</div>
                            : <div className="space-y-0.5 w-full">
                                <div className="text-[6px] font-bold leading-none line-clamp-2 uppercase">ҚАЗАҚША ТРЕК</div>
                                {editingTemplate.config?.showArtist && <div style={{ color: editingTemplate.config?.accentColor }} className="text-[4px] italic opacity-80 leading-none truncate">Әнші есімі</div>}
                              </div>
                          }
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 flex justify-between items-end opacity-80">
                      <div className="text-[6px] font-bold leading-tight">
                        ID: #104{cardIndex}<br/>
                        <span className="font-normal opacity-70">{editingTemplate.config?.footerText}</span>
                      </div>
                      {editingTemplate.config?.showQR && <div className="w-8 h-8 bg-white/90 rounded-sm border border-black/10 flex items-center justify-center text-[4px] text-black font-bold">QR CODE</div>}
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