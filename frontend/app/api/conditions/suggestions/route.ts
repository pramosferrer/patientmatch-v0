import { NextResponse } from 'next/server';
import { getConditionCatalog } from '@/shared/conditions.catalog';
import { z } from 'zod';

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
        
        const catalog = await getConditionCatalog();
        
        // If no query, return all conditions with trials (count > 0)
        if (!parsed.data.query || parsed.data.query.length < 2) {
            const withTrials = catalog.all
                .filter(c => c.count > 0)
                .slice(0, 50)
                .map(c => ({
                    slug: c.slug,
                    label: c.label
                }));
            return NextResponse.json(withTrials);
        }
        
        // Search in labels and synonyms
        const normalizedQuery = parsed.data.query.toLowerCase().trim();
        const matches = catalog.all.filter(c => 
            c.label.toLowerCase().includes(normalizedQuery) || 
            c.synonyms?.some(s => s.toLowerCase().includes(normalizedQuery))
        );
        
        const results = matches.slice(0, 20).map(c => ({
            slug: c.slug,
            label: c.label
        }));
        
        return NextResponse.json(results);
    } catch (error) {
        console.error('Error fetching conditions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch conditions' },
            { status: 500 }
        );
    }
}
