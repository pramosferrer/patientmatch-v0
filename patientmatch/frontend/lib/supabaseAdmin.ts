// Server-only: do not import into client components.
import { createClient } from '@supabase/supabase-js';

export function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('SUPABASE_URL is not set (server env).');
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set (server env).');

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'pm-admin' } },
  });
}
