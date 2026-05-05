import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(null);
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Server-side patient profile storage is disabled. PatientMatch keeps profile details local by default.",
    },
    { status: 410 },
  );
}
