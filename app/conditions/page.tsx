export const revalidate = 30;

import { getConditionDirectoryPreview } from '@/shared/conditions.catalog';
import ConditionsClient from './ConditionsClient';

export default async function AllConditionsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; includeEmpty?: string }>
}) {
  const { q, includeEmpty } = await searchParams;
  const catalog = await getConditionDirectoryPreview();
  const initialQuery = q ?? '';
  const initialIncludeEmpty = includeEmpty === 'true';
  return (
    <main>
      <ConditionsClient
        catalog={catalog}
        initialQuery={initialQuery}
        initialIncludeEmpty={initialIncludeEmpty}
      />
    </main>
  );
}
