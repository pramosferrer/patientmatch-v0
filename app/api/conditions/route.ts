import { NextResponse } from "next/server";
import { getConditionDirectoryPreview, searchConditionDirectory } from "@/shared/conditions.catalog";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") ?? "";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50) || 50, 1), 100);

    if (query.trim().length >= 2) {
      const conditions = await searchConditionDirectory({ query, limit });
      return NextResponse.json({ success: true, conditions }, { headers: CACHE_HEADERS });
    }

    const catalog = await getConditionDirectoryPreview(Math.max(limit, 50));
    return NextResponse.json(
      { success: true, catalog: { all: catalog.all, featured: catalog.featured } },
      { headers: CACHE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to load condition catalog." },
      { status: 500 },
    );
  }
}
