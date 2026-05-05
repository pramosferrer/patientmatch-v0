import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    stored: false,
    message: "Server-side profile storage is disabled. Keep profile details in the browser only.",
  });
}
