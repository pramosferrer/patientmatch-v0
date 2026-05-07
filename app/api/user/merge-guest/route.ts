import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth/supabaseServer";
import {
  createRateLimitHeaders,
  getClientIp,
  takeSharedRateLimit,
} from "@/lib/rateLimitStore";

const MergeGuestSchema = z.object({
  saved_trials: z.array(z.string().trim().min(4).max(32)).max(200).default([]),
});

export const dynamic = "force-dynamic";

function normalizeNctId(value: string): string {
  return value.trim().toUpperCase();
}

export async function POST(request: Request) {
  const rateLimit = await takeSharedRateLimit(getClientIp(request));
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: createRateLimitHeaders(rateLimit) },
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = MergeGuestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const uniqueIds = Array.from(
    new Set(parsed.data.saved_trials.map(normalizeNctId).filter(Boolean)),
  );

  if (uniqueIds.length === 0) {
    return NextResponse.json({ ok: true, merged: 0 });
  }

  const rows = uniqueIds.map((nctId) => ({
    user_id: userData.user.id,
    nct_id: nctId,
  }));

  const { error } = await supabase
    .from("saved_trials")
    .upsert(rows, { onConflict: "user_id,nct_id" });

  if (error) {
    return NextResponse.json({ error: "Failed to merge guest saved trials." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, merged: rows.length });
}
