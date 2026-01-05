import { NextRequest, NextResponse } from 'next/server';
import { fetchTrials } from "@/lib/matching/fetchTrials";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

  // Cookie & Profile Logic
  const cookieStore = await cookies();
  const profileCookieStr = cookieStore.get("pm_profile")?.value;
  const profile = profileCookieStr ? await import("@/shared/profileCookie").then(m => m.decryptProfileToken(profileCookieStr)) : null;

  try {
    const { 
        trialsData, 
        totalCount, 
        page // Current page
    } = await fetchTrials({ searchParams, profile });

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
