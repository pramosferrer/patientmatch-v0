import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createRateLimitHeaders,
  getClientIp,
  takeSharedRateLimit,
} from "@/lib/rateLimitStore";

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

  void parsed;
  return NextResponse.json({ ok: true, stored: false });
}
