export function canonicalizeReason(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes('condition')) return 'Condition match';
  if (r.includes('age') && r.includes('range')) return 'Age in range';
  if (r.includes('age') && r.includes('outside')) return 'Age outside range';
  if (r.includes('remote')) return 'Remote/Hybrid allowed';
  if (r.startsWith('within ') && r.includes(' miles')) return reason.replace(/^(within\s+)(\d+)(.*)$/i, (_, a, n, b) => `Within ${n} miles`);
  if (r.includes('recruit')) return 'Recruiting';
  if (r.includes('site') && r.includes('country')) return reason;
  return reason.charAt(0).toUpperCase() + reason.slice(1);
}

export function mapScoreToBucket(score: number, anyExclusion = false): 'Likely' | 'Possible' | 'Unlikely' {
  if (anyExclusion) {
    const capped = Math.min(score, 49);
    if (capped >= 70) return 'Likely';
    if (capped >= 40) return 'Possible';
    return 'Unlikely';
  }
  if (score >= 70) return 'Likely';
  if (score >= 40) return 'Possible';
  return 'Unlikely';
}


