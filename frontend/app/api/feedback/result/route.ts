import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabaseAdmin";
import {
  createRateLimitHeaders,
  getClientIp,
  takeSharedRateLimit,
} from "@/lib/rateLimitStore";

const SESSION_COOKIE = "pm_session_hash";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ResultFeedbackSchema = z
  .object({
    nct_id: z.string().trim().min(4).max(32),
    result_label: z.enum(["likely", "possible", "no"]),
    helpful: z.boolean(),
    reason_code: z.string().trim().min(1).max(64).optional().nullable(),
    context: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .superRefine((payload, ctx) => {
    if (!payload.helpful && !payload.reason_code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide a reason for unhelpful feedback.",
      });
    }
  });

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rateLimit = await takeSharedRateLimit(getClientIp(request));
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: createRateLimitHeaders(rateLimit) },
    );
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = ResultFeedbackSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (process.env.FEATURE_ALLOW_WRITES !== "true") {
    return NextResponse.json({ ok: true, stored: false });
  }

  const sessionHashRaw = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const sessionHash = UUID_PATTERN.test(sessionHashRaw) ? sessionHashRaw : null;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("patient_result_feedback")
      .insert({
        nct_id: parsed.data.nct_id.trim().toUpperCase(),
        result_label: parsed.data.result_label,
        helpful: parsed.data.helpful,
        reason_code: parsed.data.reason_code?.trim() || null,
        comment: null,
        session_hash: sessionHash,
        context: parsed.data.context ?? null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to save feedback." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, stored: true, id: data?.id ?? null });
  } catch {
    return NextResponse.json({ error: "Feedback service unavailable." }, { status: 503 });
  }
}
