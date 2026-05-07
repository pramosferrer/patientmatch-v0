// /lib/geo.ts
const R = 3958.7613; // Earth radius in miles

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la = toRad(a.lat), lb = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearestSiteDistanceMiles(user: { lat: number; lng: number }, locs: any[] | null | undefined): number | null {
  const pts = (locs ?? []).filter((x: any) => typeof x?.lat === "number" && typeof x?.lng === "number");
  if (!pts.length) return null;
  let best = Infinity;
  for (const p of pts) best = Math.min(best, haversineMiles(user, { lat: p.lat, lng: p.lng }));
  return best === Infinity ? null : Math.round(best);
}


