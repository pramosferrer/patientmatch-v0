import { NextResponse } from 'next/server';
import { getConditionSuggestions } from '@/lib/conditions';
import { FEATURED_CONDITIONS } from '@/shared/conditions';
import { toConditionLabel } from '@/shared/conditions-normalize';
import { z } from 'zod';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
    query: z.string().trim().max(120).optional(),
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query') || '';
        const parsed = QuerySchema.safeParse({ query });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid query.', details: parsed.error.flatten() },
                { status: 400 }
            );
        }
        
        // If no query, return a small curated set without scanning the full catalog.
        if (!parsed.data.query || parsed.data.query.length < 2) {
            return NextResponse.json(
                FEATURED_CONDITIONS.slice(0, 20).map((slug) => ({
                    slug,
                    label: toConditionLabel(slug),
                })),
                {
                    headers: {
                        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
                    },
                }
            );
        }

        const results = await getConditionSuggestions(parsed.data.query);
        
        return NextResponse.json(results, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
            },
        });
    } catch (error) {
        console.error('Error fetching conditions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch conditions' },
            { status: 500 }
        );
    }
}
