import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServiceClient } from "@/lib/supabaseAdmin";
import { sanitizeAnalyticsProps } from "@/lib/analytics";

const SESSION_COOKIE = "pm_session_hash";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let payload: { event?: unknown; props?: Record<string, unknown> } = {};
  try {
    payload = (await request.json()) as { event?: unknown; props?: Record<string, unknown> };
  } catch {
    payload = {};
  }

  const eventName = typeof payload.event === "string" ? payload.event.trim() : "";
  const sanitizedProps = sanitizeAnalyticsProps(payload.props ?? {});

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
