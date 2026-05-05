import { NextResponse } from "next/server";
import { getConditionCatalog } from "@/shared/conditions.catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalog = await getConditionCatalog();
    return NextResponse.json({
      success: true,
      catalog: {
        all: catalog.all,
        featured: catalog.featured,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to load condition catalog." },
      { status: 500 },
    );
  }
}
