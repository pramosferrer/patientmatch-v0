import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { CompactEncrypt, compactDecrypt } from "jose";
import { z } from "zod";

export type ProfileCookie = {
  age?: number | null;
  sex?: "male" | "female" | "other" | null;
  zip?: string | null;
  pregnancy?: boolean | null;
  conditions?: string[];
  radius?: number | null;
  for_self?: boolean | null;
  saved_phases?: string[] | null;
  saved_status_buckets?: string[] | null;
};

export const COOKIE_NAME = "pm_profile";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const profileSchema = z.object({
  age: z.number().int().min(0).max(120).nullable().optional(),
  sex: z.enum(["male", "female", "other"]).nullable().optional(),
  zip: z.string().min(3).max(12).nullable().optional(),
  pregnancy: z.boolean().nullable().optional(),
  conditions: z.array(z.string().min(1)).max(12).optional(),
  radius: z.number().int().min(1).max(10000).nullable().optional(),
  for_self: z.boolean().nullable().optional(),
  saved_phases: z.array(z.string()).nullable().optional(),
  saved_status_buckets: z.array(z.string()).nullable().optional(),
});

const payloadSchema = z.object({
  data: profileSchema,
  exp: z.number().int(),
});

const rawSecret = process.env.PII_SECRET;
const piiSecret = typeof rawSecret === "string" ? rawSecret.trim() : "";

if (piiSecret.length < 32) {
  throw new Error("PII_SECRET environment variable is required for profile cookie encryption.");
}

const ENCRYPTION_KEY = createHash("sha256").update(piiSecret).digest();

type SetOptions = {
  ttlDays?: number;
};

// Helper to encrypt with specific expiration
export async function createProfileToken(data: ProfileCookie, ttlDays = 7): Promise<{ token: string; expires: number }> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresSeconds = nowSeconds + Math.floor(ttlDays * 86400);

    const sanitized = profileSchema.parse(data);
    const payload = JSON.stringify({
        data: sanitized,
        exp: expiresSeconds,
    });
    
    const encrypted = await new CompactEncrypt(encoder.encode(payload))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(ENCRYPTION_KEY);

    return { token: encrypted, expires: expiresSeconds };
}

export async function setProfileCookie(
  res: NextResponse,
  data: ProfileCookie,
  { ttlDays = 7 }: SetOptions = {},
) {
  const { token } = await createProfileToken(data, ttlDays);

  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(ttlDays * 86400),
  });

  return res;
}

// Exported for Server Actions
// Helper to decrypt a raw token string
export async function decryptProfileToken(token: string): Promise<ProfileCookie | null> {
  try {
    const { plaintext } = await compactDecrypt(token, ENCRYPTION_KEY, {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    const decoded = decoder.decode(plaintext);
    const parsed = payloadSchema.safeParse(JSON.parse(decoded));
    if (!parsed.success) return null;
    if (parsed.data.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed.data.data;
  } catch {
    return null;
  }
}

export async function readProfileCookie(req: NextRequest): Promise<ProfileCookie | null> {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return decryptProfileToken(cookie.value);
}

export function clearProfileCookie(res: NextResponse) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return res;
}
