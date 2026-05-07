import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServiceClient } from "@/lib/supabaseAdmin";
import { sanitizeAnalyticsProps } from "@/lib/analytics";
import { z } from "zod";
import {
  createRateLimitHeaders,
  getClientIp,
  takeSharedRateLimit,
} from "@/lib/rateLimitStore";

const SESSION_COOKIE = "pm_session_hash";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AnalyticsPayloadSchema = z.object({
  event: z.string().min(1).max(120).optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const rateLimit = await takeSharedRateLimit(getClientIp(request));
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: createRateLimitHeaders(rateLimit) },
    );
  }

  let rawPayload: unknown = {};
  try {
    rawPayload = await request.json();
  } catch {
    rawPayload = {};
  }

  const parsed = AnalyticsPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const eventName = parsed.data.event?.trim() ?? "";
  const sanitizedProps = sanitizeAnalyticsProps(parsed.data.props ?? {});

  const existingHash = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const hasValidHash = UUID_PATTERN.test(existingHash);
  const sessionHash = hasValidHash ? existingHash : randomUUID();

  const response = new NextResponse(null, { status: 204 });
  if (!hasValidHash) {
    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionHash,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
  }

  if (!eventName) {
    return response;
  }

  if (process.env.FEATURE_ALLOW_WRITES !== "true") {
    return response;
  }

  try {
    const supabase = getServiceClient();
    await supabase.from("events").insert({
      name: eventName,
      props: {
        ...sanitizedProps,
        session_hash: sessionHash,
      },
    });
  } catch {
    /* best-effort */
  }

  return response;
}
