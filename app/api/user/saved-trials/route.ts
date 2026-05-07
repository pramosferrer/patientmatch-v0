import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth/supabaseServer";
import {
  createRateLimitHeaders,
  getClientIp,
  takeSharedRateLimit,
} from "@/lib/rateLimitStore";

const SavedTrialMutationSchema = z.object({
  nct_id: z.string().trim().min(4).max(32),
  action: z.enum(["save", "remove"]).optional(),
});

const SavedTrialDeleteSchema = z.object({
  nct_id: z.string().trim().min(4).max(32),
});

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

function normalizeNctId(value: string): string {
  return value.trim().toUpperCase();
}

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request);
  if (limited) return limited;

  const { supabase, userId } = await getAuthenticatedClient();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("saved_trials")
    .select("nct_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch saved trials." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request);
  if (limited) return limited;

  const { supabase, userId } = await getAuthenticatedClient();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = SavedTrialMutationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const nctId = normalizeNctId(parsed.data.nct_id);
  const action = parsed.data.action ?? "save";

  if (action === "remove") {
    const { error } = await supabase
      .from("saved_trials")
      .delete()
      .eq("user_id", userId)
      .eq("nct_id", nctId);

    if (error) {
      return NextResponse.json({ error: "Failed to remove saved trial." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("saved_trials").upsert(
    {
      user_id: userId,
      nct_id: nctId,
    },
    { onConflict: "user_id,nct_id" },
  );

  if (error) {
    return NextResponse.json({ error: "Failed to save trial." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const limited = await enforceRateLimit(request);
  if (limited) return limited;

  const { supabase, userId } = await getAuthenticatedClient();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = SavedTrialDeleteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const nctId = normalizeNctId(parsed.data.nct_id);
  const { error } = await supabase
    .from("saved_trials")
    .delete()
    .eq("user_id", userId)
    .eq("nct_id", nctId);

  if (error) {
    return NextResponse.json({ error: "Failed to remove saved trial." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
