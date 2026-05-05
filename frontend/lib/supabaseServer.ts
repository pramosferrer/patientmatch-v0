import { createClient } from '@supabase/supabase-js';

/**
 * Public read-only Supabase client for unauthenticated server-side reads
 * such as trials, conditions, and counts. Use the SSR auth client in
 * lib/auth/supabaseServer.ts for user-specific routes, and supabaseAdmin.ts
 * only for service-role writes.
 */
export function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false
    }
  });
}
