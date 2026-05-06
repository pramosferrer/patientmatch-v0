import { NextRequest, NextResponse } from 'next/server';
import { fetchTrials } from "@/lib/matching/fetchTrials";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  createRateLimitHeaders,
  getClientIp,
  takeSharedRateLimit,
} from "@/lib/rateLimitStore";

export const dynamic = 'force-dynamic';

const SearchParamsSchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  condition: z.string().trim().max(120).optional(),
  conditions: z.union([z.string(), z.array(z.string())]).optional(),
  zip: z.string().trim().max(12).optional(),
  sex: z.string().trim().max(20).optional(),
  age: z.string().regex(/^\d+$/).optional(),
  radius: z.string().regex(/^\d+$/).optional(),
  status_bucket: z.string().trim().max(100).optional(),
  status: z.string().trim().max(100).optional(),
  phases: z.string().trim().max(40).optional(),
  prefill: z.enum(["0", "1"]).optional(),
});

function hasDiscoveryInput(searchParams: Record<string, string | string[] | undefined>): boolean {
  return [
    searchParams.q,
    searchParams.condition,
    searchParams.conditions,
    searchParams.zip,
    searchParams.sex,
    searchParams.age,
    searchParams.radius,
    searchParams.status_bucket,
    searchParams.status,
    searchParams.phases,
  ].some((value) => {
    if (Array.isArray(value)) return value.some((entry) => entry.trim().length > 0);
    return typeof value === "string" && value.trim().length > 0;
  });
}

export async function GET(request: NextRequest) {
  const rateLimit = await takeSharedRateLimit(getClientIp(request));
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: createRateLimitHeaders(rateLimit) },
    );
  }

  const rawSearchParams: Record<string, string | string[] | undefined> = Object.fromEntries(
    request.nextUrl.searchParams.entries(),
  );
  const conditions = request.nextUrl.searchParams.getAll("conditions");
  if (conditions.length > 1) {
    rawSearchParams.conditions = conditions;
  }

  const parsed = SearchParamsSchema.safeParse(rawSearchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Cookie & Profile Logic
  const cookieStore = await cookies();
  const profileCookieStr = cookieStore.get("pm_profile")?.value;
  let profile = null;
  if (profileCookieStr) {
    try {
      profile = await import("@/shared/profileCookie").then(m => m.decryptProfileToken(profileCookieStr));
    } catch {
      profile = null;
    }
  }

  if (!hasDiscoveryInput(parsed.data)) {
    return NextResponse.json({
      trials: [],
      hasMore: false,
      totalCount: 0,
      message: "Search by condition to see matching trials.",
    });
  }

  try {
    const { 
        trialsData, 
        totalCount, 
        page // Current page
    } = await fetchTrials({ searchParams: parsed.data, profile });

    const PAGE_SIZE = 24;
    const hasMore = totalCount > page * PAGE_SIZE;

    return NextResponse.json({
        trials: trialsData,
        hasMore,
        totalCount
    });
  } catch (error) {
    console.error('API /trials error:', error);
    return NextResponse.json({ error: 'Failed to fetch trials' }, { status: 500 });
  }
}
