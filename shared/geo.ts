type LatLon = { lat: number; lon: number };
type ZipCentroidClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { lat?: unknown; lon?: unknown } | null; error: unknown }>;
      };
    };
  };
};

type CacheEntry = { expiresAt: number; value: LatLon | null };

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function normalizePostalCode(postalCode: string): string | null {
  if (!postalCode) return null;
  const trimmed = postalCode.trim();
  return /^\d{5}$/.test(trimmed) ? trimmed : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export async function resolveZipToLatLon(
  postalCode: string,
  client: ZipCentroidClient,
): Promise<LatLon | null> {
  const normalized = normalizePostalCode(postalCode);
  if (!normalized) return null;

  // Hardcoded fallbacks for known missing ZIPs (e.g. new developments like Seaport)
  const FALLBACKS: Record<string, LatLon> = {
    '02210': { lat: 42.3503, lon: -71.0454 }, // Boston Seaport
  };
  if (FALLBACKS[normalized]) {
    return FALLBACKS[normalized];
  }

  const now = Date.now();
  const cached = cache.get(normalized);
  if (cached) {
    if (cached.expiresAt > now) {
      return cached.value;
    }
    cache.delete(normalized);
  }

  const { data, error } = await client
    .from('zip_centroids')
    .select('lat, lon')
    .eq('zip', normalized)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const lat = toNumber(data?.lat);
  const lon = toNumber(data?.lon);
  const value = lat != null && lon != null ? { lat, lon } : null;

  cache.set(normalized, { value, expiresAt: now + TTL_MS });

  return value;
}
