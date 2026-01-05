const isDev = process.env.NODE_ENV !== "production";
const redisDisabled = process.env.UPSTASH_REDIS_DISABLED === "1";

const missing: string[] = [];

if (!redisDisabled) {
  if (!process.env.UPSTASH_REDIS_REST_URL) missing.push("UPSTASH_REDIS_REST_URL");
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) missing.push("UPSTASH_REDIS_REST_TOKEN");
}

if (!process.env.FEATURE_ALLOW_WRITES) {
  process.env.FEATURE_ALLOW_WRITES = "false";
  if (isDev) {
    console.warn("[env-check] FEATURE_ALLOW_WRITES not set; defaulting to false");
  }
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!process.env.SUPABASE_URL) missing.push("SUPABASE_URL");
if (!process.env.SUPABASE_ANON_KEY) missing.push("SUPABASE_ANON_KEY");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!process.env.PII_SECRET) {
  missing.push("PII_SECRET");
} else if (process.env.PII_SECRET.trim().length < 32 && isDev) {
  console.warn("[env-check] PII_SECRET must be at least 32 characters long.");
}

if (isDev && missing.length > 0) {
  const context = redisDisabled ? "(Redis disabled)" : "";
  console.warn("[env-check]", "Missing env vars:", missing.join(", "), context);
}

export {};
