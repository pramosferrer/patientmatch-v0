import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth/supabaseServer";
import { getServiceClient } from "@/lib/supabaseAdmin";
import {
  createRateLimitHeaders,
  getClientIp,
  takeSharedRateLimit,
} from "@/lib/rateLimitStore";

export const dynamic = "force-dynamic";

async function enforceRateLimit(request: Request) {
  const rateLimit = await takeSharedRateLimit(getClientIp(request));
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: createRateLimitHeaders(rateLimit) },
    );
  }
  return null;
}

async function getAuthenticatedClient() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { supabase, userId: null };
  }
  return { supabase, userId: data.user.id };
}

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request);
  if (limited) return limited;

  const { supabase, userId } = await getAuthenticatedClient();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: profile, error: profileError }, { data: savedTrials, error: savedError }, { data: sessions, error: sessionError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("age, sex, zip, travel_miles, prefers_remote, condition_slugs, alert_opt_in, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("saved_trials")
        .select("nct_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("screener_sessions")
        .select("session_id, nct_id, created_at, expires_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

  if (profileError || savedError || sessionError) {
    return NextResponse.json({ error: "Failed to export user data." }, { status: 500 });
  }

  return NextResponse.json({
    profile: profile ?? null,
    saved_trials: savedTrials ?? [],
    screener_sessions: sessions ?? [],
    exported_at: new Date().toISOString(),
  });
}

export async function DELETE(request: Request) {
  const limited = await enforceRateLimit(request);
  if (limited) return limited;

  const { supabase, userId } = await getAuthenticatedClient();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getServiceClient();
    const [{ error: sessionsError }, { error: savedError }, { error: profileError }] = await Promise.all([
      admin.from("screener_sessions").delete().eq("user_id", userId),
      admin.from("saved_trials").delete().eq("user_id", userId),
      admin.from("profiles").delete().eq("user_id", userId),
    ]);

    if (sessionsError || savedError || profileError) {
      return NextResponse.json({ error: "Failed to delete all user data." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    const [{ error: savedError }, { error: profileError }] = await Promise.all([
      supabase.from("saved_trials").delete().eq("user_id", userId),
      supabase.from("profiles").delete().eq("user_id", userId),
    ]);

    if (savedError || profileError) {
      return NextResponse.json({ error: "Failed to delete user data." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      warning: "Partial delete completed. Some screener sessions may remain.",
    });
  }
}
