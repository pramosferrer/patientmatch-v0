import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: "pm_profile",
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
