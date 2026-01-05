import { cookies } from "next/headers";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "./types";

type CookieStoreWithMutation = Awaited<ReturnType<typeof cookies>> & {
  set?: (cookie: {
    name: string;
    value: string;
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
    priority?: "low" | "medium" | "high";
  }) => void;
  delete?: (cookie: { name: string; path?: string; domain?: string }) => void;
};

function resolveSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!url) {
    throw new Error("Supabase URL is not configured.");
  }
  return url;
}

function resolveSupabaseAnonKey(): string {
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Supabase anon key is not configured.");
  }
  return key;
}

const createClient = cache(async (): Promise<SupabaseClient<Database>> => {
  const cookieStore = await cookies();
  const mutableStore = cookieStore as CookieStoreWithMutation;

  return createServerClient<Database>(
    resolveSupabaseUrl(),
    resolveSupabaseAnonKey(),
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          mutableStore.set?.({
            name,
            value,
            path: options?.path,
            domain: options?.domain,
            maxAge: options?.maxAge,
            expires: options?.expires,
            httpOnly: options?.httpOnly,
            secure: options?.secure,
            sameSite: options?.sameSite,
          });
        },
        remove(name, options) {
          mutableStore.delete?.({
            name,
            path: options?.path,
            domain: options?.domain,
          });
        },
      },
    },
  );
});

export async function getSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  return createClient();
}

export async function getSession(): Promise<Session | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Failed to fetch session: ${error.message}`);
  }
  return data.session ?? null;
}

export async function getUser(): Promise<User | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
  return data.user ?? null;
}
