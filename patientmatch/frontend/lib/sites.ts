export function nearestSite(locs: any[] = []) {
  const withGeo = (locs || []).filter((l: any) => typeof l?.lat === 'number' && typeof l?.lng === 'number');
  return withGeo[0] ?? null;
}


