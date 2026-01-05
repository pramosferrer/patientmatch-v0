import { getServerSupabase } from '@/lib/supabaseServer';
import { CONDITION_SLUGS } from '@/shared/conditions';
import { unstable_noStore as noStore } from 'next/cache';

export async function getTrialCounts() {
  noStore(); // <- ensure this runs every request

  const counts: Record<string, number> = {};
  (CONDITION_SLUGS as readonly string[]).forEach((slug) => (counts[slug] = 0));

  const supabase = getServerSupabase();

  for (const slug of CONDITION_SLUGS) {
    const { count, error } = await supabase
      .from('trials')
      .select('nct_id', { count: 'exact', head: true })
      .contains('condition_slugs', [slug])
      .ilike('status', 'recruiting');

    if (!error && count !== null) counts[slug] = count;
  }

  return counts;
}


