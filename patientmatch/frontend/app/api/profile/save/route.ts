import { NextRequest, NextResponse } from "next/server";
import { readProfileCookie, setProfileCookie, type ProfileCookie } from "@/shared/profileCookie";
import { toConditionSlug } from "@/shared/conditions-normalize";

const ZIP_RE = /^\d{5}$/;

function normalizeConditions(input: unknown): string[] | undefined {
  if (!input) return undefined;
  const raw = Array.isArray(input) ? input : [input];
  const cleaned = raw
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (cleaned.length === 0) return undefined;
  const slugs = cleaned.map((value) => toConditionSlug(value)).filter(Boolean);
  return slugs.length > 0 ? slugs : undefined;
}

function normalizeZip(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (!trimmed || !ZIP_RE.test(trimmed)) return undefined;
  return trimmed;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const incoming: ProfileCookie = {};
  const conditions = normalizeConditions(body?.conditions ?? body?.condition);
  if (conditions) incoming.conditions = conditions;

  const zip = normalizeZip(body?.zip);
  if (zip) incoming.zip = zip;

  const existing = await readProfileCookie(req);
  const merged: ProfileCookie = {
    ...(existing ?? {}),
    ...incoming,
  };

  const res = NextResponse.json({ ok: true });
  if (Object.keys(incoming).length === 0) {
    return res;
  }

  await setProfileCookie(res, merged);
  return res;
}
