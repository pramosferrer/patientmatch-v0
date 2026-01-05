'use client';

import { createBrowserClient } from "@supabase/ssr";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "./types";

function resolveConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return { url, anonKey };
}

let cachedClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!cachedClient) {
    const { url, anonKey } = resolveConfig();
    cachedClient = createBrowserClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return cachedClient;
}

export async function getSession(): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Failed to fetch session: ${error.message}`);
  }
  return data.session ?? null;
}

export async function getUser(): Promise<User | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
  return data.user ?? null;
}
