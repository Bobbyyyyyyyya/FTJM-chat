import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl) {
    console.error('❌ VITE_SUPABASE_URL is missing in .env.local');
    console.log('Current env vars:', {
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '***' : 'missing',
    });
    throw new Error('VITE_SUPABASE_URL is required. Check your .env.local file');
}
if (!supabaseAnonKey) {
    console.error('❌ VITE_SUPABASE_ANON_KEY is missing in .env.local');
    throw new Error('VITE_SUPABASE_ANON_KEY is required. Check your .env.local file');
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
//# sourceMappingURL=supabase.js.map