export const dynamic = 'force-dynamic';

import { getConditionCatalog } from '@/shared/conditions.catalog';
import ConditionsClient from './ConditionsClient';

export default async function AllConditionsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; includeEmpty?: string; sort?: string }>
}) {
  const { q, includeEmpty, sort } = await searchParams;
  const catalog = await getConditionCatalog();
  const initialSort =
    sort === 'trials' || sort === 'recent'
      ? sort
      : 'az';
  const initialQuery = q ?? '';
  const initialIncludeEmpty = includeEmpty === 'true';
  return (
    <main>
      <ConditionsClient
        catalog={catalog}
        initialQuery={initialQuery}
        initialIncludeEmpty={initialIncludeEmpty}
        initialSort={initialSort}
      />
    </main>
  );
}
