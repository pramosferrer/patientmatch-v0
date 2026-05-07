'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/auth/supabaseClient";

type AuthState =
  | { status: "loading"; session: Session | null; user: User | null }
  | { status: "ready"; session: Session | null; user: User | null }
  | { status: "error"; session: null; user: null; message: string };

const supabase =
  typeof window !== "undefined"
    ? (() => {
        try {
          return getSupabaseBrowserClient();
        } catch {
          return null;
        }
      })()
    : null;

export function useSupabaseAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading", session: null, user: null });

  useEffect(() => {
    if (!supabase) {
      setState({
        status: "error",
        session: null,
        user: null,
        message: "Supabase client is not available.",
      });
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setState({
            status: "error",
            session: null,
            user: null,
            message: error.message,
          });
          return;
        }
        setState({
          status: "ready",
          session: data.session ?? null,
          user: data.session?.user ?? null,
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: "error",
          session: null,
          user: null,
          message: error instanceof Error ? error.message : "Failed to load session.",
        });
      });

    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState({
        status: "ready",
        session: session ?? null,
        user: session?.user ?? null,
      });
    }).data.subscription;

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setState((prev) =>
      prev.status === "ready"
        ? { status: "loading", session: prev.session, user: prev.user }
        : { status: "loading", session: null, user: null },
    );
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setState({
        status: "error",
        session: null,
        user: null,
        message: error.message,
      });
      return;
    }
    setState({
      status: "ready",
      session: data.session ?? null,
      user: data.session?.user ?? null,
    });
  }, []);

  return useMemo(
    () => ({
      supabase,
      status: state.status,
      session: state.status === "ready" ? state.session : null,
      user: state.status === "ready" ? state.user : null,
      error: state.status === "error" ? state.message : null,
      refresh,
    }),
    [state, refresh],
  );
}
