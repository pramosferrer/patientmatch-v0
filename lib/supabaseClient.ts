import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Avoid throwing during build; pages will be dynamic anyway.
  if (process.env.NODE_ENV === 'production') {
    console.warn('Supabase env vars missing at build; page should be dynamic.');
  }
}

export function getSupabaseBrowser() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase env not configured');
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}


