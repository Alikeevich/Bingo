import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Template, TemplateConfig, GridSlot, QrSlot, SlotRect, TextStyle, DEFAULT_TEMPLATE_CONFIG } from '../../types';
import { migrateTemplateConfig } from '../../lib/migrateTemplate';
import { Palette, Upload, Save, Trash2, X, LayoutGrid, Hash, QrCode, Type, Eye, EyeOff, Bold, Italic, Plus, Pencil } from 'lucide-react';

interface TemplatesTabProps {
  templates: Template[];
  setTemplates: (val: Template[]) => void;
  showToast: (msg: string) => void;
}

// A4 в мм
const A4 = { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } };

type SlotKey = 'grid' | 'idSlot' | 'qrSlot';
const SLOT_META: Record<SlotKey, { color: string; label: string; icon: typeof LayoutGrid }> = {
  grid:   { color: '#22c55e', label: 'Сетка треков',     icon: LayoutGrid },
  idSlot: { color: '#eab308', label: 'ID карточки',      icon: Hash },
  qrSlot: { color: '#3b82f6', label: 'QR-код',           icon: QrCode },
};

const ALLOWED_FONTS = [
  { value: 'Roboto',     label: 'Roboto (стандарт)' },
  { value: 'RobotoMono', label: 'Roboto Mono (моноширин.)' },
] as const;

export default function TemplatesTab({ templates, setTemplates, showToast }: TemplatesTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);  // null = создаём новый
  const [name, setName]               = useState('');
  const [config, setConfig]           = useState<TemplateConfig>(DEFAULT_TEMPLATE_CONFIG);
  const [activeSlot, setActiveSlot]   = useState<SlotKey>('grid');
  const [isUploadingBg, setIsUploadingBg] = useState(false);

  // ──────────────────────────────────────────────────────────────────
  // ОТКРЫТИЕ МОДАЛКИ
  // ──────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setName('');
    setConfig(DEFAULT_TEMPLATE_CONFIG);
    setActiveSlot('grid');
    setIsModalOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditingId(t.id);
    setName(t.name);
    setConfig(migrateTemplateConfig(t.config));
    setActiveSlot('grid');
    setIsModalOpen(true);
  };

  // ──────────────────────────────────────────────────────────────────
  // СОХРАНЕНИЕ
  // ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!name.trim()) return showToast('Введите название шаблона');
    if (editingId) {
      const { data } = await supabase.from('templates').update({ name, config }).eq('id', editingId).select();
      if (data) {
        setTemplates(templates.map(t => t.id === editingId ? data[0] : t));
        showToast('Шаблон обновлён');
        setIsModalOpen(false);
      }
    } else {
      const { data } = await supabase.from('templates').insert([{ name, config }]).select();
      if (data) {
        setTemplates([data[0], ...templates]);
        showToast('Шаблон сохранён');
        setIsModalOpen(false);
      }
    }
  };

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Удалить шаблон?')) return;
    setTemplates(templates.filter(t => t.id !== id));
    await supabase.from('templates').delete().eq('id', id);
    showToast('Шаблон удалён');
  };

  // ──────────────────────────────────────────────────────────────────
  // ЗАГРУЗКА ФОНА
  // ──────────────────────────────────────────────────────────────────
  const uploadBg = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) return showToast('Файл слишком большой (>15МБ)');
    setIsUploadingBg(true);
    const ext = file.name.split('.').pop() ?? 'png';
    const fileName = `template_bg_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('template-backgrounds').upload(fileName, file, { upsert: true });
    if (error) { setIsUploadingBg(false); return showToast('Ошибка загрузки: ' + error.message); }
    const { data: urlData } = supabase.storage.from('template-backgrounds').getPublicUrl(data.path);
    setConfig(c => ({ ...c, backgroundImageUrl: urlData.publicUrl }));
    setIsUploadingBg(false);
    showToast('Фон загружен');
  };

  // ──────────────────────────────────────────────────────────────────
  // ПАТЧЕРЫ
  // ──────────────────────────────────────────────────────────────────
  const patchSlot = (key: SlotKey, patch: Partial<SlotRect & Partial<GridSlot> & Partial<QrSlot>>) => {
    setConfig(c => ({ ...c, [key]: { ...(c as any)[key], ...patch } }));
  };
  const patchText = (key: keyof TemplateConfig, patch: Partial<TextStyle> & Record<string, unknown>) => {
    setConfig(c => ({ ...c, [key]: { ...(c as any)[key], ...patch } }));
  };

  return (
    <div className="animate-in fade-in duration-300 h-full flex flex-col">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Шаблоны карточек</h1>
          <p className="text-gray-400">Дизайн макета = PNG-фон. Над ним размещаем сетку треков, ID и QR.</p>
        </div>
        <button onClick={openCreate} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition flex items-center gap-2">
          <Plus size={20} /> Создать шаблон
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
        {templates.map(template => (
          <TemplateCard key={template.id} template={template} onOpen={() => openEdit(template)} onDelete={(e) => remove(template.id, e)} />
        ))}
        {templates.length === 0 && (
          <button onClick={openCreate} className="col-span-full border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-2xl p-12 text-center text-gray-500 hover:text-purple-300 transition">
            <Palette size={48} className="mx-auto mb-3" />
            <div className="font-bold text-lg mb-1">Нет шаблонов</div>
            <div className="text-sm">Создайте первый — нажмите здесь</div>
          </button>
        )}
      </div>

      {isModalOpen && (
        <EditorModal
          name={name} setName={setName}
          config={config} setConfig={setConfig}
          activeSlot={activeSlot} setActiveSlot={setActiveSlot}
          isUploadingBg={isUploadingBg}
          onClose={() => setIsModalOpen(false)}
          onSave={save}
          onUploadBg={uploadBg}
          patchSlot={patchSlot}
          patchText={patchText}
          isEdit={editingId !== null}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// КАРТОЧКА В СПИСКЕ
// ─────────────────────────────────────────────────────────────────────────

function TemplateCard({ template, onOpen, onDelete }: { template: Template; onOpen: () => void; onDelete: (e: React.MouseEvent) => void }) {
  const c = migrateTemplateConfig(template.config);
  const ar = c.orientation === 'portrait' ? 210 / 297 : 297 / 210;

  return (
    <div className="group relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500 transition cursor-pointer"
         onClick={onOpen}>
      <div className="relative w-full bg-gray-950" style={{ aspectRatio: ar }}>
        {c.backgroundImageUrl ? (
          <img src={c.backgroundImageUrl} alt="" className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">Нет фона</div>
        )}
        {/* мини-разметка слотов */}
        <SlotOverlayPreview config={c} />
      </div>
      <div className="p-4 flex justify-between items-center">
        <div className="min-w-0">
          <h3 className="font-bold truncate">{template.name}</h3>
          <p className="text-xs text-gray-500">{c.orientation === 'portrait' ? 'A4 портрет' : 'A4 альбом'}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onOpen(); }} className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition">
            <Pencil size={16} />
          </button>
          <button onClick={onDelete} className="p-2 bg-gray-800 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SlotOverlayPreview({ config }: { config: TemplateConfig }) {
  const page = A4[config.orientation];
  const toPct = (v: number, total: number) => `${(v / total) * 100}%`;
  const rectPct = (r: SlotRect) => ({
    left: toPct(r.x, page.w),
    top:  toPct(r.y, page.h),
    width: toPct(r.width, page.w),
    height: toPct(r.height, page.h),
  });
  return (
    <>
      <div style={{ position: 'absolute', ...rectPct(config.grid),   border: '1px dashed #22c55e88' }} />
      <div style={{ position: 'absolute', ...rectPct(config.idSlot), border: '1px dashed #eab30888' }} />
      {config.qrSlot.enabled && <div style={{ position: 'absolute', ...rectPct(config.qrSlot), border: '1px dashed #3b82f688' }} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// МОДАЛКА РЕДАКТОРА
// ─────────────────────────────────────────────────────────────────────────

interface EditorModalProps {
  name: string; setName: (v: string) => void;
  config: TemplateConfig; setConfig: React.Dispatch<React.SetStateAction<TemplateConfig>>;
  activeSlot: SlotKey; setActiveSlot: (k: SlotKey) => void;
  isUploadingBg: boolean;
  onClose: () => void;
  onSave: () => void;
  onUploadBg: (f: File) => void;
  patchSlot: (key: SlotKey, patch: Partial<SlotRect & Partial<GridSlot> & Partial<QrSlot>>) => void;
  patchText: (key: keyof TemplateConfig, patch: Partial<TextStyle> & Record<string, unknown>) => void;
  isEdit: boolean;
}

function EditorModal({
  name, setName, config, setConfig, activeSlot, setActiveSlot, isUploadingBg,
  onClose, onSave, onUploadBg, patchSlot, patchText, isEdit,
}: EditorModalProps) {

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex overflow-hidden">
      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <div className="w-[420px] bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800 flex items-center gap-3 text-purple-400">
          <Palette size={26} />
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">{isEdit ? 'Редактирование шаблона' : 'Новый шаблон'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Дизайн = PNG-фон, накладываем динамику</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* НАЗВАНИЕ */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Название</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:border-purple-500 outline-none"
              placeholder="Например: Классика А4"/>
          </div>

          {/* ФОН */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Дизайнерский фон (A4 PNG/JPG)</label>
            {config.backgroundImageUrl && (
              <div className="relative rounded-xl overflow-hidden border border-gray-700 mb-3 bg-gray-950">
                <img src={config.backgroundImageUrl} className="w-full h-28 object-contain" alt="" />
                <button onClick={() => setConfig(c => ({ ...c, backgroundImageUrl: '' }))} className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-500 rounded-lg"><X size={14} /></button>
              </div>
            )}
            <label className={`flex items-center justify-center gap-3 w-full py-3 bg-gray-800 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-purple-500 transition ${isUploadingBg ? 'opacity-50 pointer-events-none' : ''}`}>
              <input type="file" accept="image/png,image/jpeg" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onUploadBg(f); }}/>
              <Upload size={18} className="text-gray-400" />
              <span className="text-gray-300 font-medium text-sm">{isUploadingBg ? 'Загружаем...' : 'Загрузить PNG/JPG'}</span>
            </label>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">Рекомендация: A4 в 300 DPI (2480×3508 пикселей).</p>
          </div>

          {/* ОРИЕНТАЦИЯ */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Ориентация</label>
            <div className="flex gap-2 p-1 bg-gray-800 rounded-xl">
              {(['portrait', 'landscape'] as const).map(o => (
                <button key={o} onClick={() => setConfig(c => ({ ...c, orientation: o }))}
                  className={`flex-1 py-2 rounded-lg font-bold transition ${config.orientation === o ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {o === 'portrait' ? 'Портрет' : 'Альбом'}
                </button>
              ))}
            </div>
          </div>

          {/* ПЕРЕКЛЮЧАТЕЛЬ СЛОТОВ */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Активный слот</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(SLOT_META) as SlotKey[]).map(k => {
                const m = SLOT_META[k];
                const Icon = m.icon;
                const isActive = activeSlot === k;
                return (
                  <button key={k} onClick={() => setActiveSlot(k)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition ${isActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-800 bg-gray-800/50 hover:border-gray-700'}`}>
                    <Icon size={20} style={{ color: m.color }} />
                    <span className="text-[10px] font-bold uppercase text-gray-300">{k === 'grid' ? 'Сетка' : k === 'idSlot' ? 'ID' : 'QR'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ПОЗИЦИЯ И РАЗМЕР АКТИВНОГО СЛОТА */}
          <SlotPositionEditor
            slotKey={activeSlot}
            config={config}
            patchSlot={patchSlot}
          />

          {/* СВОЙСТВА АКТИВНОГО СЛОТА */}
          {activeSlot === 'grid' && (
            <GridSettings config={config} patchSlot={patchSlot} patchText={patchText} />
          )}
          {activeSlot === 'idSlot' && (
            <IdSettings config={config} patchText={patchText} />
          )}
          {activeSlot === 'qrSlot' && (
            <QrSettings config={config} patchSlot={patchSlot} setConfig={setConfig} />
          )}
        </div>

        <div className="p-6 border-t border-gray-800 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 py-3 rounded-xl font-bold transition">Отмена</button>
          <button onClick={onSave} className="flex-1 bg-purple-600 hover:bg-purple-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition">
            <Save size={18} /> Сохранить
          </button>
        </div>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ — VISUAL CANVAS */}
      <div className="flex-1 bg-[radial-gradient(ellipse_at_center,#1f2937,#000)] relative overflow-hidden">
        <CanvasEditor
          config={config}
          activeSlot={activeSlot}
          setActiveSlot={setActiveSlot}
          patchSlot={patchSlot}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ИНТЕРАКТИВНЫЙ CANVAS — ПЕРЕТАСКИВАЕМ И РЕСАЙЗИМ СЛОТЫ
// ─────────────────────────────────────────────────────────────────────────

function CanvasEditor({ config, activeSlot, setActiveSlot, patchSlot }: {
  config: TemplateConfig;
  activeSlot: SlotKey;
  setActiveSlot: (k: SlotKey) => void;
  patchSlot: EditorModalProps['patchSlot'];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);   // px на mm
  const page = A4[config.orientation];

  // Авто-fit страницы под доступную область
  useEffect(() => {
    const recompute = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const padding = 60;
      const availW = wrap.clientWidth  - padding * 2;
      const availH = wrap.clientHeight - padding * 2;
      const s = Math.min(availW / page.w, availH / page.h);
      setScale(Math.max(0.5, s));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [page.w, page.h]);

  // Drag/resize handler
  const startDrag = useCallback((slotKey: SlotKey, mode: 'move' | 'resize', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveSlot(slotKey);
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect: SlotRect = { ...(config as any)[slotKey] };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const dxMm = (ev.clientX - startX) / scale;
      const dyMm = (ev.clientY - startY) / scale;
      if (mode === 'move') {
        const x = clamp(startRect.x + dxMm, 0, page.w - startRect.width);
        const y = clamp(startRect.y + dyMm, 0, page.h - startRect.height);
        patchSlot(slotKey, { x: round1(x), y: round1(y) });
      } else {
        const width  = clamp(startRect.width  + dxMm, 5, page.w - startRect.x);
        const height = clamp(startRect.height + dyMm, 5, page.h - startRect.y);
        patchSlot(slotKey, { width: round1(width), height: round1(height) });
      }
    };
    const up = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [config, scale, patchSlot, page.w, page.h, setActiveSlot]);

  return (
    <div ref={wrapRef} className="absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* Превью-страница в реальных мм */}
      <div
        ref={pageRef}
        className="relative bg-white shadow-[0_30px_80px_rgba(0,0,0,0.7)] overflow-hidden"
        style={{
          width:  page.w * scale,
          height: page.h * scale,
          // ВНЕШНЯЯ СИСТЕМА ОТСЧЁТА: 1 mm = `scale` px
        }}
      >
        {/* Фон */}
        {config.backgroundImageUrl ? (
          <img src={config.backgroundImageUrl} alt="" className="absolute inset-0 w-full h-full object-fill" draggable={false} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Загрузите дизайнерский PNG</div>
        )}

        {/* СЛОТЫ */}
        {(['grid', 'idSlot', 'qrSlot'] as SlotKey[]).map(key => {
          const rect = (config as any)[key] as SlotRect;
          if (key === 'qrSlot' && !config.qrSlot.enabled) return null;
          const meta = SLOT_META[key];
          const isActive = activeSlot === key;
          return (
            <div
              key={key}
              onPointerDown={(e) => startDrag(key, 'move', e)}
              className="absolute select-none cursor-move"
              style={{
                left:   rect.x * scale,
                top:    rect.y * scale,
                width:  rect.width * scale,
                height: rect.height * scale,
                border: `2px ${isActive ? 'solid' : 'dashed'} ${meta.color}`,
                background: isActive ? `${meta.color}22` : `${meta.color}11`,
                boxShadow: isActive ? `0 0 0 2px ${meta.color}55, inset 0 0 0 1px white` : 'none',
                transition: 'background 120ms, box-shadow 120ms',
              }}
            >
              {/* подпись */}
              <div className="absolute -top-6 left-0 text-[11px] font-bold whitespace-nowrap px-2 py-0.5 rounded shadow"
                   style={{ background: meta.color, color: 'white' }}>
                {meta.label} ({rect.width}×{rect.height} мм)
              </div>

              {/* Сетка-индикатор для GridSlot */}
              {key === 'grid' && <GridLinesPreview grid={config.grid} cellGap={config.grid.cellGap} />}

              {/* QR-индикатор */}
              {key === 'qrSlot' && (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-blue-700 font-bold uppercase pointer-events-none">QR</div>
              )}
              {/* ID-индикатор */}
              {key === 'idSlot' && (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-yellow-700 font-bold uppercase pointer-events-none">ID</div>
              )}

              {/* Resize handle */}
              <div
                onPointerDown={(e) => startDrag(key, 'resize', e)}
                className="absolute -right-1.5 -bottom-1.5 w-4 h-4 rounded-sm border-2 border-white cursor-nwse-resize"
                style={{ background: meta.color }}
              />
            </div>
          );
        })}
      </div>

      {/* Подсказка */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-black/60 px-3 py-2 rounded-lg backdrop-blur">
        Тяни слоты мышкой · Угловой квадратик = ресайз · Цифровая правка в левой панели
      </div>
      <div className="absolute top-4 right-4 text-xs text-gray-500 bg-black/40 px-2 py-1 rounded">
        масштаб ×{scale.toFixed(2)}
      </div>
    </div>
  );
}

// Сетка-индикатор внутри grid slot (показывает где будут клетки)
function GridLinesPreview({ grid, cellGap }: { grid: GridSlot; cellGap: number }) {
  // визуальная сетка cols×rows — рисуем прямо как flex
  return (
    <div className="absolute inset-0 flex flex-col pointer-events-none p-px">
      {Array.from({ length: grid.rows }).map((_, r) => (
        <div key={r} className="flex flex-1" style={{ marginTop: r ? cellGap : 0 }}>
          {Array.from({ length: grid.cols }).map((__, c) => (
            <div key={c}
              className="flex-1 flex items-center justify-center text-[8px] text-green-800/50 font-mono"
              style={{
                marginLeft: c ? cellGap : 0,
                border: '1px dotted rgba(34,197,94,0.5)',
              }}>{r * grid.cols + c + 1}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// СЕКЦИИ НАСТРОЕК В ЛЕВОЙ ПАНЕЛИ
// ─────────────────────────────────────────────────────────────────────────

function SlotPositionEditor({ slotKey, config, patchSlot }: {
  slotKey: SlotKey;
  config: TemplateConfig;
  patchSlot: EditorModalProps['patchSlot'];
}) {
  const rect = (config as any)[slotKey] as SlotRect;
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Координаты ({SLOT_META[slotKey].label}) в мм</label>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={rect.x}      onChange={v => patchSlot(slotKey, { x: v })} />
        <NumberField label="Y" value={rect.y}      onChange={v => patchSlot(slotKey, { y: v })} />
        <NumberField label="Ширина"  value={rect.width}  onChange={v => patchSlot(slotKey, { width: v })} />
        <NumberField label="Высота"  value={rect.height} onChange={v => patchSlot(slotKey, { height: v })} />
      </div>
    </div>
  );
}

function GridSettings({ config, patchSlot, patchText }: {
  config: TemplateConfig;
  patchSlot: EditorModalProps['patchSlot'];
  patchText: EditorModalProps['patchText'];
}) {
  return (
    <div className="space-y-4">
      <Divider label="Параметры сетки" />
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Колонок" value={config.grid.cols} min={1} max={10} step={1} onChange={v => patchSlot('grid', { cols: Math.round(v) })} />
        <NumberField label="Строк"   value={config.grid.rows} min={1} max={10} step={1} onChange={v => patchSlot('grid', { rows: Math.round(v) })} />
        <NumberField label="Зазор (мм)"   value={config.grid.cellGap} step={0.1} onChange={v => patchSlot('grid', { cellGap: v })} />
        <NumberField label="Отступ (мм)"  value={config.grid.cellPad} step={0.1} onChange={v => patchSlot('grid', { cellPad: v })} />
      </div>

      <Divider label="Текст трека" />
      <TextStyleEditor style={config.trackTitle} onChange={p => patchText('trackTitle', p)} />

      <Divider label={`Исполнитель ${config.trackArtist.enabled ? '' : '(скрыт)'}`} />
      <ToggleRow label="Показывать исполнителя" checked={config.trackArtist.enabled} onChange={v => patchText('trackArtist', { enabled: v })} />
      {config.trackArtist.enabled && (
        <TextStyleEditor style={config.trackArtist} onChange={p => patchText('trackArtist', p)} />
      )}

      <Divider label="Свободная клетка (центр)" />
      <div>
        <label className="block text-xs text-gray-400 mb-1">Текст</label>
        <input value={config.freeSpace.content} onChange={e => patchText('freeSpace', { content: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none" />
      </div>
      <TextStyleEditor style={config.freeSpace} onChange={p => patchText('freeSpace', p)} />
    </div>
  );
}

function IdSettings({ config, patchText }: { config: TemplateConfig; patchText: EditorModalProps['patchText'] }) {
  return (
    <div className="space-y-4">
      <Divider label="Текст ID" />
      <div>
        <label className="block text-xs text-gray-400 mb-1">Префикс ID</label>
        <input value={config.idText.prefix} onChange={e => patchText('idText', { prefix: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
          placeholder="ID: " />
      </div>
      <TextStyleEditor style={config.idText} onChange={p => patchText('idText', p)} />

      <Divider label={`Подпись ${config.idSubText.enabled ? '' : '(скрыта)'}`} />
      <ToggleRow label="Показывать подпись" checked={config.idSubText.enabled} onChange={v => patchText('idSubText', { enabled: v })} />
      {config.idSubText.enabled && (
        <>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Текст</label>
            <input value={config.idSubText.content} onChange={e => patchText('idSubText', { content: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none" />
          </div>
          <TextStyleEditor style={config.idSubText} onChange={p => patchText('idSubText', p)} />
        </>
      )}
    </div>
  );
}

function QrSettings({ config, patchSlot, setConfig }: {
  config: TemplateConfig;
  patchSlot: EditorModalProps['patchSlot'];
  setConfig: React.Dispatch<React.SetStateAction<TemplateConfig>>;
}) {
  return (
    <div className="space-y-4">
      <ToggleRow label="Показывать QR-код" checked={config.qrSlot.enabled} onChange={v => patchSlot('qrSlot', { enabled: v })} />
      {config.qrSlot.enabled && (
        <>
          <Divider label="QR параметры" />
          <NumberField label="Белый ободок (мм)" value={config.qrSlot.margin} step={0.1} min={0} onChange={v => patchSlot('qrSlot', { margin: v })} />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Содержимое QR (шаблон, {`{id}`} = ID карточки)</label>
            <input value={config.qrPayloadTemplate ?? ''} onChange={e => setConfig(c => ({ ...c, qrPayloadTemplate: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none font-mono"
              placeholder="MUZ-{id}" />
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ОБЩИЕ КОНТРОЛЫ
// ─────────────────────────────────────────────────────────────────────────

function TextStyleEditor({ style, onChange }: { style: TextStyle; onChange: (p: Partial<TextStyle>) => void }) {
  return (
    <div className="space-y-2 p-3 bg-gray-800/50 rounded-xl border border-gray-800">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Шрифт</label>
          <select value={style.fontFamily} onChange={e => onChange({ fontFamily: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none">
            {ALLOWED_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <NumberField label="Размер (pt)" value={style.fontSize} min={4} max={48} step={0.5} onChange={v => onChange({ fontSize: v })} />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-gray-500 uppercase tracking-wide w-12">Цвет</label>
        <input type="color" value={style.color} onChange={e => onChange({ color: e.target.value })}
          className="flex-1 h-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
        <button onClick={() => onChange({ bold: !style.bold })}
          className={`p-1.5 rounded ${style.bold ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-500'}`}>
          <Bold size={14} />
        </button>
        <button onClick={() => onChange({ italic: !style.italic })}
          className={`p-1.5 rounded ${style.italic ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-500'}`}>
          <Italic size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-gray-500 uppercase tracking-wide w-12">Выравн.</label>
        {(['left', 'center', 'right'] as const).map(a => (
          <button key={a} onClick={() => onChange({ align: a })}
            className={`flex-1 py-1 text-xs rounded ${style.align === a ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-400'}`}>
            {a === 'left' ? 'L' : a === 'center' ? 'C' : 'R'}
          </button>
        ))}
        <NumberField label="Строк" value={style.lineClamp ?? 0} min={0} max={5} step={1} compact onChange={v => onChange({ lineClamp: Math.round(v) })} />
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 0.5, min, max, compact }: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; compact?: boolean;
}) {
  return (
    <div className={compact ? 'min-w-[80px]' : ''}>
      <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      <input type="number" value={Number.isFinite(value) ? value : 0} step={step} min={min} max={max}
        onChange={e => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:border-purple-500 outline-none" />
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 transition cursor-pointer rounded-xl border border-gray-700">
      <span className="text-sm font-medium flex items-center gap-2">
        {checked ? <Eye size={14} className="text-green-400"/> : <EyeOff size={14} className="text-gray-500"/>}
        {label}
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-5 h-5 accent-purple-600" />
    </label>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="flex-1 h-px bg-gray-800" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1"><Type size={10} />{label}</span>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// УТИЛИТЫ
// ─────────────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function round1(v: number) { return Math.round(v * 10) / 10; }
