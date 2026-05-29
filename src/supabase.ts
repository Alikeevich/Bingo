import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Лендинг рендерится через AuthProvider, который импортирует этот клиент. Без env-переменных
// createClient бросает исключение и кладёт ВЕСЬ сайт. Подставляем заглушку с предупреждением:
// публичные страницы остаются живыми, а вызовы к БД/Auth просто не сработают, пока env не заданы.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY не заданы — БД и авторизация работать не будут.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);